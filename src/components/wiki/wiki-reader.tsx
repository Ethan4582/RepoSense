'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  FileCode2,
  FolderTree,
  GitPullRequest,
  Globe2,
  Loader2,
  Lock,
  Menu,
  Moon,
  RefreshCw,
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

interface WikiProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  isPublicWiki?: boolean;
  lastIndexedAt?: string | null;
  lastIndexedCommitSha?: string | null;
  chatModel?: string | null;
  chatProvider?: string | null;
  isPrivateRepo?: boolean;
  isOwner?: boolean;
  wikiPages: WikiPageMeta[];
}

interface IndexingJob {
  id: string;
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
  const wasIndexingRef = React.useRef(false);

  const [question, setQuestion] = React.useState('');
  const [qaOpen, setQaOpen] = React.useState(false);
  const [qaQuestion, setQaQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [scanning, setScanning] = React.useState<Array<{ filePath: string; startLine: number; endLine: number }>>([]);
  const [qaError, setQaError] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<ActiveFile | null>(null);

  const answerEndRef = React.useRef<HTMLDivElement | null>(null);
  const scanningRef = React.useRef<Array<{ filePath: string; startLine: number; endLine: number }>>([]);
  const articleRef = React.useRef<HTMLElement | null>(null);
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null);

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

      try {
        const publicRes = await fetch(`/api/public/projects/${projectId}`, { cache: 'no-store' });
        if (publicRes.ok) {
          const data = (await publicRes.json()) as { project: WikiProject };
          if (cancelled) return;
          setIsPublic(true);
          setProject({ ...data.project, isPublicWiki: true, isOwner: false });

          const first = data.project.wikiPages.find((p) => p.slug === 'overview') ?? data.project.wikiPages[0];
          setActiveSlug(first?.slug ?? null);
          setLoading(false);

          if (isSignedIn) {
            try {
              const ownerRes = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });
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

        const privateRes = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });
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
  }, [projectId, isSignedIn, reloadKey]);

  React.useEffect(() => {
    if (!activeSlug || !project) return;

    const localPage = project.wikiPages.find((page) => page.slug === activeSlug);
    if (isPublic) {
      setPageLoading(true);
      fetch(`/api/public/projects/${projectId}/pages/${activeSlug}`, { cache: 'no-store' })
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
  }, [activeSlug, project, isPublic, projectId]);

  React.useEffect(() => {
    if (!isSignedIn || !project?.isOwner) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/indexing/status`, { cache: 'no-store' });
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
  }, [isSignedIn, project?.isOwner, projectId]);

  React.useEffect(() => {
    answerEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [answer]);

  const sections = React.useMemo(() => (project ? groupSections(project.wikiPages) : []), [project]);

  const openCitation = (target: CitationTarget) => {
    setActiveFile(target);
  };

  const startReindex = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/indexing/start`, { method: 'POST' });
      const data = (await res.json()) as { job?: IndexingJob; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not start indexing.');
        return;
      }
      if (data.job) setIndexing(data.job);
      toast.success('Re-indexing started.');
    } catch {
      toast.error('Could not start indexing.');
    }
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
        const privateRes = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' });
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
        body: JSON.stringify({ question: text, threadId: threadId ?? undefined }),
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
            setAnswer((prev) => prev + payload.text);
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

  const lastIndexed = formatDate(project.lastIndexedAt);
  const shortSha = project.lastIndexedCommitSha?.slice(0, 6);
  const modelInfo = project.chatModel ? getModelInfo(project.chatModel) : undefined;
  const providerMeta = project.chatProvider
    ? PROVIDER_METADATA[project.chatProvider as ProviderId]
    : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <Link
            href={isSignedIn ? '/dashboard' : '/explore'}
            onMouseEnter={() => {
              if (isSignedIn) setAppNavOpen(true);
            }}
            className="flex shrink-0 items-center gap-1.5"
          >
            <div className="relative size-6 overflow-hidden rounded-md">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" priority />
            </div>
            <span className="hidden text-xs font-bold tracking-tight text-foreground sm:inline">
              Repo<span className="text-primary">Sense</span>
            </span>
          </Link>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs font-semibold text-foreground hover:text-primary"
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
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
          {project.isOwner && isSignedIn ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={startReindex}
              disabled={Boolean(indexing)}
            >
              <RefreshCw className={cn('size-3.5', indexing && 'animate-spin')} />
              <span className="hidden sm:inline">{indexing ? 'Indexing' : 'Re-index'}</span>
            </Button>
          ) : null}
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

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'absolute inset-y-14 left-0 z-30 w-72 shrink-0 overflow-y-auto border-r bg-sidebar p-3 transition-transform lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Wiki pages
            </span>
            <button type="button" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          <nav className="space-y-4">
            {sections.map(([sectionTitle, pages]) => (
              <div key={sectionTitle}>
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-foreground">
                  <FolderTree className="size-3 text-primary" />
                  {sectionTitle}
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
                          <span className="truncate">{page.title}</span>
                          {isActive ? <ChevronRight className="size-3 shrink-0" /> : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 z-20 bg-background/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {qaOpen ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
              <section className="min-h-0 overflow-y-auto border-r p-5 md:p-8">
                <button
                  type="button"
                  onClick={() => setQaOpen(false)}
                  className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Back to {project.name}
                </button>
                <h2 className="text-xl font-semibold leading-snug tracking-tight">{qaQuestion}</h2>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Sparkles className="size-3 text-primary" />
                  <span>{project.chatModel ?? 'BYOK model'}</span>
                </div>

                <div className="mt-6">
                  {qaError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {qaError}
                      {!isSignedIn ? (
                        <div className="mt-3">
                          <Link href="/sign-in">
                            <Button size="sm" className="h-7 text-xs">
                              Sign in to ask
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : answer ? (
                    <WikiMarkdown content={answer} onCitation={onTokenCitation} />
                  ) : (
                    <div className="space-y-2.5">
                      {[100, 92, 96, 78, 88].map((width, index) => (
                        <div
                          key={index}
                          className="h-3 animate-pulse rounded bg-muted"
                          style={{ width: `${width}%` }}
                        />
                      ))}
                    </div>
                  )}
                  {streaming ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin text-primary" />
                      Answering with your API key...
                    </div>
                  ) : null}
                  <div ref={answerEndRef} />
                </div>
              </section>

              <section className="min-h-0 overflow-hidden bg-muted/20 p-3 md:p-4">
                {activeFile ? (
                  <CodeViewer
                    projectId={projectId}
                    file={activeFile}
                    onClose={() => setActiveFile(null)}
                    className="h-full"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="w-full max-w-sm space-y-2">
                      {scanning.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" />
                          Scanning the codebase...
                        </div>
                      ) : (
                        scanning.map((file) => (
                          <button
                            key={file.filePath}
                            type="button"
                            onClick={() => setActiveFile(file)}
                            className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                          >
                            <FileCode2 className="size-3.5 shrink-0 text-primary" />
                            <span className="truncate">Scanning {file.filePath}</span>
                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
                              {file.startLine}-{file.endLine}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <article
                ref={articleRef}
                className="min-w-0 flex-1 overflow-y-auto px-5 pb-32 pt-6 md:px-10"
              >
                {pageLoading && !activePage?.content ? (
                  <div className="mx-auto max-w-3xl space-y-3">
                    <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  </div>
                ) : activePage?.content ? (
                  <div className="mx-auto max-w-3xl">
                    {activePage.relevantFiles && activePage.relevantFiles.length > 0 ? (
                      <details className="mb-6 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                        <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                          Relevant source files ({activePage.relevantFiles.length})
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {activePage.relevantFiles.map((path) => (
                            <button
                              key={path}
                              type="button"
                              onClick={() => setActiveFile({ filePath: path })}
                              className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              <FileCode2 className="size-2.5" />
                              {path}
                            </button>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {(activePage.headings?.length ?? 0) > 0 ? (
                      <details className="mb-6 rounded-lg border bg-muted/20 px-3 py-2 text-xs xl:hidden">
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
                    <WikiMarkdown content={activePage.content} onCitation={openCitation} />
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl rounded-xl border border-dashed p-10 text-center">
                    <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                    <h2 className="text-sm font-semibold">This wiki has no pages yet</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add your API key in Settings, then start indexing to generate documentation.
                    </p>
                    {project.isOwner && isSignedIn ? (
                      <Button className="mt-4 gap-2" size="sm" onClick={startReindex} disabled={Boolean(indexing)}>
                        <Sparkles className="size-3.5" />
                        Generate wiki
                      </Button>
                    ) : null}
                  </div>
                )}
              </article>

              <aside className="hidden w-56 shrink-0 overflow-y-auto border-l px-4 py-6 xl:block">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  On this page
                </div>
                <div className="space-y-1">
                  {(activePage?.headings ?? []).map((heading) => (
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
              </aside>
            </div>
          )}

          <div className="shrink-0 border-t bg-background/95 p-3 backdrop-blur md:p-4">
            <form
              onSubmit={askQuestion}
              className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm"
            >
              <Sparkles className="size-4 shrink-0 text-primary" />
              <div className="hidden shrink-0 items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-1 sm:flex">
                {providerMeta ? (
                  <div className="relative size-3.5">
                    <Image
                      src={providerMeta.logoAsset}
                      alt={providerMeta.displayName}
                      fill
                      className={cn('object-contain', providerMeta.id === 'XAI' && 'dark:invert')}
                    />
                  </div>
                ) : null}
                <span className="max-w-28 truncate text-[10px] font-medium text-muted-foreground">
                  {modelInfo?.name ?? project.chatModel ?? 'Default model'}
                </span>
                {modelInfo ? (
                  <span className="rounded bg-primary/10 px-1 text-[9px] font-semibold text-primary">
                    {modelInfo.tier}
                  </span>
                ) : null}
              </div>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={`Ask about ${project.repoOwner}/${project.repoName}...`}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                size="icon"
                className="size-7 shrink-0"
                disabled={!question.trim() || streaming}
              >
                {streaming ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </form>
            <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between px-1 text-[10px] text-muted-foreground">
              <span>Answers use your own API key and cite exact file lines.</span>
              {!isSignedIn ? (
                <Link href="/sign-in" className="font-medium text-primary hover:underline">
                  Sign in to ask
                </Link>
              ) : null}
            </div>
          </div>
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
