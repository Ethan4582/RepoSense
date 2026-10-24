'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import useProject from '~/hooks/use-project';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  isDraft: boolean;
  authorName: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  branchName: string;
  baseBranch: string;
  body?: string | null;
  labels: string[];
  mergedAt: string | null;
}

type Filter = 'all' | 'open' | 'merged' | 'closed';

function prStatus(pr: PullRequest): 'open' | 'merged' | 'closed' {
  if (pr.mergedAt) return 'merged';
  return pr.state;
}

function statusStyles(status: 'open' | 'merged' | 'closed') {
  if (status === 'open') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (status === 'merged') return 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400';
  return 'border-border bg-muted text-muted-foreground';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PullRequestsPage() {
  const router = useRouter();
  const { projectId, project, projects, setProjectId } = useProject();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [search, setSearch] = React.useState('');
  const [pullRequests, setPullRequests] = React.useState<PullRequest[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = React.useState(0);
  const [generating, setGenerating] = React.useState<number | null>(null);

  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('projectId');
    if (requested && requested !== projectId) setProjectId(requested);
  }, [projectId, setProjectId]);

  React.useEffect(() => {
    if (!projectId) {
      setPullRequests([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/pulls`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as { pullRequests?: PullRequest[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Could not load pull requests.');
        return data.pullRequests ?? [];
      })
      .then((items) => {
        if (!cancelled) setPullRequests(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load pull requests.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const counts = React.useMemo(() => {
    return {
      all: pullRequests.length,
      open: pullRequests.filter((pr) => prStatus(pr) === 'open').length,
      merged: pullRequests.filter((pr) => prStatus(pr) === 'merged').length,
      closed: pullRequests.filter((pr) => prStatus(pr) === 'closed').length,
    };
  }, [pullRequests]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return pullRequests.filter((pr) => {
      const status = prStatus(pr);
      if (filter !== 'all' && status !== filter) return false;
      if (!term) return true;
      return (
        pr.title.toLowerCase().includes(term) ||
        pr.authorName.toLowerCase().includes(term) ||
        pr.branchName.toLowerCase().includes(term) ||
        String(pr.number).includes(term) ||
        pr.labels.some((label) => label.toLowerCase().includes(term))
      );
    });
  }, [pullRequests, filter, search]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateDocs = async (pr: PullRequest) => {
    if (!projectId || generating !== null) return;
    setGenerating(pr.number);

    try {
      const res = await fetch(`/api/projects/${projectId}/indexing/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: pr.branchName,
          pullRequestNumber: pr.number,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not start indexing.');

      toast.success(`Generating docs for #${pr.number}.`);
      router.push(
        `/wiki/${projectId}?branch=${encodeURIComponent(pr.branchName)}&pr=${pr.number}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start indexing.');
      setGenerating(null);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <GitPullRequest className="size-6 text-primary" />
            Pull Requests
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Native GitHub pull requests for{' '}
            <strong className="text-foreground">
              {project ? `${project.repoOwner}/${project.repoName}` : 'your repositories'}
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={projectId ?? undefined}
            onValueChange={(value) => setProjectId(value)}
          >
            <SelectTrigger className="h-8 min-w-[200px] max-w-[280px] gap-2 rounded-md border border-[#e0e0e0] bg-background text-xs transition-colors duration-200 ease-out hover:border-[#d4d4d4]">
              <GitPullRequest className="size-3.5 shrink-0 text-primary" />
              <SelectValue placeholder="Select repository" />
            </SelectTrigger>
            <SelectContent align="end">
              {(projects ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id} className="text-xs">
                  {item.repoOwner}/{item.repoName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {project ? (
            <a href={`${project.repoUrl}/pulls`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="icon" className="size-8 rounded-md border-[#e0e0e0] hover:border-[#d4d4d4]" title="View on GitHub">
                <ExternalLink className="size-3.5" />
              </Button>
            </a>
          ) : null}

          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-md border-[#e0e0e0] hover:border-[#d4d4d4]"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading || !projectId}
            title="Refresh pull requests"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg border border-[#e0e0e0] bg-muted/30 p-1 text-xs">
          {(['all', 'open', 'merged', 'closed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-md px-3 py-1 font-medium capitalize transition-colors',
                filter === value
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {value} ({counts[value]})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search PRs, authors, labels..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 rounded-md border-[#e0e0e0] bg-muted/20 pl-8 text-xs transition-colors duration-200 ease-out hover:border-[#d4d4d4]"
          />
        </div>
      </div>

      {!projectId ? (
        <div className="rounded-md border border-dashed border-[#e5e5e5] p-12 text-center">
          <GitPullRequest className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <h2 className="text-sm font-semibold">No repository selected</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Link a repository to view its native pull requests.
          </p>
          <Link href="/create">
            <Button size="sm" className="mt-4">Link repository</Button>
          </Link>
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : loading && pullRequests.length === 0 ? (
        <div className="flex h-56 items-center justify-center gap-2 rounded-md border border-[#e5e5e5] text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Fetching pull requests from GitHub...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#e5e5e5] p-12 text-center">
          <GitPullRequest className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <h2 className="text-sm font-semibold">No pull requests found</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? 'No PRs match your search.' : 'This repository has no matching pull requests.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f0f0] overflow-hidden rounded-md border border-[#e5e5e5] bg-card transition-colors duration-200 ease-out hover:border-[#d4d4d4]">
          {filtered.map((pr) => {
            const status = prStatus(pr);
            const isExpanded = expanded.has(pr.id);

            return (
              <div key={pr.id} className="transition-colors hover:bg-muted/20">
                <button
                  type="button"
                  onClick={() => toggleExpanded(pr.id)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2337ff] focus-visible:ring-offset-2"
                >
                  <span className="mt-1 shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        #{pr.number}
                      </span>
                      <span className="line-clamp-1 text-sm font-medium text-foreground">{pr.title}</span>
                      {pr.isDraft ? (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Draft</Badge>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {status === 'merged' ? (
                          <GitMerge className="size-3 text-violet-500" />
                        ) : (
                          <GitPullRequest className="size-3" />
                        )}
                        <span className="capitalize">{status}</span>
                      </span>
                      <span className="font-mono">
                        {pr.branchName} → {pr.baseBranch}
                      </span>
                      <span>{formatDate(pr.createdAt)}</span>
                    </div>

                    {pr.labels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pr.labels.map((label) => (
                          <Badge key={label} variant="secondary" className="text-[9px] font-normal">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant="outline" className={cn('text-[10px] font-semibold capitalize', statusStyles(status))}>
                      {status}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Avatar className="size-4">
                        <AvatarImage src={pr.authorAvatar} />
                        <AvatarFallback className="bg-primary/10 text-[8px] text-primary">
                          {pr.authorName[0]?.toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {pr.authorName}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="bg-muted/15 px-4 py-3 pl-10 rounded-b-md">
                    {pr.body ? (
                      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-foreground/90">
                        {pr.body}
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        No description provided on GitHub.
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-[11px] rounded-md border-[#e0e0e0] hover:border-[#d4d4d4]"
                          onClick={() => void generateDocs(pr)}
                          disabled={generating !== null}
                        >
                          {generating === pr.number ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Sparkles className="size-3" />
                          )}
                          Generate docs
                        </Button>
                        <span className="text-[10px] text-muted-foreground">
                          Updated {formatDate(pr.updatedAt)}
                        </span>
                      </div>
                      <a href={pr.htmlUrl} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px] rounded-md">
                          View on GitHub <ExternalLink className="size-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
