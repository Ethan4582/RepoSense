'use client';

import { getApiBaseUrl } from '~/lib/api-client';


import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  BookOpen,
  ChevronRight,
  Check,
  FileCode2,
  FolderTree,
  GitBranch,
  GitPullRequest,
  Globe2,
  Loader2,
  Moon,
  PanelLeft,
  Pencil,
  Save,
  Share2,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
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
import { IndexingLoader } from '~/components/indexing-loader';

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
  updatedAt?: string | null;
  createdAt?: string | null;
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
  const questionIdParam = searchParams.get('questionId');
  const { isSignedIn } = useUser();

  const [project, setProject] = React.useState<WikiProject | null>(null);
  const [isPublic, setIsPublic] = React.useState(false);
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);
  const [activePage, setActivePage] = React.useState<WikiPageMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
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
    if (qaOpen && streaming) setAnswer(smoothStream.text);
  }, [qaOpen, streaming, smoothStream.text]);

  React.useEffect(() => {
    if (!questionIdParam || !projectId) return;

    const loadQuestion = async () => {
      try {
        let res = await fetch(`${getApiBaseUrl()}/api/public/projects/${projectId}/questions/${questionIdParam}`);
        if (!res.ok) {
          res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/questions/${questionIdParam}`, {
            credentials: 'include',
          });
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          question?: {
            id: string;
            question: string;
            answers: string;
            fileReference?: unknown;
          };
        };
        if (data.question) {
          setQaOpen(true);
          setQaQuestion(data.question.question);
          setAnswer(data.question.answers);
          setStreaming(false);
          setThreadId(data.question.id);

          const rawRef = data.question.fileReference;
          let parsedScans: Array<{ filePath: string; startLine: number; endLine: number }> = [];
          if (Array.isArray(rawRef)) {
            parsedScans = rawRef.map((f: { fileName?: string; sourceCode?: string }) => ({
              filePath: f.fileName ?? '',
              startLine: 1,
              endLine: 1,
            })).filter((f) => Boolean(f.filePath));
          } else if (rawRef && typeof rawRef === 'object' && Array.isArray((rawRef as { citations?: Array<{ fileName?: string }> }).citations)) {
            parsedScans = (rawRef as { citations: Array<{ fileName?: string }> }).citations
              .map((f) => ({ filePath: f.fileName ?? '', startLine: 1, endLine: 1 }))
              .filter((f) => Boolean(f.filePath));
          }
          if (parsedScans.length > 0) {
            setScanning(parsedScans);
            setActiveFile({ filePath: parsedScans[0]!.filePath, startLine: parsedScans[0]!.startLine, endLine: parsedScans[0]!.endLine });
          }
        }
      } catch {
        // Fallback or network error
      }
    };
    void loadQuestion();
  }, [questionIdParam, projectId]);

  React.useEffect(() => {
    if (project?.chatModel) {
      setSelectedModel(project.chatModel);
    }
  }, [project?.chatModel]);

  React.useEffect(() => {
    if (!isSignedIn) return;
    fetch(`${getApiBaseUrl()}/api/keys`)
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

  const [isEditing, setIsEditing] = React.useState(searchParams.get('mode') === 'edit');
  const [editContent, setEditContent] = React.useState('');
  const [editTitle, setEditTitle] = React.useState('');
  const [editHeadings, setEditHeadings] = React.useState<Array<{ id: string; text: string; level: number }>>([]);
  const [isSavingPage, setIsSavingPage] = React.useState(false);

  React.useEffect(() => {
    if (activePage?.content !== undefined) {
      setEditContent(activePage.content ?? '');
      setEditTitle(activePage.title ?? '');
      setEditHeadings(activePage.headings ? [...activePage.headings] : []);
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

  const scrollToHeading = React.useCallback((id: string) => {
    const container = articleRef.current;
    if (!container) return;

    // Search by exact id, or by slug/text fallback
    let target = document.getElementById(id);
    if (!target) {
      const allHeadings = Array.from(container.querySelectorAll<HTMLElement>('h2, h3'));
      target = allHeadings.find((el) => el.id === id || el.textContent?.trim().toLowerCase() === id.replace(/-/g, ' ')) ?? null;
    }

    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetOffsetTop = targetRect.top - containerRect.top + container.scrollTop - 28;

    container.scrollTo({ top: Math.max(0, targetOffsetTop), behavior: 'smooth' });
    setActiveHeadingId(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const branchQuery = branchParam
        ? `?branch=${encodeURIComponent(branchParam)}`
        : '';

      try {
        const publicRes = await fetch(`${getApiBaseUrl()}/api/public/projects/${projectId}${branchQuery}`,
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
              const ownerRes = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}${branchQuery}`,
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

        const privateRes = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}${branchQuery}`, {
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
      fetch(`${getApiBaseUrl()}/api/public/projects/${projectId}/pages/${activeSlug}?branch=${encodeURIComponent(activeBranch)}`,
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
        const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/indexing/status?branch=${encodeURIComponent(activeBranch)}`,
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
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/indexing/start`, {
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
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
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
        const privateRes = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}?branch=${encodeURIComponent(activeBranch)}`,
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
      // 1. Save currently edited page content & title
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/pages/${activePage.id}`, {
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

      // 2. Persist any sectionTitle or page title updates across the wiki
      const updatedPagesPayload = project.wikiPages.map((p) => ({
        id: p.id,
        sectionTitle: p.sectionTitle,
        sectionOrder: p.sectionOrder,
        pageOrder: p.pageOrder,
      }));

      await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/pages/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: updatedPagesPayload }),
      }).catch(() => {});

      setActivePage(data.page);
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          wikiPages: prev.wikiPages.map((p) => (p.id === data.page.id ? { ...p, ...data.page } : p)),
        };
      });
      setIsEditing(false);
      toast.success('Page and section changes saved');
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

    const qaStartTime = Date.now();
    const MIN_LOADER_MS = 1400; // Uniform minimum duration to enjoy the animation

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/qa`, {
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

      // Wait if response arrived faster than MIN_LOADER_MS
      const elapsed = Date.now() - qaStartTime;
      if (elapsed < MIN_LOADER_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADER_MS - elapsed));
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
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('questionId', payload.threadId);
            window.history.replaceState(null, '', currentUrl.toString());
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
          } else if (payload.type === 'done' && 'questionId' in payload && (payload as { questionId?: string }).questionId) {
            const qId = (payload as { questionId?: string }).questionId!;
            setThreadId(qId);
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('questionId', qId);
            window.history.replaceState(null, '', currentUrl.toString());
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
      <div className="flex h-screen items-center justify-center bg-background">
        <IndexingLoader step="LOADING_REPO" />
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

  const displayHeadings = isEditing ? editHeadings : (activePage?.headings ?? []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* -- Header -- */}
      <header
        className="relative flex h-[64px] shrink-0 items-center justify-center border-b border-dashed border-neutral-300 dark:border-neutral-700/80 px-6 sm:px-[64px]"
      >
        <div className="flex h-full w-full max-w-[1440px] items-center justify-between border-x border-dashed border-neutral-300 dark:border-neutral-700/80 px-7">
          {/* Left brand segment */}
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <img src="/logo.png" alt="RepoSense" className="size-6 rounded-md object-contain" />
              <span className="text-[17px] font-semibold tracking-tight text-foreground">
                RepoSense
              </span>
            </Link>
            <span className="text-muted-foreground/30 font-light">/</span>
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[15px] font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              {project.repoName}
            </a>
          </div>

          {/* Right actions segment */}
          <div className="flex items-center gap-2.5">
            {project.isOwner && isSignedIn ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-8 rounded-[8px] border-border/60 px-3 text-xs font-medium text-foreground hover:bg-muted/40"
              >
                <Pencil className="mr-1.5 size-3.5" />
                <span>{isEditing ? 'Reading Mode' : 'Edit Wiki'}</span>
              </Button>
            ) : null}
            <Link href={`/pulls?projectId=${project.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[8px] border-border/60 px-3 text-xs font-medium text-foreground hover:bg-muted/40"
              >
                <GitPullRequest className="mr-1.5 size-3.5" />
                <span className="hidden sm:inline">Pull Requests</span>
              </Button>
            </Link>
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 rounded-[8px] border-none bg-[#2563eb] px-3.5 text-xs font-medium text-white shadow-xs hover:bg-[#1d4ed8] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb]"
                >
                  <Share2 className="mr-1.5 size-3.5" />
                  <span>Share</span>
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
          </div>
        </div>
      </header>

      {/* -- Indexing progress banner -- */}
      {indexing ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-dashed border-border/30 bg-muted/30 px-4 py-2 text-xs text-foreground">
          <Sparkles className="size-3.5 animate-pulse text-muted-foreground" />
          <span className="font-medium">
            {indexing.currentDetail ??
              `${indexing.currentStep.replaceAll('_', ' ').toLowerCase()} � ${indexing.processedFiles}/${indexing.totalFiles} files`}
          </span>
          {indexing.estimatedSecondsRemaining ? (
            <span className="text-muted-foreground">
              ~{Math.ceil(indexing.estimatedSecondsRemaining / 60)} min remaining
            </span>
          ) : null}
        </div>
      ) : null}

      {/* -- Body: Symmetric Outer Frame with dashed hairlines, separated by spacing -- */}
      <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden px-6 sm:px-[64px]">
        <div className="flex min-h-0 w-full max-w-[1440px] flex-1 overflow-hidden border-x border-dashed border-neutral-300 dark:border-neutral-700/80">

          {/* Left column: Wiki Navigation with matching border intersecting the header line */}
          {!qaOpen ? (
            <aside className="scrollbar-none z-10 hidden w-[300px] shrink-0 overflow-y-auto border-r border-dashed border-neutral-300 dark:border-neutral-700/80 px-7 py-7 md:block">
              <div className="mb-5">
                <div className="text-[12px] font-normal text-muted-foreground">
                  {activePage?.updatedAt
                    ? `Last edited: ${new Date(activePage.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : project.lastIndexedAt
                      ? `Last indexed: ${new Date(project.lastIndexedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Documentation'}
                </div>
              </div>

              <nav className="space-y-6">
                {sections.map(([sectionTitle, pages]) => (
                  <div key={sectionTitle} className="space-y-2">
                    <div className="text-[15px] font-semibold text-foreground">
                      {isEditing ? (
                        <input
                          value={sectionTitle}
                          onChange={(event) => {
                            setProject((current) => current ? { ...current, wikiPages: current.wikiPages.map((item) => item.sectionTitle === sectionTitle ? { ...item, sectionTitle: event.target.value } : item) } : current);
                          }}
                          className="min-w-0 w-full bg-transparent text-[15px] font-semibold outline-none"
                        />
                      ) : sectionTitle}
                    </div>
                    <div className="space-y-1">
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
                                setSidebarOpen(true);
                                setQaOpen(false);
                              }}
                              className={cn(
                                'relative flex w-full items-center justify-between rounded-md py-2 pr-3 pl-3 text-left text-[15px] transition-all duration-150',
                                isActive
                                  ? 'bg-neutral-100/80 font-medium text-foreground dark:bg-neutral-800/50'
                                  : 'text-foreground/70 hover:bg-neutral-100/40 hover:text-foreground dark:hover:bg-neutral-800/30'
                              )}
                            >
                              {isActive ? (
                                <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-[#2563eb] dark:bg-[#3b82f6]" />
                              ) : null}
                              {isEditing ? (
                                <input
                                  value={page.title}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => setProject((current) => current ? { ...current, wikiPages: current.wikiPages.map((item) => item.id === page.id ? { ...item, title: event.target.value } : item) } : current)}
                                  className="min-w-0 w-full bg-transparent text-[15px] outline-none"
                                />
                              ) : (
                                <span className="line-clamp-2 leading-snug">{page.title}</span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>
          ) : null}

          {/* Main content column: 880px to 920px max width, centered with 48px to 64px empty gutters */}
          <main
            style={{ transition: 'all 200ms ease' }}
            className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
          >
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
                onBack={() => {
                  setQaOpen(false);
                  const currentUrl = new URL(window.location.href);
                  currentUrl.searchParams.delete('questionId');
                  window.history.replaceState(null, '', currentUrl.toString());
                }}
                onCitation={onTokenCitation}
                onSelectFile={setActiveFile}
                answerEndRef={answerEndRef}
                composerProps={{
                  question,
                  onQuestionChange: setQuestion,
                  onSubmit: () => void askQuestion(),
                  streaming,
                  repoName: `${project.repoOwner}/${project.repoName}`,
                  selectedModel,
                  onModelSelect: setSelectedModel,
                  availableKeys,
                }}
              />
            ) : (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* Documentation article � scrollable, centered with 48px to 64px empty gutters on each side */}
                <article
                  ref={articleRef}
                  className="scrollbar-none min-w-0 flex-1 overflow-y-auto px-[clamp(24px,4vw,56px)] pt-10 pb-[136px]"
                >
                  <div className="mx-auto w-full max-w-[900px]">
                    {indexing && (!activePage?.content || project.wikiPages.length === 0) ? (
                      <div className="flex min-h-[380px] w-full items-center justify-center py-16">
                        <IndexingLoader step={indexing.currentStep} detail={indexing.currentDetail} />
                      </div>
                    ) : pageLoading && !activePage?.content ? (
                      <div className="flex min-h-[380px] w-full items-center justify-center py-16">
                        <IndexingLoader step="LOADING_REPO" />
                      </div>
                    ) : activePage?.content ? (
                      <>
                        {activePage.relevantFiles && activePage.relevantFiles.length > 0 ? (
                          <details className="group mb-6 rounded-lg border border-border/40 bg-muted/10 px-4 py-2.5 text-xs transition-colors hover:bg-muted/20">
                            <summary className="flex cursor-pointer select-none items-center gap-2 text-[14px] font-normal text-muted-foreground transition-colors hover:text-foreground">
                              <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
                              <span>Relevant source files</span>
                              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {activePage.relevantFiles.length}
                              </span>
                            </summary>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {activePage.relevantFiles.map((path) => (
                                <button
                                  key={path}
                                  type="button"
                                  onClick={() => {
                                    setActiveFile({ filePath: path });
                                    setQaOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2.5 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:border-neutral-400 hover:text-foreground dark:hover:border-neutral-600"
                                >
                                  <FileCode2 className="size-3 shrink-0" />
                                  {path}
                                </button>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        {/* Mobile ToC (hidden on desktop) */}
                        {(activePage.headings?.length ?? 0) >= 2 ? (
                          <details className="mb-6 rounded-lg border border-border/40 bg-muted/10 px-4 py-2.5 text-xs xl:hidden">
                            <summary className="cursor-pointer select-none text-[14px] font-medium text-foreground">
                              On this page
                            </summary>
                            <div className="mt-3 space-y-2">
                              {(activePage.headings ?? []).map((heading) => (
                                <a
                                  key={heading.id}
                                  href={`#${heading.id}`}
                                  onClick={(event) => { event.preventDefault(); scrollToHeading(heading.id); }}
                                  className={cn(
                                    'block text-[14px] text-muted-foreground transition-colors hover:text-foreground',
                                    heading.level === 2 ? 'font-medium' : 'pl-3 text-[13px]',
                                    activeHeadingId === heading.id && 'font-medium text-foreground'
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
                            <div className="flex items-center justify-between gap-3 border-b pb-4">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Page title"
                                className="w-full bg-transparent text-[30px] font-bold leading-tight tracking-tight text-foreground outline-none"
                              />
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setIsEditing(false);
                                    setEditContent(activePage.content ?? '');
                                    setEditTitle(activePage.title ?? '');
                                    setEditHeadings(activePage.headings ? [...activePage.headings] : []);
                                  }}
                                  className="h-9 rounded-[8px] text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isSavingPage}
                                  onClick={() => void saveEditedPage()}
                                  className="h-9 gap-1.5 rounded-[8px] bg-[#2563eb] text-xs text-white hover:bg-[#1d4ed8] dark:bg-[#3b82f6]"
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
                              rows={28}
                              className="w-full resize-y rounded-lg border border-border/50 bg-muted/10 p-4 font-mono text-sm leading-relaxed text-foreground outline-none focus:border-border"
                            />
                          </div>
                        ) : (
                          <WikiMarkdown
                            content={activePage.content}
                            onCitation={openCitation}
                            githubRepo={{ owner: project.repoOwner, repo: project.repoName }}
                            commitSha={project.lastIndexedCommitSha}
                            branch={activeBranch}
                          />
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/40 p-12 text-center">
                        <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                        <h2 className="text-base font-semibold">This wiki has no pages yet</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add your API key in Settings, then start indexing to generate documentation.
                        </p>
                        {project.isOwner && isSignedIn ? (
                          <Button className="mt-4 gap-2 bg-[#2563eb] text-white hover:bg-[#1d4ed8] dark:bg-[#3b82f6]" size="sm" onClick={startReindex} disabled={Boolean(indexing) || branchBusy}>
                            <Sparkles className="size-3.5" />
                            Generate wiki
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </article>

                {/* Floating composer � pinned to bottom of content column */}
                <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-30 flex justify-center px-4 min-[1100px]:right-[280px]">
                  <div className="pointer-events-auto w-full max-w-[900px]">
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
                  </div>
                </div>

                {/* Right "On this page" panel: 280px wide with no left line */}
                {displayHeadings.length >= 2 ? (
                  <aside
                    className="scrollbar-none hidden w-[280px] shrink-0 overflow-y-auto p-6 min-[1100px]:block"
                  >
                    <div className="sticky top-6">
                      <div className="mb-4 text-[20px] font-bold text-foreground">
                        On this page
                      </div>
                      <div className="space-y-[14px]">
                        {displayHeadings.map((heading, idx) =>
                          isEditing ? (
                            <input
                              key={heading.id}
                              value={heading.text}
                              onChange={(event) => {
                                const newText = event.target.value;
                                setEditHeadings((prev) => prev.map((h, i) => i === idx ? { ...h, text: newText } : h));
                                setEditContent((value) =>
                                  value.replace(
                                    new RegExp(`^(#{${heading.level}}\\s+)${heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
                                    `$1${newText}`
                                  )
                                );
                              }}
                              className={cn(
                                'w-full bg-transparent text-[15px] text-muted-foreground outline-none',
                                heading.level === 3 ? 'pl-[14px]' : ''
                              )}
                            />
                          ) : (
                            <a
                              key={heading.id}
                              href={`#${heading.id}`}
                              onClick={(event) => { event.preventDefault(); scrollToHeading(heading.id); }}
                              className={cn(
                                'relative block text-[15px] transition-colors',
                                heading.level === 3 ? 'pl-[14px]' : '',
                                activeHeadingId === heading.id
                                  ? 'font-medium text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {activeHeadingId === heading.id ? (
                                <span className="absolute -left-3 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#2563eb] dark:bg-[#3b82f6]" />
                              ) : null}
                              {heading.text}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            )}
        </main>
      </div>

      {/* Code Viewer Drawer / Overlay when citation or file is clicked */}
      {activeFile && !qaOpen ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200">
          <div className="flex h-full flex-col">
            <CodeViewer
              projectId={projectId}
              branch={activeBranch}
              file={activeFile}
              onClose={() => setActiveFile(null)}
              className="h-full border-none shadow-none"
            />
          </div>
        </div>
      ) : null}
    </div>

      {/* App nav hover zone */}
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
