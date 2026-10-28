"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import useRefetch from "~/hooks/use-refetch";
import useProject from "~/hooks/use-project";
import { client, getApiBaseUrl } from "~/lib/api-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getDefaultChatModel,
  getModelsByProvider,
} from "~/lib/providers/catalog";
import type { ProviderId } from "~/lib/providers/types";
import { cn } from "~/lib/utils";
import { IndexingLoader } from "~/components/indexing-loader";
import { ServerBusyNotice } from "~/components/server-busy-notice";

const GITHUB_REPO_REGEX =
  /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/tree\/[^\s?#]+)?\/?$/;

const CHAT_PROVIDERS: ProviderId[] = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "META",
  "DEEPSEEK",
  "XAI",
  "GROQ",
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
  existingWiki: {
    id: string;
    name: string;
    lastIndexedBranch?: string | null;
  } | null;
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
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  currentStep?: string | null;
  errorMessage?: string | null;
}

function parsedRepo(url: string) {
  const match = GITHUB_REPO_REGEX.exec(url.trim());
  return match ? match[0].replace(/\/$/, "") : null;
}

function CreateProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoParam = searchParams.get("repo");
  const refetch = useRefetch();
  const { setProjectId } = useProject();

  const [repoUrl, setRepoUrl] = React.useState(repoParam ?? "");
  const [githubToken, setGithubToken] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [verification, setVerification] = React.useState<Verification | null>(
    null,
  );
  const [estimate, setEstimate] = React.useState<Estimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [busyNotice, setBusyNotice] = React.useState<{
    message: string;
    retryAt?: string;
  } | null>(null);

  const [isPublicWiki, setIsPublicWiki] = React.useState(true);
  const [chatProvider, setChatProvider] = React.useState<ProviderId>("OPENAI");
  const [chatModel, setChatModel] = React.useState("gpt-6.1-sol");
  const [embeddingProvider, setEmbeddingProvider] = React.useState<
    "OPENAI" | "GEMINI"
  >("OPENAI");
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [indexingSession, setIndexingSession] =
    React.useState<IndexingSession | null>(null);

  const repoBase = React.useMemo(() => parsedRepo(repoUrl), [repoUrl]);
  const models = React.useMemo(
    () => getModelsByProvider(chatProvider),
    [chatProvider],
  );
  const isPrivateRepo = verification?.repository.isPrivate ?? false;
  const hasEmbeddingKey = validProviders.includes(embeddingProvider);
  const hasChatKey = validProviders.includes(chatProvider);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [keysRes, meRes] = await Promise.all([
          client.keys.$get(),
          client.me.$get(),
        ]);

        if (keysRes.ok) {
          const data = await keysRes.json();
          if ("keys" in data && Array.isArray(data.keys)) {
            const configured = data.keys
              .filter((key) => key.status === "VALID")
              .map((key) => key.provider);
            setValidProviders(configured);
          }
        }

        if (meRes.ok) {
          const data = await meRes.json();
          if ("user" in data && data.user) {
            const provider = data.user.defaultChatProvider as
              ProviderId | undefined;
            if (provider) setChatProvider(provider);
            if (data.user.defaultChatModel)
              setChatModel(data.user.defaultChatModel);
            if (data.user.defaultEmbeddingProvider === "GEMINI")
              setEmbeddingProvider("GEMINI");
            if (data.user.defaultEmbeddingProvider === "OPENAI")
              setEmbeddingProvider("OPENAI");
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
        const response = await fetch(
          `${getApiBaseUrl()}/api/projects/${indexingSession.projectId}/indexing/status`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          if (!cancelled) timer = setTimeout(poll, 2000);
          return;
        }
        const data = (await response.json()) as {
          job?: IndexingSession | null;
        };
        if (cancelled || !data.job) return;
        setIndexingSession((current) =>
          current ? { ...current, ...data.job } : current,
        );
        if (data.job.status === "COMPLETED") {
          void refetch();
          setProjectId(indexingSession.projectId);
          router.push(`/wiki/${indexingSession.projectId}`);
          return;
        }
        if (data.job.status === "FAILED") {
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
    setBusyNotice(null);
  };

  const verifyRepository = async () => {
    const base = parsedRepo(repoUrl);
    if (!base) {
      setUrlError(
        "Please enter a valid GitHub repository URL (https://github.com/owner/repo).",
      );
      return;
    }

    setVerifying(true);
    setUrlError(null);
    resetVerification();

    try {
      const parts = new URL(base).pathname.split("/").filter(Boolean);
      const owner = parts[0] ?? "";
      const repo = parts[1] ?? "";
      const defaultBranch = "main";

      // Instant verification based on valid URL structure
      const fallbackData: Verification = {
        repository: {
          owner,
          repo,
          name: `${owner}/${repo}`,
          defaultBranch,
          isPrivate: false,
          sizeKb: 0,
          repoUrl: base,
        },
        existingWiki: null,
      };

      setVerification(fallbackData);
      setIsPublicWiki(true);

      // Restore cost estimation & timeline calculation
      setEstimating(true);
      void fetch(`${getApiBaseUrl()}/api/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          repoUrl: base,
          githubToken: githubToken || undefined,
          modelId: chatModel,
          embeddingModelId:
            embeddingProvider === "GEMINI"
              ? "gemini-embedding-001"
              : "text-embedding-3-small",
        }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { estimate?: Estimate };
          if (data.estimate) {
            setEstimate(data.estimate);
          }
        })
        .catch(() => {})
        .finally(() => {
          setEstimating(false);
        });
    } catch (err) {
      setUrlError("Please enter a valid GitHub repository URL.");
    } finally {
      setVerifying(false);
    }
  };

  const handleProviderChange = (value: string) => {
    const provider = value as ProviderId;
    setChatProvider(provider);
    setChatModel(getDefaultChatModel(provider));
  };

  const handleSubmit = async () => {
    if (!verification) {
      setUrlError("Verify the repository before generating its wiki.");
      return;
    }
    if (!hasEmbeddingKey) {
      toast.error(
        `Add an ${embeddingProvider} API key for vector embeddings in Settings.`,
      );
      return;
    }
    if (!hasChatKey) {
      toast.error(
        `Add an ${chatProvider} API key for chat generation in Settings.`,
      );
      return;
    }

    setIsSubmitting(true);
    setIndexingSession({
      projectId: "",
      status: "QUEUED",
      currentStep: "LOADING_REPO",
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
      const contentType = res.headers.get("content-type") ?? "";
      let data: {
        project?: { id: string };
        indexingJobId?: string | null;
        error?: string;
        code?: string;
        projectId?: string;
        reused?: boolean;
        status?: "READY" | "INDEXING";
        retryAt?: string;
      } = {};
      if (contentType.includes("application/json")) {
        data = (await res.json().catch(() => ({}))) as typeof data;
      } else {
        const text = await res.text().catch(() => "");
        throw new Error(
          text.slice(0, 100) || "Server returned an invalid response.",
        );
      }

      if (!res.ok) {
        if (data.code === "SERVER_BUSY") {
          setBusyNotice({
            message:
              data.error ??
              "The server is busy right now. Please try again shortly.",
            retryAt: data.retryAt,
          });
          setIndexingSession(null);
          setIsSubmitting(false);
          return;
        }
        if (data.code === "DUPLICATE_PROJECT" && data.projectId) {
          router.push(`/wiki/${data.projectId}`);
          return;
        }
        setIndexingSession(null);
        setIsSubmitting(false);
        throw new Error(data.error ?? "Could not create this wiki.");
      }

      const projectId = data.project?.id ?? data.projectId;
      if (data.reused && projectId) {
        toast.success(
          data.status === "INDEXING"
            ? "This public wiki is already being indexed."
            : "Opening the existing public wiki.",
        );
        router.push(`/wiki/${projectId}`);
        return;
      }
      toast.success("Wiki created. Indexing has started.");
      if (projectId) {
        setIndexingSession({
          projectId,
          jobId: data.indexingJobId,
          status: "QUEUED",
          currentStep: "LOADING_REPO",
        });
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setIsSubmitting(false);
      setIndexingSession(null);
      toast.error(
        err instanceof Error ? err.message : "Could not create this wiki.",
      );
    }
  };

  const estimatedMinutes = estimate
    ? Math.max(2, Math.ceil(estimate.files / 120))
    : null;
  const avgTokens = estimate
    ? Math.round((estimate.inputTokens.min + estimate.inputTokens.max) / 2)
    : null;

  if (indexingSession) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center px-4">
        <IndexingLoader
          step={indexingSession.currentStep}
          showCountdown={true}
        />
        {indexingSession.status === "FAILED" ? (
          <div className="mt-2 text-center">
            <p className="text-destructive text-sm">
              {indexingSession.errorMessage ??
                "Indexing failed. No wiki was generated."}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setIndexingSession(null)}
            >
              Back to setup
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          New Repository Wiki
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Turn a GitHub repository into a structured, source-cited wiki powered
          by your own API keys.
        </p>
      </div>

      {busyNotice ? (
        <ServerBusyNotice
          message={busyNotice.message}
          retryAt={busyNotice.retryAt}
          onRetry={() => {
            setBusyNotice(null);
            void handleSubmit();
          }}
        />
      ) : null}

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FolderGit2 className="text-primary size-4" />
            GitHub Repository
          </CardTitle>
          <CardDescription className="text-xs">
            Only the repository URL is required. The wiki name is derived
            automatically.
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
                  if (event.key === "Enter") void verifyRepository();
                }}
                className={cn(
                  "font-mono text-xs",
                  urlError &&
                    "border-destructive focus-visible:ring-destructive",
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
                {verifying ? "Verifying..." : "Verify repository"}
              </Button>
            </div>

            {urlError ? (
              <div className="text-destructive mt-1 flex items-start gap-1.5 text-xs font-medium">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{urlError}</span>
              </div>
            ) : repoBase && !verification ? (
              <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span>
                  URL format looks valid:{" "}
                  <strong className="text-foreground font-mono">
                    {repoBase}
                  </strong>
                </span>
              </div>
            ) : null}

            <p className="text-muted-foreground pt-0.5 text-[11px]">
              Example:{" "}
              <code className="font-mono">
                https://github.com/facebook/react
              </code>
              . RepoSense always documents the default branch.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              GitHub Personal Access Token{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
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
            <p className="text-muted-foreground text-[11px]">
              Encrypted at rest with AES-256-GCM and never returned to the
              browser.
            </p>
          </div>

          {verification ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span className="text-foreground truncate font-mono font-semibold">
                    {verification.repository.owner}/
                    {verification.repository.repo}
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
                    {verification.repository.isPrivate
                      ? "Private repo"
                      : "Public repo"}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-[10px]">
                  {Math.max(
                    1,
                    Math.round(verification.repository.sizeKb / 1024),
                  )}{" "}
                  MB on GitHub
                </span>
              </div>
            </div>
          ) : null}

          {verification?.existingWiki ? (
            <div className="border-primary/30 bg-primary/5 rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <BookOpen className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-xs font-semibold">
                    This repository already has a Public DeepWiki.
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Open the shared default-branch wiki instead of spending
                    resources indexing it again.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link href={`/wiki/${verification.existingWiki.id}`}>
                      <Button size="sm" className="h-7 gap-1.5 text-[11px]">
                        <BookOpen className="size-3" /> View existing wiki
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {verification && !verification.existingWiki ? (
        <>
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Coins className="text-primary size-4" />
                Estimated Indexing Cost
              </CardTitle>
              <CardDescription className="text-xs">
                {estimating
                  ? "Analyzing the repository tree and eligible source files..."
                  : "Calculated from filtered source files and current provider pricing. You pay your provider directly."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estimating ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-muted/30 h-20 animate-pulse rounded-lg border"
                    />
                  ))}
                </div>
              ) : estimate ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="bg-muted/20 rounded-lg border p-3">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <FileCode className="size-3" /> Files
                    </span>
                    <p className="text-foreground mt-1 text-lg font-bold">
                      {estimate.files}
                    </p>
                  </div>
                  <div className="bg-muted/20 rounded-lg border p-3">
                    <span className="text-muted-foreground text-[11px]">
                      Input tokens
                    </span>
                    <p className="text-foreground mt-1 text-sm font-semibold">
                      ~{avgTokens ? `${Math.round(avgTokens / 1000)}k` : "—"}
                    </p>
                  </div>
                  <div className="bg-muted/20 rounded-lg border p-3">
                    <span className="text-muted-foreground text-[11px]">
                      Est. cost
                    </span>
                    <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      ${estimate.estimatedCostUsd.min.toFixed(4)}–$
                      {estimate.estimatedCostUsd.max.toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-muted/20 rounded-lg border p-3">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <Clock className="size-3" /> Time
                    </span>
                    <p className="text-foreground mt-1 text-sm font-semibold">
                      ~{estimatedMinutes}–
                      {estimatedMinutes ? estimatedMinutes + 2 : 4} min
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Estimate unavailable. You can still generate the wiki.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Cpu className="text-primary size-4" />
                Models & Visibility
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-filled from your settings. Embedding dimensions are locked
                after the first index.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-muted/20 flex items-start justify-between gap-4 rounded-lg border border-[#ececec] p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    {isPrivateRepo ? (
                      <Lock className="text-muted-foreground size-3.5" />
                    ) : (
                      <Globe2 className="text-primary size-3.5" />
                    )}
                    {isPrivateRepo
                      ? "Private wiki"
                      : isPublicWiki
                        ? "Public wiki"
                        : "Private wiki"}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[11px] leading-4">
                    {isPrivateRepo
                      ? "Wikis for private repositories are always private."
                      : isPublicWiki
                        ? "Anyone can read this wiki from the Explore directory."
                        : "Only you and project members can open this wiki."}
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
                  <Select
                    value={chatProvider}
                    onValueChange={handleProviderChange}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAT_PROVIDERS.map((provider) => (
                        <SelectItem
                          key={provider}
                          value={provider}
                          className="text-xs"
                        >
                          {provider === "OPENAI"
                            ? "OpenAI"
                            : provider === "ANTHROPIC"
                              ? "Anthropic"
                              : provider === "GEMINI"
                                ? "Google Gemini"
                                : provider === "META"
                                  ? "Meta"
                                  : provider === "XAI"
                                    ? "xAI"
                                    : provider.charAt(0) +
                                      provider.slice(1).toLowerCase()}
                          {!validProviders.includes(provider)
                            ? " (key missing)"
                            : ""}
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
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          className="text-xs"
                        >
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Embedding provider
                  </Label>
                  {!hasEmbeddingKey ? (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertCircle className="size-2.5" /> Missing key
                    </Badge>
                  ) : null}
                </div>
                <Select
                  value={embeddingProvider}
                  onValueChange={(value) =>
                    setEmbeddingProvider(value as "OPENAI" | "GEMINI")
                  }
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
                <p className="text-muted-foreground text-[11px]">
                  Embedding provider and dimensions cannot change after indexing
                  without a full re-index.
                </p>
              </div>

              {!hasEmbeddingKey || !hasChatKey ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive space-y-1 rounded-lg border p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="size-3.5" />
                    API key required
                  </div>
                  <p className="text-[11px]">
                    Add {!hasEmbeddingKey ? `${embeddingProvider} ` : ""}
                    {!hasEmbeddingKey && !hasChatKey ? "and " : ""}
                    {!hasChatKey ? `${chatProvider} ` : ""}
                    keys in Settings before indexing.
                  </p>
                  <Link
                    href="/settings"
                    className="text-primary inline-block pt-0.5 font-semibold underline"
                  >
                    Open API keys & models
                  </Link>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t border-[#ececec] pt-4">
                <p className="text-muted-foreground text-[11px]">
                  Indexing runs in the background. You can close this tab.
                </p>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !hasEmbeddingKey || !hasChatKey}
                  className="gap-2 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Creating
                      wiki...
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
