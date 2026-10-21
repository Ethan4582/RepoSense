'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderGit2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Coins,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';
import useRefetch from '~/hooks/use-refetch';
import useProject from '~/hooks/use-project';
import { client } from '~/lib/api-client';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
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
import { Badge } from '~/components/ui/badge';
import Link from 'next/link';

type ProviderId =
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GEMINI'
  | 'GROQ'
  | 'DEEPSEEK'
  | 'XAI'
  | 'META';

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

function parseGitHubRepo(url: string): { owner: string; repo: string; fullName: string } | null {
  const match = url.trim().match(GITHUB_REPO_REGEX);
  if (!match || !match[1] || !match[2]) return null;
  return {
    owner: match[1],
    repo: match[2],
    fullName: `${match[1]}/${match[2]}`,
  };
}

export default function CreateProjectPage() {
  const router = useRouter();
  const refetch = useRefetch();
  const { setProjectId } = useProject();

  // Stepped Form: 1 = Repo, 2 = Estimate, 3 = Models, 4 = Submitting
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // Form Fields
  const [repoUrl, setRepoUrl] = React.useState('');
  const [githubToken, setGithubToken] = React.useState('');
  const [urlError, setUrlError] = React.useState<string | null>(null);

  // Models Selection - Default to OpenAI out-of-the-box
  const [chatProvider, setChatProvider] = React.useState<ProviderId>('OPENAI');
  const [chatModel, setChatModel] = React.useState<string>('gpt-4o');
  const [embeddingProvider, setEmbeddingProvider] = React.useState<'GEMINI' | 'OPENAI'>('OPENAI');

  // Estimate State
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [estimateData, setEstimateData] = React.useState<any>(null);

  // User Keys State
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>(['OPENAI']);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const createProject = api.project.createProject.useMutation();

  const parsedRepo = React.useMemo(() => parseGitHubRepo(repoUrl), [repoUrl]);

  // Load configured keys and user defaults
  React.useEffect(() => {
    async function loadData() {
      try {
        const [keysRes, meRes] = await Promise.all([
          client.keys.$get(),
          client.me.$get(),
        ]);

        if (keysRes.ok) {
          const data = await keysRes.json();
          if ('keys' in data && Array.isArray(data.keys)) {
            const configured = data.keys
              .filter((k: any) => k.status === 'VALID' || k.status === 'UNVERIFIED')
              .map((k: any) => k.provider as ProviderId);
            if (configured.length > 0) {
              setValidProviders(configured);
            }
          }
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          if ('user' in meData && meData.user) {
            if (meData.user.defaultChatProvider) {
              setChatProvider(meData.user.defaultChatProvider);
            }
            if (meData.user.defaultChatModel) {
              setChatModel(meData.user.defaultChatModel);
            }
            if (meData.user.defaultEmbeddingProvider) {
              setEmbeddingProvider(meData.user.defaultEmbeddingProvider);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user preferences', err);
      }
    }
    void loadData();
  }, []);

  const handleRepoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRepoUrl(val);
    if (urlError) {
      setUrlError(null);
    }
  };

  const handleEstimate = async () => {
    const trimmed = repoUrl.trim();
    if (!trimmed || !parsedRepo) {
      setUrlError('Please provide a valid, public GitHub repository URL.');
      return;
    }

    try {
      setIsEstimating(true);
      setUrlError(null);
      const res = await client.projects.estimate.$post({
        json: {
          repoUrl: trimmed,
          githubToken: githubToken.trim() || undefined,
          modelId: chatModel,
          embeddingModelId: embeddingProvider === 'OPENAI' ? 'text-embedding-3-small' : 'gemini-embedding-001',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const errMsg = (err as any)?.error || 'Please provide a valid, public GitHub repository URL.';
        setUrlError(errMsg);
        toast.error(errMsg);
        return;
      }

      const data = await res.json();
      if ('estimate' in data) {
        setEstimateData(data.estimate);
        setStep(2);
      }
    } catch (err: any) {
      const errMsg = 'Please provide a valid, public GitHub repository URL.';
      setUrlError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleFinish = async () => {
    if (!parsedRepo) {
      setUrlError('Please provide a valid, public GitHub repository URL.');
      setStep(1);
      return;
    }

    if (!validProviders.includes(embeddingProvider)) {
      toast.error(`You must configure an API key for ${embeddingProvider} in Settings to generate code embeddings.`);
      return;
    }

    try {
      setIsSubmitting(true);
      createProject.mutate(
        {
          name: parsedRepo.fullName,
          repoUrl: repoUrl.trim(),
          githubToken: githubToken.trim() || undefined,
          chatProvider,
          chatModel,
          embeddingProvider,
        },
        {
          onSuccess: (project: any) => {
            toast.success('Project created and indexing started!');
            void refetch();
            if (project?.id) {
              setProjectId(project.id);
            }
            router.push('/dashboard');
          },
          onError: (err: any) => {
            setIsSubmitting(false);
            const msg = err?.message || 'Please provide a valid, public GitHub repository URL.';
            setUrlError(msg);
            setStep(1);
            toast.error(msg);
          },
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err?.message || 'Please provide a valid, public GitHub repository URL.';
      setUrlError(msg);
      setStep(1);
      toast.error(msg);
    }
  };

  const hasEmbeddingKey = validProviders.includes(embeddingProvider);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Header and Stepper Bar */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Link a GitHub Repository
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your codebase, review token and cost estimates, and configure your AI models.
        </p>
      </div>

      {/* Stepper Progress */}
      <div className="flex items-center justify-between border-b pb-4 text-xs font-medium">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">1</span>
          <span>Repository</span>
        </div>
        <div className="h-px w-12 bg-border" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">2</span>
          <span>Token Estimate</span>
        </div>
        <div className="h-px w-12 bg-border" />
        <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">3</span>
          <span>Model Selection</span>
        </div>
      </div>

      {/* Step 1: Repository Details */}
      {step === 1 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderGit2 className="size-4 text-primary" />
              Repository Information
            </CardTitle>
            <CardDescription className="text-xs">
              Enter your public GitHub repository URL. The repository name is automatically derived.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GitHub Repository URL</Label>
              <Input
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={handleRepoUrlChange}
                className={`text-xs font-mono ${urlError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                autoFocus
              />

              {/* Inline Error Display */}
              {urlError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{urlError}</span>
                </div>
              )}

              {/* Auto-derived Repository Indicator */}
              {parsedRepo && !urlError && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>
                    Detected repository:{' '}
                    <strong className="text-foreground font-mono">{parsedRepo.fullName}</strong>
                  </span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground pt-0.5">
                Must be a valid, public GitHub repository URL (e.g. <code className="font-mono">https://github.com/facebook/react</code>).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GitHub Personal Access Token (Optional)</Label>
              <Input
                type="password"
                placeholder="ghp_... (Required only for private repositories)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Encrypted at rest using AES-GCM. Never exposed to clients.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleEstimate}
                disabled={isEstimating || !repoUrl.trim() || !parsedRepo}
                className="gap-2 text-xs"
              >
                {isEstimating ? (
                  <>
                    <Sparkles className="size-3.5 animate-spin" />
                    <span>Analyzing GitHub Tree...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Token Estimate</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Token Estimate */}
      {step === 2 && estimateData && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Coins className="size-4 text-primary" />
              Pre-Index Token & Cost Estimate
            </CardTitle>
            <CardDescription className="text-xs">
              Based on {estimateData.files} source code files. Verified against your personal API keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <FileCode className="size-3" />
                  Files
                </span>
                <p className="text-lg font-bold text-foreground mt-1">{estimateData.files}</p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground">Input Tokens</span>
                <p className="text-sm font-semibold text-foreground mt-1">
                  ~{Math.round((estimateData.inputTokens.min + estimateData.inputTokens.max) / 2 / 1000)}k
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground">Output Tokens</span>
                <p className="text-sm font-semibold text-foreground mt-1">
                  ~{Math.round((estimateData.outputTokens.min + estimateData.outputTokens.max) / 2 / 1000)}k
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground">Est. Cost</span>
                <p className="text-sm font-semibold text-emerald-600 mt-1">
                  ${estimateData.estimatedCostUsd.min.toFixed(4)} - ${estimateData.estimatedCostUsd.max.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> Cost range is calculated from public provider pricing. Tokens will be deducted directly from your personal provider quota (BYOK).
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setStep(3)}
                className="gap-1.5 text-xs"
              >
                <span>Next: Model Configuration</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Model Configuration */}
      {step === 3 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              AI Model & Provider Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Select your preferred chat reasoning and embedding providers for this repository.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Embedding Provider Lock */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Embedding Provider (Locked After Indexing)</Label>
                {!hasEmbeddingKey && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertCircle className="size-2.5" />
                    Missing API Key
                  </Badge>
                )}
              </div>
              <Select
                value={embeddingProvider}
                onValueChange={(val: any) => setEmbeddingProvider(val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GEMINI">Google Gemini (gemini-embedding-001 - 768d)</SelectItem>
                  <SelectItem value="OPENAI">OpenAI (text-embedding-3-small - 1536d)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Embedding dimension is fixed per repository to ensure fast vector search performance.
              </p>
            </div>

            {/* Default Chat Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Chat Provider</Label>
              <Select
                value={chatProvider}
                onValueChange={(val: any) => setChatProvider(val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GEMINI">Google Gemini</SelectItem>
                  <SelectItem value="OPENAI">OpenAI</SelectItem>
                  <SelectItem value="ANTHROPIC">Anthropic Claude</SelectItem>
                  <SelectItem value="GROQ">Groq</SelectItem>
                  <SelectItem value="DEEPSEEK">DeepSeek</SelectItem>
                  <SelectItem value="XAI">xAI Grok</SelectItem>
                  <SelectItem value="META">Meta Model</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provider Key Missing Warning */}
            {!hasEmbeddingKey && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="size-3.5" />
                  API Key Required for {embeddingProvider}
                </div>
                <p className="text-[11px]">
                  You must configure a valid {embeddingProvider} API key in your Key Vault before indexing.
                </p>
                <Link href="/settings" className="inline-block mt-1 font-semibold underline text-primary">
                  Go to Settings & Key Vault →
                </Link>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={isSubmitting || !hasEmbeddingKey}
                className="gap-1.5 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="size-3.5 animate-spin" />
                    <span>Creating & Launching Workflow...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Start Indexing Repository</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
