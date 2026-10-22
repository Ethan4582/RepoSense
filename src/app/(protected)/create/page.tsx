'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  FileCode,
  FolderGit2,
  Globe2,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import useRefetch from '~/hooks/use-refetch';
import useProject from '~/hooks/use-project';
import { client } from '~/lib/api-client';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  getDefaultChatModel,
  getModelsByProvider,
} from '~/lib/providers/catalog';
import type { ProviderId } from '~/lib/providers/types';
import { cn } from '~/lib/utils';
import { IndexingLoader } from '~/components/indexing-loader';

const GITHUB_REPO_REGEX =
  /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/tree\/[^\s?#]+)?\/?$/;

const CHAT_PROVIDERS: ProviderId[] = [
  'OPENAI',
  'ANTHROPIC',
  'GEMINI',
  'META',
  'DEEPSEEK',
  'XAI',
  'GROQ',
];

interface Verification {
  repository: {
    owner: string;
    repo: string;
    name: string;
    defaultBranch: string;
    isPrivate: boolean;
    sizeKb: number;
    repoUrl: string;
  };
  existingWiki: { id: string; name: string; lastIndexedBranch?: string | null } | null;
}

interface Estimate {
  files: number;
  inputTokens: { min: number; max: number };
  outputTokens: { min: number; max: number };
  estimatedCostUsd: { min: number; max: number };
}

interface IndexingSession {
  projectId: string;
  jobId?: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStep?: string | null;
  errorMessage?: string | null;
}

function parsedRepo(url: string) {
  const match = GITHUB_REPO_REGEX.exec(url.trim());
  return match ? match[0].replace(/\/$/, '') : null;
}

function branchFromRepoUrl(url: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[2] === 'tree' && parts.length > 3 ? decodeURIComponent(parts.slice(3).join('/')) : undefined;
  } catch {
    return undefined;
  }
}

function CreateProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoParam = searchParams.get('repo');
  const refetch = useRefetch();
  const { setProjectId } = useProject();

  const [repoUrl, setRepoUrl] = React.useState(repoParam ?? '');
  const [githubToken, setGithubToken] = React.useState('');
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verification, setVerification] = React.useState<Verification | null>(null);
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);

  const [isPublicWiki, setIsPublicWiki] = React.useState(true);
  const [chatProvider, setChatProvider] = React.useState<ProviderId>('OPENAI');
  const [chatModel, setChatModel] = React.useState('gpt-6.1-sol');
  const [embeddingProvider, setEmbeddingProvider] = React.useState<'OPENAI' | 'GEMINI'>('OPENAI');
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [indexingSession, setIndexingSession] = React.useState<IndexingSession | null>(null);

  const repoBase = React.useMemo(() => parsedRepo(repoUrl), [repoUrl]);
  const requestedBranch = React.useMemo(() => branchFromRepoUrl(repoBase ?? ''), [repoBase]);
  const models = React.useMemo(() => getModelsByProvider(chatProvider), [chatProvider]);
  const isPrivateRepo = verification?.repository.isPrivate ?? false;
  const hasEmbeddingKey = validProviders.includes(embeddingProvider);
  const hasChatKey = validProviders.includes(chatProvider);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [keysRes, meRes] = await Promise.all([client.keys.$get(), client.me.$get()]);

        if (keysRes.ok) {
          const data = await keysRes.json();
          if ('keys' in data && Array.isArray(data.keys)) {
            const configured = data.keys
              .filter((key) => key.status === 'VALID')
              .map((key) => key.provider);
            setValidProviders(configured);
          }
        }

        if (meRes.ok) {
          const data = await meRes.json();
          if ('user' in data && data.user) {
            const provider = data.user.defaultChatProvider as ProviderId | undefined;
            if (provider) setChatProvider(provider);
            if (data.user.defaultChatModel) setChatModel(data.user.defaultChatModel);
            if (data.user.defaultEmbeddingProvider === 'GEMINI') setEmbeddingProvider('GEMINI');
            if (data.user.defaultEmbeddingProvider === 'OPENAI') setEmbeddingProvider('OPENAI');
          }
        }
      } catch {
        // Preferences are optional.
      }
    }
    void loadData();
  }, []);

  React.useEffect(() => {
    if (!indexingSession || !indexingSession.projectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${indexingSession.projectId}/indexing/status`, { cache: 'no-store' });
        const data = (await response.json()) as { job?: IndexingSession | null };
        if (cancelled || !data.job) return;
        setIndexingSession((current) => current ? { ...current, ...data.job } : current);
        if (data.job.status === 'COMPLETED') {
          void refetch();
          setProjectId(indexingSession.projectId);
          router.push(`/wiki/${indexingSession.projectId}`);
          return;
        }
        if (data.job.status === 'FAILED') {
          setIsSubmitting(false);
          return;
        }
      } catch {
        // Keep polling transient network failures while the indexing screen is open.
      }
      if (!cancelled) timer = setTimeout(poll, 1500);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [indexingSession?.projectId, refetch, router, setProjectId]);

  const resetVerification = () => {
    setVerification(null);
    setEstimate(null);
  };

  const verifyRepository = async () => {
    const base = parsedRepo(repoUrl);
    if (!base) {
      setUrlError('Please enter a valid GitHub repository URL (https://github.com/owner/repo).');
      return;
    }

    setVerifying(true);
    setUrlError(null);
    resetVerification();

    try {
      const res = await fetch('/api/projects/verify-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: base, githubToken: githubToken.trim() || undefined }),
      });
      const data = (await res.json()) as Verification & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Repository could not be verified.');

      setVerification(data);
      setIsPublicWiki(!data.repository.isPrivate);
      setEstimating(true);
      const estimateRes = await client.projects.estimate.$post({
        json: {
          repoUrl: base,
          githubToken: githubToken.trim() || undefined,
          modelId: chatModel,
          embeddingModelId:
            embeddingProvider === 'OPENAI' ? 'text-embedding-3-small' : 'gemini-embedding-001',
        },
      });
      if (estimateRes.ok) {
        const payload = await estimateRes.json();
        if ('estimate' in payload) setEstimate(payload.estimate);
      }
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Repository could not be verified.');
    } finally {
      setVerifying(false);
      setEstimating(false);
    }
  };

  const handleProviderChange = (value: string) => {
    const provider = value as ProviderId;
    setChatProvider(provider);
    setChatModel(getDefaultChatModel(provider));
  };

  const handleSubmit = async () => {
    if (!verification) {
      setUrlError('Verify the repository before generating its wiki.');
      return;
    }
    if (!hasEmbeddingKey) {
      toast.error(`Add an ${embeddingProvider} API key for vector embeddings in Settings.`);
      return;
    }
    if (!hasChatKey) {
      toast.error(`Add an ${chatProvider} API key for chat generation in Settings.`);
      return;
    }

    setIsSubmitting(true);
    setIndexingSession({
      projectId: '',
      status: 'QUEUED',
      currentStep: 'LOADING_REPO',
    });
    try {
      const res = await client.projects.$post({
        json: {
          repoUrl: repoBase ?? verification.repository.repoUrl,
          githubToken: githubToken.trim() || undefined,
          chatProvider,
          chatModel,
          embeddingProvider,
          isPublicWiki: isPrivateRepo ? false : isPublicWiki,
        },
      });
      const data = (await res.json()) as {
        project?: { id: string };
        indexingJobId?: string | null;
        error?: string;
        code?: string;
        projectId?: string;
      };

      if (!res.ok) {
        const requestedBranch = repoBase ? branchFromRepoUrl(repoBase) : undefined;
        if (data.code === 'DUPLICATE_PROJECT' && data.projectId && requestedBranch) {
          const branchRes = await fetch(`/api/projects/${data.projectId}/indexing/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch: requestedBranch }),
          });
          const branchData = (await branchRes.json().catch(() => ({}))) as { error?: string; code?: string };
          if (!branchRes.ok && branchData.code !== 'BRANCH_ALREADY_INDEXED') {
            throw new Error(branchData.error ?? 'Could not start indexing this branch.');
          }
          setProjectId(data.projectId);
          void refetch();
          toast.success(branchData.code === 'BRANCH_ALREADY_INDEXED' ? 'This branch is already indexed.' : 'Feature branch indexing has started.');
          setIndexingSession({
            projectId: data.projectId,
            status: 'RUNNING',
            currentStep: 'LOADING_REPO',
          });
          return;
        }
        setIndexingSession(null);
        setIsSubmitting(false);
        throw new Error(data.error ?? 'Could not create this wiki.');
      }

      const projectId = data.project?.id ?? data.projectId;
      toast.success('Wiki created. Indexing has started.');
      if (projectId) {
        setIndexingSession({ projectId, jobId: data.indexingJobId, status: 'QUEUED', currentStep: 'LOADING_REPO' });
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setIsSubmitting(false);
      setIndexingSession(null);
      toast.error(err instanceof Error ? err.message : 'Could not create this wiki.');
    }
  };

  const estimatedMinutes = estimate ? Math.max(2, Math.ceil(estimate.files / 120)) : null;
  const avgTokens = estimate
    ? Math.round((estimate.inputTokens.min + estimate.inputTokens.max) / 2)
    : null;

  if (indexingSession) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center px-4">
        <IndexingLoader step={indexingSession.currentStep} />
        {indexingSession.status === 'FAILED' ? (
          <div className="mt-2 text-center">
            <p className="text-sm text-destructive">{indexingSession.errorMessage ?? 'Indexing failed. No wiki was generated.'}</p>
            <Button className="mt-4" variant="outline" onClick={() => setIndexingSession(null)}>Back to setup</Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Repository Wiki</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn a GitHub repository into a structured, source-cited wiki powered by your own API keys.
        </p>
      </div>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FolderGit2 className="size-4 text-primary" />
            GitHub Repository
          </CardTitle>
          <CardDescription className="text-xs">
            Only the repository URL is required. The wiki name is derived automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Repository URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(event) => {
                  setRepoUrl(event.target.value);
                  setUrlError(null);
                  resetVerification();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void verifyRepository();
                }}
                className={cn(
                  'font-mono text-xs',
                  urlError && 'border-destructive focus-visible:ring-destructive'
                )}
                autoFocus
              />
              <Button
                type="button"
                onClick={() => void verifyRepository()}
                disabled={verifying || !repoBase}
                className="shrink-0 gap-2 text-xs"
              >
                {verifying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {verifying ? 'Verifying...' : 'Verify repository'}
              </Button>
            </div>

            {urlError ? (
              <div className="mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{urlError}</span>
              </div>
            ) : repoBase && !verification ? (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span>
                  URL format looks valid: <strong className="font-mono text-foreground">{repoBase}</strong>
                </span>
              </div>
            ) : null}

            <p className="pt-0.5 text-[11px] text-muted-foreground">
              Examples: <code className="font-mono">https://github.com/facebook/react</code>,{' '}
              <code className="font-mono">https://github.com/owner/repo/tree/feature/my-branch</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              GitHub Personal Access Token <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              type="password"
              placeholder="ghp_... (required for private repositories)"
              value={githubToken}
              onChange={(event) => {
                setGithubToken(event.target.value);
                resetVerification();
              }}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Encrypted at rest with AES-256-GCM and never returned to the browser.
            </p>
          </div>

          {verification ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span className="truncate font-mono font-semibold text-foreground">
                    {verification.repository.owner}/{verification.repository.repo}
                  </span>
                  <span className="text-muted-foreground">
                    · {verification.repository.defaultBranch}
                  </span>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    {verification.repository.isPrivate ? (
                      <Lock className="size-2.5" />
                    ) : (
                      <Globe2 className="size-2.5" />
                    )}
                    {verification.repository.isPrivate ? 'Private repo' : 'Public repo'}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {Math.max(1, Math.round(verification.repository.sizeKb / 1024))} MB on GitHub
                </span>
              </div>
            </div>
          ) : null}

          {verification?.existingWiki ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {requestedBranch && requestedBranch !== verification.repository.defaultBranch
                      ? `The existing wiki has already indexed ${verification.existingWiki.lastIndexedBranch ?? verification.repository.defaultBranch}.`
                      : 'This repository has already been converted into a Public DeepWiki.'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {requestedBranch && requestedBranch !== verification.repository.defaultBranch
                      ? `The requested feature branch “${requestedBranch}” is separate. Review its estimate below, then generate its documentation.`
                      : 'View the existing wiki now, or continue to re-index it with your own key and model.'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link href={`/wiki/${verification.existingWiki.id}`}>
                      <Button size="sm" className="h-7 gap-1.5 text-[11px]">
                        <BookOpen className="size-3" /> View existing wiki
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setVerification({ ...verification, existingWiki: null })}
                    >
                      {requestedBranch ? 'Continue to branch setup' : 'Convert again with my key & model'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {verification && (!verification.existingWiki || Boolean(requestedBranch)) ? (
        <>
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Coins className="size-4 text-primary" />
                Estimated Indexing Cost
              </CardTitle>
              <CardDescription className="text-xs">
                {estimating
                  ? 'Analyzing the repository tree and eligible source files...'
                  : 'Calculated from filtered source files and current provider pricing. You pay your provider directly.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estimating ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
                  ))}
                </div>
              ) : estimate ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FileCode className="size-3" /> Files
                    </span>
                    <p className="mt-1 text-lg font-bold text-foreground">{estimate.files}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <span className="text-[11px] text-muted-foreground">Input tokens</span>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      ~{avgTokens ? `${Math.round(avgTokens / 1000)}k` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <span className="text-[11px] text-muted-foreground">Est. cost</span>
                    <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      ${estimate.estimatedCostUsd.min.toFixed(4)}–${estimate.estimatedCostUsd.max.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" /> Time
                    </span>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      ~{estimatedMinutes}–{estimatedMinutes ? estimatedMinutes + 2 : 4} min
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Estimate unavailable. You can still generate the wiki.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Cpu className="size-4 text-primary" />
                Models & Visibility
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-filled from your settings. Embedding dimensions are locked after the first index.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    {isPrivateRepo ? (
                      <Lock className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Globe2 className="size-3.5 text-primary" />
                    )}
                    {isPrivateRepo ? 'Private wiki' : isPublicWiki ? 'Public wiki' : 'Private wiki'}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {isPrivateRepo
                      ? 'Wikis for private repositories are always private.'
                      : isPublicWiki
                        ? 'Anyone can read this wiki from the Explore directory.'
                        : 'Only you and project members can open this wiki.'}
                  </p>
                </div>
                <Switch
                  checked={isPublicWiki}
                  onCheckedChange={setIsPublicWiki}
                  disabled={isPrivateRepo}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Chat provider</Label>
                  <Select value={chatProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAT_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider} className="text-xs">
                          {provider === 'OPENAI'
                            ? 'OpenAI'
                            : provider === 'ANTHROPIC'
                              ? 'Anthropic'
                              : provider === 'GEMINI'
                                ? 'Google Gemini'
                                : provider === 'META'
                                  ? 'Meta'
                                  : provider === 'XAI'
                                    ? 'xAI'
                                    : provider.charAt(0) + provider.slice(1).toLowerCase()}
                          {!validProviders.includes(provider) ? ' (key missing)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Chat model</Label>
                  <Select value={chatModel} onValueChange={setChatModel}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs">
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Embedding provider</Label>
                  {!hasEmbeddingKey ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertCircle className="size-2.5" /> Missing key
                    </Badge>
                  ) : null}
                </div>
                <Select
                  value={embeddingProvider}
                  onValueChange={(value) => setEmbeddingProvider(value as 'OPENAI' | 'GEMINI')}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPENAI" className="text-xs">
                      OpenAI · text-embedding-3-small · 1536d
                    </SelectItem>
                    <SelectItem value="GEMINI" className="text-xs">
                      Google Gemini · gemini-embedding-001 · 768d
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Embedding provider and dimensions cannot change after indexing without a full re-index.
                </p>
              </div>

              {!hasEmbeddingKey || !hasChatKey ? (
                <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="size-3.5" />
                    API key required
                  </div>
                  <p className="text-[11px]">
                    Add {!hasEmbeddingKey ? `${embeddingProvider} ` : ''}
                    {!hasEmbeddingKey && !hasChatKey ? 'and ' : ''}
                    {!hasChatKey ? `${chatProvider} ` : ''}
                    keys in Settings before indexing.
                  </p>
                  <Link href="/settings" className="inline-block pt-0.5 font-semibold text-primary underline">
                    Open API keys & models
                  </Link>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Indexing runs in the background. You can close this tab.
                </p>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !hasEmbeddingKey || !hasChatKey}
                  className="gap-2 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Creating wiki...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" /> Generate wiki
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function CreateProjectPage() {
  return (
    <React.Suspense fallback={null}>
      <CreateProjectContent />
    </React.Suspense>
  );
}
