'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Check,
  FileCode2,
  FolderTree,
  GitBranch,
  GitPullRequest,
  Globe2,
  Loader2,
  Lock,
  Menu,
  Moon,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Share2,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { SidebarProvider } from '~/components/ui/sidebar';
import { AppSideBar } from '~/app/app-sidebar';
import { cn } from '~/lib/utils';
import { getModelInfo, PROVIDER_METADATA } from '~/lib/providers/catalog';
import type { ProviderId } from '~/lib/providers/types';
import { WikiMarkdown, type CitationTarget } from './markdown';
import { CodeViewer, type ActiveFile } from './code-viewer';
import { WikiComposer } from './wiki-composer';
import { WikiQaView } from './wiki-qa-view';
import { useSmoothStream } from '~/hooks/use-smooth-stream';

interface WikiPageMeta {
  id: string;
  slug: string;
  title: string;
  sectionTitle: string;
  sectionOrder: number;
  pageOrder: number;
  headings?: Array<{ id: string; text: string; level: number }> | null;
  content?: string;
  relevantFiles?: string[];
}

interface BranchSummary {
  branch: string;
  pageCount: number;
  updatedAt?: string | null;
  commitSha?: string | null;
}

interface WikiProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  isPublicWiki?: boolean;
  lastIndexedAt?: string | null;
  lastIndexedCommitSha?: string | null;
  defaultBranch?: string | null;
  lastIndexedBranch?: string | null;
  activeBranch?: string | null;
  branches?: BranchSummary[];
  chatModel?: string | null;
  chatProvider?: string | null;
  isPrivateRepo?: boolean;
  isOwner?: boolean;
  wikiPages: WikiPageMeta[];
}

interface IndexingJob {
  id: string;
  branch?: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStep: string;
  processedFiles: number;
  totalFiles: number;
  completedWikiPages: number;
  totalWikiPages: number;
  estimatedSecondsRemaining?: number | null;
  currentDetail?: string | null;
  errorMessage?: string | null;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupSections(pages: WikiPageMeta[]) {
  const map = new Map<string, WikiPageMeta[]>();
  for (const page of pages) {
    const list = map.get(page.sectionTitle) ?? [];
    list.push(page);
    map.set(page.sectionTitle, list);
  }
  return Array.from(map.entries());
}

export function WikiReader() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const branchParam = searchParams.get('branch');
  const prParam = searchParams.get('pr');
  const { isSignedIn } = useUser();

  const [project, setProject] = React.useState<WikiProject | null>(null);
  const [isPublic, setIsPublic] = React.useState(false);
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);
  const [activePage, setActivePage] = React.useState<WikiPageMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [appNavOpen, setAppNavOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [visibilityBusy, setVisibilityBusy] = React.useState(false);
  const [indexing, setIndexing] = React.useState<IndexingJob | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [branchInput, setBranchInput] = React.useState('');
  const [branchBusy, setBranchBusy] = React.useState(false);
  const wasIndexingRef = React.useRef(false);
  const activeBranch =
    branchParam ??
    project?.activeBranch ??
    project?.defaultBranch ??
    project?.lastIndexedBranch ??
    'main';

  const [question, setQuestion] = React.useState('');
  const [qaOpen, setQaOpen] = React.useState(false);
  const [qaQuestion, setQaQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [scanning, setScanning] = React.useState<Array<{ filePath: string; startLine: number; endLine: number }>>([]);
  const [qaError, setQaError] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<ActiveFile | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<string>('gpt-4o-mini');
  const [availableKeys, setAvailableKeys] = React.useState<string[]>([]);
  const smoothStream = useSmoothStream();

  React.useEffect(() => {
    if (qaOpen) setAnswer(smoothStream.text);
  }, [qaOpen, smoothStream.text]);

  React.useEffect(() => {
    if (project?.chatModel) {
      setSelectedModel(project.chatModel);
    }
  }, [project?.chatModel]);

  React.useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/keys')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { keys?: Array<{ provider: string }> };
        if (data.keys) {
          setAvailableKeys(data.keys.map((k) => k.provider));
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  const answerEndRef = React.useRef<HTMLDivElement | null>(null);
  const scanningRef = React.useRef<Array<{ filePath: string; startLine: number; endLine: number }>>([]);
  const articleRef = React.useRef<HTMLElement | null>(null);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null);

  // In-page Wiki Editing State
  const [isEditing, setIsEditing] = React.useState(searchParams.get('mode') === 'edit');
  const [editContent, setEditContent] = React.useState('');
  const [editTitle, setEditTitle] = React.useState('');
  const [isSavingPage, setIsSavingPage] = React.useState(false);

  React.useEffect(() => {
    if (activePage?.content !== undefined) {
      setEditContent(activePage.content ?? '');
      setEditTitle(activePage.title ?? '');
    }
  }, [activePage?.id, activePage?.content, activePage?.title]);

  React.useEffect(() => {
    const container = articleRef.current;
    if (!container) return;

    const update = () => {
      const headings = Array.from(
        container.querySelectorAll<HTMLElement>('h2[id], h3[id]')
      );
      const threshold = container.getBoundingClientRect().top + 96;
      let current = headings[0]?.id ?? null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading.id;
        else break;
      }
      setActiveHeadingId(current);
    };

    update();
    container.addEventListener('scroll', update, { passive: true });
    return () => container.removeEventListener('scroll', update);
  }, [activePage?.slug, activePage?.content]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const branchQuery = branchParam
        ? `?branch=${encodeURIComponent(branchParam)}`
        : '';

      try {
        const publicRes = await fetch(
          `/api/public/projects/${projectId}${branchQuery}`,
          { cache: 'no-store' }
        );
        if (publicRes.ok) {
          const data = (await publicRes.json()) as { project: WikiProject };
          if (cancelled) return;
          setIsPublic(true);
          setProject({ ...data.project, isPublicWiki: true, isOwner: false });

          const first = data.project.wikiPages.find((p) => p.slug === 'overview') ?? data.project.wikiPages[0];
          setActiveSlug(first?.slug ?? null);
          setActivePage(first ?? null);
          setLoading(false);

          if (isSignedIn) {
            try {
              const ownerRes = await fetch(
                `/api/projects/${projectId}${branchQuery}`,
                { cache: 'no-store' }
              );
              if (ownerRes.ok) {
                const ownerData = (await ownerRes.json()) as {
                  project: WikiProject;
                  isOwner?: boolean;
                };
                if (!cancelled) {
                  setProject((prev) =>
                        prev
                        ? {
                            ...prev,
                            isOwner: ownerData.isOwner ?? false,
                            isPrivateRepo: ownerData.project.isPrivateRepo,
                            branches: ownerData.project.branches ?? prev.branches,
                            activeBranch: ownerData.project.activeBranch ?? prev.activeBranch,
                          }
                        : prev
                  );
                }
              }
            } catch {
              // Ownership controls are optional.
            }
          }
          return;
        }

        const privateRes = await fetch(`/api/projects/${projectId}${branchQuery}`, {
          cache: 'no-store',
        });
        if (!privateRes.ok) {
          const message =
            privateRes.status === 404
              ? 'This wiki does not exist or is private.'
              : 'Unable to load this wiki.';
          throw new Error(message);
        }

        const data = (await privateRes.json()) as { project: WikiProject; isOwner?: boolean };
        if (cancelled) return;
        setIsPublic(false);
        setProject({ ...data.project, isOwner: data.isOwner ?? true });

        const first = data.project.wikiPages.find((p) => p.slug === 'overview') ?? data.project.wikiPages[0];
        setActiveSlug(first?.slug ?? null);
        setActivePage(first ?? null);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load this wiki.');
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, isSignedIn, reloadKey, branchParam]);

  React.useEffect(() => {
    if (!activeSlug || !project) return;

    const localPage = project.wikiPages.find((page) => page.slug === activeSlug);
    if (isPublic) {
      setPageLoading(true);
      fetch(
        `/api/public/projects/${projectId}/pages/${activeSlug}?branch=${encodeURIComponent(activeBranch)}`,
        { cache: 'no-store' }
      )
        .then(async (res) => {
          if (!res.ok) throw new Error('Unable to load page.');
          const data = (await res.json()) as { page: WikiPageMeta };
          setActivePage(data.page);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load page.'))
        .finally(() => setPageLoading(false));
    } else if (localPage) {
      setActivePage(localPage);
    }
  }, [activeSlug, project, isPublic, projectId, activeBranch]);

  React.useEffect(() => {
    if (!isSignedIn || !project?.isOwner) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/indexing/status?branch=${encodeURIComponent(activeBranch)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { job: IndexingJob | null };
        if (data.job && (data.job.status === 'QUEUED' || data.job.status === 'RUNNING')) {
          wasIndexingRef.current = true;
          setIndexing(data.job);
        } else {
          setIndexing(null);
          if (wasIndexingRef.current) {
            wasIndexingRef.current = false;
            setReloadKey((value) => value + 1);
          }
        }
      } catch {
        // ignore
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 3000);
    return () => clearInterval(timer);
  }, [isSignedIn, project?.isOwner, projectId, activeBranch]);

  React.useEffect(() => {
    answerEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [answer]);

  React.useEffect(() => {
    setThreadId(null);
    setQaOpen(false);
  }, [activeBranch]);

  const sections = React.useMemo(() => (project ? groupSections(project.wikiPages) : []), [project]);

  const openCitation = (target: CitationTarget) => {
    setActiveFile(target);
  };

  const switchBranch = (branch: string, pullRequestNumber?: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('branch', branch);
    if (pullRequestNumber) next.set('pr', String(pullRequestNumber));
    else next.delete('pr');

    setActiveSlug(null);
    setActivePage(null);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const startIndexing = async (target?: {
    branch?: string;
    pullRequestNumber?: number;
  }): Promise<boolean> => {
    setBranchBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/indexing/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: target?.branch,
          pullRequestNumber: target?.pullRequestNumber,
        }),
      });
      const data = (await res.json()) as { job?: IndexingJob; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not start indexing.');
        return false;
      }
      if (data.job) {
        setIndexing(data.job);
        if (data.job.branch && data.job.branch !== activeBranch) {
          switchBranch(data.job.branch, target?.pullRequestNumber);
        }
      }
      toast.success('Indexing started.');
      return true;
    } catch {
      toast.error('Could not start indexing.');
      return false;
    } finally {
      setBranchBusy(false);
    }
  };

  const startReindex = async () => {
    const pullRequestNumber =
      prParam && Number.isSafeInteger(Number(prParam)) ? Number(prParam) : undefined;
    await startIndexing({
      branch: pullRequestNumber ? undefined : activeBranch,
      pullRequestNumber,
    });
  };

  const indexRequestedBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = branchInput.trim();
    if (!value) return;

    const prMatch = /^#?(\d+)$/.exec(value);
    const pullRequestNumber = prMatch ? Number(prMatch[1]) : undefined;
    const ok = await startIndexing({
      branch: pullRequestNumber ? undefined : value,
      pullRequestNumber,
    });
    if (ok) setBranchInput('');
  };

  const updateVisibility = async (nextPublic: boolean) => {
    if (!project || visibilityBusy) return;
    setVisibilityBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublicWiki: nextPublic }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Could not update wiki visibility.');
      }

      if (!nextPublic) {
        setIsPublic(false);
        setProject((prev) => (prev ? { ...prev, isPublicWiki: false } : prev));
        const privateRes = await fetch(
          `/api/projects/${projectId}?branch=${encodeURIComponent(activeBranch)}`,
          { cache: 'no-store' }
        );
        if (privateRes.ok) {
          const data = (await privateRes.json()) as { project: WikiProject; isOwner?: boolean };
          setProject({ ...data.project, isOwner: data.isOwner ?? true });
        }
      } else {
        setIsPublic(true);
        setProject((prev) => (prev ? { ...prev, isPublicWiki: true } : prev));
      }

      toast.success(nextPublic ? 'Wiki is now public' : 'Wiki is now private');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update wiki visibility.');
    } finally {
      setVisibilityBusy(false);
    }
  };

  const saveEditedPage = async () => {
    if (!activePage || !project || isSavingPage) return;
    setIsSavingPage(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pages/${activePage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim() || activePage.title,
          content: editContent,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Failed to save page changes.');
      }

      const data = (await res.json()) as { page: WikiPageMeta };
      setActivePage(data.page);
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          wikiPages: prev.wikiPages.map((p) => (p.id === data.page.id ? { ...p, ...data.page } : p)),
        };
      });
      setIsEditing(false);
      toast.success('Page changes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save page changes.');
    } finally {
      setIsSavingPage(false);
    }
  };

  const askQuestion = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || streaming) return;

    if (!isSignedIn) {
      setQaOpen(true);
      setQaQuestion(text);
      setQaError('Sign in and configure your API key to ask interactive questions on this repository.');
      return;
    }

    setQaOpen(true);
    setQaQuestion(text);
    smoothStream.reset();
    setAnswer('');
    setScanning([]);
    scanningRef.current = [];
    setQaError(null);
    setActiveFile(null);
    setStreaming(true);
    setQuestion('');

    try {
      const res = await fetch(`/api/projects/${projectId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          threadId: threadId ?? undefined,
          branch: activeBranch,
          chatModel: selectedModel,
          chatProvider: getModelInfo(selectedModel)?.provider,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Could not answer this question.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const raw of events) {
          const line = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as
            | { type: 'thread'; threadId: string }
            | { type: 'scanning'; filePath: string; startLine: number; endLine: number }
            | { type: 'token'; text: string }
            | { type: 'error'; message: string }
            | { type: 'done' };

          if (payload.type === 'thread') {
            setThreadId(payload.threadId);
          } else if (payload.type === 'scanning') {
            if (!scanningRef.current.some((item) => item.filePath === payload.filePath)) {
              scanningRef.current = [...scanningRef.current, payload];
              setScanning(scanningRef.current);
            }
          } else if (payload.type === 'token') {
            smoothStream.push(payload.text);
            const firstScan = scanningRef.current[0];
            if (firstScan) {
              setActiveFile((prev) =>
                prev ?? {
                  filePath: firstScan.filePath,
                  startLine: firstScan.startLine,
                  endLine: firstScan.endLine,
                }
              );
            }
          } else if (payload.type === 'error') {
            setQaError(payload.message);
          }
        }
      }
      smoothStream.flush();
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Could not answer this question.');
    } finally {
      setStreaming(false);
    }
  };

  const onTokenCitation = (target: CitationTarget) => {
    setActiveFile(target);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        Loading wiki...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BookOpen className="size-10 text-muted-foreground/40" />
        <div>
          <h1 className="text-lg font-semibold">{error ?? 'Wiki not found'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Try exploring public wikis or adding a repository to your workspace.
          </p>
        </div>
        <Link href="/explore">
          <Button variant="outline" className="gap-2">
            <Globe2 className="size-4" />
            Explore public wikis
          </Button>
        </Link>
      </div>
    );
  }

  const branchInfo = project.branches?.find(
    (entry) => entry.branch === activeBranch
  );
  const lastIndexed = formatDate(branchInfo?.updatedAt ?? project.lastIndexedAt);
  const shortSha = (branchInfo?.commitSha ?? project.lastIndexedCommitSha)?.slice(0, 6);
  const modelInfo = project.chatModel ? getModelInfo(project.chatModel) : undefined;
  const providerMeta = project.chatProvider
    ? PROVIDER_METADATA[project.chatProvider as ProviderId]
    : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-[86px] shrink-0 items-center justify-between gap-3 border-b px-6 md:px-11">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-lg text-foreground hover:text-primary"
              >
                {project.repoOwner}/{project.repoName}
              </a>
              {isPublic ? (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600">
                  <Globe2 className="size-2.5" /> Public
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="size-2.5" /> Private
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {lastIndexed ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-2.5" />
                  Last indexed: {lastIndexed}
                  {shortSha ? ` (${shortSha})` : ''}
                </span>
              ) : (
                <span>Not indexed yet</span>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-44 items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground transition-colors hover:border-primary/40"
                    title="Switch branch"
                  >
                    <GitBranch className="size-2.5 shrink-0 text-primary" />
                    <span className="truncate">{activeBranch}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 space-y-2 p-2">
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Indexed branches
                  </div>
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {(project.branches ?? []).map((entry) => (
                      <button
                        key={entry.branch}
                        type="button"
                        onClick={() => switchBranch(entry.branch)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          entry.branch === activeBranch
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <GitBranch className="size-3 shrink-0" />
                        <span className="truncate font-mono">{entry.branch}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
                          {entry.pageCount} pages
                        </span>
                      </button>
                    ))}
                    {(project.branches ?? []).length === 0 ? (
                      <p className="px-2 py-2 text-[11px] text-muted-foreground">
                        No branches indexed yet.
                      </p>
                    ) : null}
                  </div>
                  {project.isOwner && isSignedIn ? (
                    <form
                      onSubmit={indexRequestedBranch}
                      className="space-y-1.5 border-t pt-2"
                    >
                      <label className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Index a branch or PR
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          value={branchInput}
                          onChange={(event) => setBranchInput(event.target.value)}
                          placeholder="feature/name or #42"
                          className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:border-primary/50"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 shrink-0 text-[11px]"
                          disabled={!branchInput.trim() || branchBusy}
                        >
                          {branchBusy ? <Loader2 className="size-3 animate-spin" /> : 'Index'}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {project.isOwner && isSignedIn ? (
            <Button
              variant={isEditing ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="h-8 gap-1.5 text-xs"
            >
              <Pencil className="size-3.5" />
              <span>{isEditing ? 'Reading Mode' : 'Edit Wiki'}</span>
            </Button>
          ) : null}
          <Link href={`/pulls?projectId=${project.id}`}>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <GitPullRequest className="size-3.5" />
              <span className="hidden sm:inline">Pull Requests</span>
            </Button>
          </Link>
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Share2 className="size-3.5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3 p-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Share this wiki</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isPublic
                    ? 'Anyone with the link can read this wiki.'
                    : 'Only you and project members can open this wiki.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={typeof window === 'undefined' ? '' : window.location.href}
                  className="min-w-0 flex-1 rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 text-[11px]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success('Wiki link copied');
                    } catch {
                      toast.error('Could not copy link');
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
              {project.isOwner && !project.isPrivateRepo ? (
                <div className="flex items-center justify-between gap-3 border-t pt-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {isPublic ? 'Public wiki' : 'Private wiki'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isPublic ? 'Listed in Explore' : 'Hidden from public view'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={visibilityBusy}
                    onClick={() => void updateVisibility(!isPublic)}
                  >
                    {visibilityBusy ? <Loader2 className="size-3 animate-spin" /> : null}
                    {isPublic ? 'Make private' : 'Make public'}
                  </Button>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Toggle theme"
            onClick={() => {
              const isDark = document.documentElement.classList.toggle('dark');
              try {
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
              } catch {}
            }}
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
        </div>
      </header>

      {indexing ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs text-foreground">
          <Sparkles className="size-3.5 animate-pulse text-primary" />
          <span className="font-medium">
            {indexing.currentDetail ??
              `${indexing.currentStep.replaceAll('_', ' ').toLowerCase()} — ${indexing.processedFiles}/${indexing.totalFiles} files`}
          </span>
          {indexing.estimatedSecondsRemaining ? (
            <span className="text-muted-foreground">
              ~{Math.ceil(indexing.estimatedSecondsRemaining / 60)} min remaining
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 overflow-hidden px-0 xl:px-11">
        <aside
          className="scrollbar-none z-20 hidden basis-[380px] w-[380px] max-w-[380px] shrink-0 overflow-y-auto border-r border-border/60 bg-sidebar/95 backdrop-blur-sm xl:block"
        >
          <div className="w-full px-10 py-10">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Wiki pages
              </span>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="size-3.5" />
              </button>
            </div>

            <nav className="space-y-4">
              {sections.map(([sectionTitle, pages]) => (
                <div key={sectionTitle}>
                  <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-foreground">
                    <FolderTree className="size-3 text-primary" />
                    {isEditing ? (
                      <input
                        value={sectionTitle}
                        onChange={(event) => {
                          setProject((current) => current ? { ...current, wikiPages: current.wikiPages.map((item) => item.sectionTitle === sectionTitle ? { ...item, sectionTitle: event.target.value } : item) } : current);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold outline-none"
                      />
                    ) : sectionTitle}
                  </div>
                  <div className="space-y-0.5">
                    {pages
                      .slice()
                      .sort((a, b) => a.pageOrder - b.pageOrder)
                      .map((page) => {
                        const isActive = page.slug === activeSlug;
                        return (
                          <button
                            key={page.slug}
                            type="button"
                            onClick={() => {
                              setActiveSlug(page.slug);
                              setSidebarOpen(false);
                              setQaOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                              isActive
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            {isEditing ? (
                              <input
                                value={page.title}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setProject((current) => current ? { ...current, wikiPages: current.wikiPages.map((item) => item.id === page.id ? { ...item, title: event.target.value } : item) } : current)}
                                className="min-w-0 flex-1 bg-transparent outline-none"
                              />
                            ) : <span className="truncate">{page.title}</span>}
                            {isActive ? <ChevronRight className="size-3 shrink-0" /> : null}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {qaOpen ? (
            <WikiQaView
              projectId={projectId}
              projectName={project.name}
              repoOwner={project.repoOwner}
              repoName={project.repoName}
              commitSha={project.lastIndexedCommitSha}
              activeBranch={activeBranch}
              question={qaQuestion}
              selectedModel={selectedModel}
              answer={answer}
              scanning={scanning}
              qaError={qaError}
              streaming={streaming}
              activeFile={activeFile}
              isSignedIn={Boolean(isSignedIn)}
              onBack={() => setQaOpen(false)}
              onCitation={onTokenCitation}
              onSelectFile={setActiveFile}
              answerEndRef={answerEndRef}
            />
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <article
                ref={articleRef}
                className="scrollbar-none min-w-0 flex-1 overflow-y-auto px-16 pb-36 pt-11"
              >
                {pageLoading && !activePage?.content ? (
                  <div className="mx-auto max-w-3xl space-y-3">
                    <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  </div>
                ) : activePage?.content ? (
                  <div className="max-w-[840px]">
                    {activePage.relevantFiles && activePage.relevantFiles.length > 0 ? (
                      <details className="mb-6 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                        <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                          Relevant source files ({activePage.relevantFiles.length})
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {activePage.relevantFiles.map((path) => (
                            <button
                              key={path}
                              type="button"
                              onClick={() => {
                                setActiveFile({ filePath: path });
                                setQaOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-border/80 bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                            >
                              <FileCode2 className="size-2.5 text-primary" />
                              {path}
                            </button>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {(activePage.headings?.length ?? 0) > 0 ? (
                      <details className="mb-6 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs xl:hidden">
                        <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                          On this page
                        </summary>
                        <div className="mt-2 space-y-1">
                          {(activePage.headings ?? []).map((heading) => (
                            <a
                              key={heading.id}
                              href={`#${heading.id}`}
                              className={cn(
                                'block border-l-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground',
                                heading.level === 2 ? 'pl-2 font-medium' : 'pl-4',
                                activeHeadingId === heading.id && 'border-primary text-foreground'
                              )}
                            >
                              {heading.text}
                            </a>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 border-b pb-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Page title"
                            className="w-full text-2xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 text-foreground"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditing(false);
                                setEditContent(activePage.content ?? '');
                                setEditTitle(activePage.title ?? '');
                              }}
                              className="h-8 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSavingPage}
                              onClick={() => void saveEditedPage()}
                              className="h-8 gap-1.5 text-xs"
                            >
                              {isSavingPage ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Save className="size-3.5" />
                              )}
                              <span>Save</span>
                            </Button>
                          </div>
                        </div>

                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Write markdown documentation here..."
                          rows={24}
                          className="w-full resize-y rounded-lg border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    ) : (
                      <WikiMarkdown
                        content={activePage.content}
                        onCitation={openCitation}
                        githubRepo={{ owner: project.repoOwner, repo: project.repoName }}
                        commitSha={project.lastIndexedCommitSha}
                      />
                    )}
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl rounded-xl border border-dashed p-10 text-center">
                    <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                    <h2 className="text-sm font-semibold">This wiki has no pages yet</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add your API key in Settings, then start indexing to generate documentation.
                    </p>
                    {project.isOwner && isSignedIn ? (
                      <Button className="mt-4 gap-2" size="sm" onClick={startReindex} disabled={Boolean(indexing) || branchBusy}>
                        <Sparkles className="size-3.5" />
                        Generate wiki
                      </Button>
                    ) : null}
                  </div>
                )}
              </article>

              <aside className="scrollbar-none hidden w-[350px] shrink-0 overflow-y-auto border-l border-border/60 px-8 py-16 xl:block">
                <div className="mb-4 text-xl font-medium tracking-tight text-foreground">
                  On this page
                </div>
                <div className="space-y-1">
                  {(activePage?.headings ?? []).map((heading) => (
                    isEditing ? (
                    <input
                      key={heading.id}
                      value={heading.text}
                      onChange={(event) => setEditContent((value) => value.replace(new RegExp(`^(#{${heading.level}}\\s+)${heading.text.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'm'), `$1${event.target.value}`))}
                      className="mb-1 w-full border-l-2 border-primary/40 bg-transparent py-0.5 pl-2 text-[11px] outline-none"
                    />
                    ) : <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={cn(
                        'block border-l-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground',
                        heading.level === 2 ? 'pl-2 font-medium' : 'pl-4',
                        activeHeadingId === heading.id && 'border-primary text-foreground'
                      )}
                    >
                      {heading.text}
                    </a>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {/* Floating Translucent WikiComposer */}
          <WikiComposer
            question={question}
            onQuestionChange={setQuestion}
            onSubmit={() => void askQuestion()}
            streaming={streaming}
            repoName={`${project.repoOwner}/${project.repoName}`}
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            availableKeys={availableKeys}
            placeholder={qaOpen ? 'Ask a follow-up question...' : undefined}
          />
        </main>
      </div>

      {isSignedIn ? (
        <>
          <button
            type="button"
            aria-label="Open app navigation"
            className="fixed inset-y-0 left-0 z-40 hidden w-2 md:block"
            onMouseEnter={() => setAppNavOpen(true)}
          />
          {appNavOpen ? (
            <div
              className="fixed inset-y-0 left-0 z-50 hidden w-64 shadow-2xl md:block"
              onMouseLeave={() => setAppNavOpen(false)}
              onClick={() => setAppNavOpen(false)}
            >
              <SidebarProvider defaultOpen className="h-full min-h-0">
                <AppSideBar />
              </SidebarProvider>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
