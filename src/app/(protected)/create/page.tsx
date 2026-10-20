'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderGit2,
  Calculator,
  Cpu,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  PROVIDER_METADATA,
  getModelsByProvider,
  type ProviderId,
} from '~/lib/providers';
import { api } from '~/trpc/react';
import useRefetch from '~/hooks/use-refetch';
import useProject from '~/hooks/use-project';
import { client } from '~/lib/api-client';

const ALL_PROVIDERS: ProviderId[] = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'META',
  'DEEPSEEK',
  'XAI',
  'GROQ',
];

export default function CreatePage() {
  const router = useRouter();
  const refetch = useRefetch();
  const { setProjectId } = useProject();

  // Stepped Form: 1 = Repo, 2 = Estimate, 3 = Models, 4 = Submitting
  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // Form Fields
  const [projectName, setProjectName] = React.useState('');
  const [repoUrl, setRepoUrl] = React.useState('');
  const [githubToken, setGithubToken] = React.useState('');

  // Models Selection
  const [chatProvider, setChatProvider] = React.useState<ProviderId>('GEMINI');
  const [chatModel, setChatModel] = React.useState<string>('gemini-2.5-flash');
  const [embeddingProvider, setEmbeddingProvider] = React.useState<'GEMINI' | 'OPENAI'>('GEMINI');

  // Estimate State
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [estimateData, setEstimateData] = React.useState<any>(null);

  // User Keys State
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>(['GEMINI']);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const createProject = api.project.createProject.useMutation();

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
              setChatProvider(meData.user.defaultChatProvider as ProviderId);
            }
            if (meData.user.defaultChatModel) {
              setChatModel(meData.user.defaultChatModel);
            }
            if (meData.user.defaultEmbeddingProvider) {
              setEmbeddingProvider(meData.user.defaultEmbeddingProvider as any);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user preferences:', err);
      }
    }
    loadData();
  }, []);

  const runEstimate = async () => {
    if (!repoUrl.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    try {
      setIsEstimating(true);
      const res = await client.projects.estimate.$post({
        json: {
          repoUrl: repoUrl.trim(),
          githubToken: githubToken.trim() || undefined,
          modelId: chatModel,
          embeddingModelId: embeddingProvider === 'OPENAI' ? 'text-embedding-3-small' : 'gemini-embedding-001',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error((err as any)?.error || 'Failed to estimate repo tokens');
        return;
      }

      const data = await res.json();
      if ('estimate' in data) {
        setEstimateData(data.estimate);
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to estimate');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleFinish = async () => {
    if (!validProviders.includes(embeddingProvider)) {
      toast.error(`You must configure an API key for ${embeddingProvider} in Settings to generate code embeddings.`);
      return;
    }

    try {
      setIsSubmitting(true);
      createProject.mutate(
        {
          name: projectName.trim(),
          repoUrl: repoUrl.trim(),
          githubToken: githubToken.trim() || undefined,
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
            toast.error(err?.message || 'Failed to create project');
          },
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err?.message || 'Error creating project');
    }
  };

  const hasEmbeddingKey = validProviders.includes(embeddingProvider);
  const hasChatKey = validProviders.includes(chatProvider);

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
              Enter the GitHub repository name and clone URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Project Name</Label>
              <Input
                placeholder="e.g. reposense-web"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GitHub Repository URL</Label>
              <Input
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="text-xs font-mono"
              />
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
                Tokens are encrypted with AES-256-GCM. Public repos do not require a token.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button
              size="sm"
              onClick={runEstimate}
              disabled={isEstimating || !projectName.trim() || !repoUrl.trim()}
              className="gap-2 text-xs"
            >
              {isEstimating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Calculating Estimate...
                </>
              ) : (
                <>
                  Next: Token Estimate
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Token & Cost Estimate Card */}
      {step === 2 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              Repository Token & Cost Estimate
            </CardTitle>
            <CardDescription className="text-xs">
              Calculated based on repository size, character density, and provider model rates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Eligible Files</span>
                <p className="text-lg font-bold text-foreground mt-0.5">{estimateData?.files ?? 0}</p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Input Tokens</span>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  ~{estimateData?.inputTokens ? Math.round(estimateData.inputTokens.min / 1000) : 0}k
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Output Tokens</span>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  ~{estimateData?.outputTokens ? Math.round(estimateData.outputTokens.min / 1000) : 0}k
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Est. Cost Range</span>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">
                  ${estimateData?.estimatedCostUsd ? estimateData.estimatedCostUsd.min.toFixed(3) : '0.000'} - ${estimateData?.estimatedCostUsd ? estimateData.estimatedCostUsd.max.toFixed(3) : '0.010'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary shrink-0" />
              <span>
                BYOK Architecture: API tokens are billed directly by your AI provider. RepoSense never charges usage fees or credits.
              </span>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep(3)}
              className="gap-2 text-xs"
            >
              Next: Select Models
              <ArrowRight className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Model Configuration & Verification */}
      {step === 3 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              AI Model & Provider Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Configure which models will handle chat answering and code embedding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Chat Provider</Label>
              <Select
                value={chatProvider}
                onValueChange={(val) => {
                  const prov = val as ProviderId;
                  setChatProvider(prov);
                  const m = getModelsByProvider(prov);
                  if (m[0]) setChatModel(m[0].id);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {PROVIDER_METADATA[p].displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Chat Model</Label>
              <Select value={chatModel} onValueChange={setChatModel}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {getModelsByProvider(chatProvider).map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Embedding Provider (Locked permanently after indexing)</Label>
              <Select
                value={embeddingProvider}
                onValueChange={(val) => setEmbeddingProvider(val as any)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select embedding provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GEMINI" className="text-xs">
                    Google Gemini (gemini-embedding-001 · 768 dimensions)
                  </SelectItem>
                  <SelectItem value="OPENAI" className="text-xs">
                    OpenAI (text-embedding-3-small · 1536 dimensions)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verification warning if required keys are missing */}
            {!hasEmbeddingKey && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Missing {embeddingProvider} API Key in your vault.</span>
                </div>
                <Link href="/settings?tab=api" className="font-semibold underline flex items-center gap-1">
                  <span>Add in Settings</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(2)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleFinish}
              disabled={isSubmitting || !hasEmbeddingKey}
              className="gap-2 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Start Indexing Repository
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
