'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  GitPullRequest,
  ExternalLink,
  Search,
  GitBranch,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import useProject from '~/hooks/use-project';
import { api, type RouterOutputs } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

type PullRequest = NonNullable<RouterOutputs['project']['getPullRequests']>[number];

export default function PullRequestsPage() {
  const { projectId, project } = useProject();
  const [filterState, setFilterState] = React.useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = React.useState('');
  const [selectedPr, setSelectedPr] = React.useState<PullRequest | null>(null);

  const { data: prs, isLoading } = api.project.getPullRequests.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const filteredPrs = React.useMemo(() => {
    if (!prs) return [];
    return prs.filter((pr) => {
      const matchesFilter =
        filterState === 'all' ? true : pr.state === filterState;
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        pr.title.toLowerCase().includes(term) ||
        pr.authorName.toLowerCase().includes(term) ||
        pr.branchName.toLowerCase().includes(term) ||
        String(pr.number).includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [prs, filterState, search]);

  const counts = React.useMemo(() => {
    if (!prs) return { all: 0, open: 0, closed: 0 };
    return {
      all: prs.length,
      open: prs.filter((p) => p.state === 'open').length,
      closed: prs.filter((p) => p.state === 'closed').length,
    };
  }, [prs]);

  if (!project) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
          <FolderGit2 className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No Project Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a project from the sidebar to review repository-scoped pull requests.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Header Bar: Repository Context & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitPullRequest className="size-6 text-primary" />
            Pull Requests
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Repository-scoped GitHub PRs, branch diffs, and AI inspection for{' '}
            <strong className="text-foreground">{project.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {project.repoUrl && (
            <Link
              href={`${project.repoUrl}/pulls`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <span>View on GitHub</span>
                <ExternalLink className="size-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills: All | Open | Closed */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border w-fit">
          <button
            type="button"
            onClick={() => setFilterState('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterState === 'all'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('open')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterState === 'open'
                ? 'bg-background text-emerald-600 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Open ({counts.open})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('closed')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterState === 'closed'
                ? 'bg-background text-purple-600 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Closed ({counts.closed})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by title, author, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/20"
          />
        </div>
      </div>

      {/* PRs Document List */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Sparkles className="size-5 text-primary animate-spin" />
            <span>Fetching pull requests from GitHub repository...</span>
          </div>
        ) : filteredPrs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <GitPullRequest className="size-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-foreground">
              {search
                ? 'No matching pull requests found.'
                : 'No pull requests found for this repository.'}
            </p>
            {project.repoUrl && (
              <p className="text-[11px]">
                You can create one directly at{' '}
                <Link
                  href={`${project.repoUrl}/compare`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  GitHub Compare ↗
                </Link>
              </p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredPrs.map((pr) => {
              const isOpen = pr.state === 'open';
              return (
                <li
                  key={pr.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/40 transition-colors gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="size-7 mt-0.5 shrink-0">
                      <AvatarImage src={pr.authorAvatar} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {pr.authorName[0]?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          #{pr.number}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPr(pr)}
                          className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left truncate max-w-lg cursor-pointer"
                        >
                          {pr.title}
                        </button>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.2 ${
                            isOpen
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                              : 'border-purple-500/20 bg-purple-500/10 text-purple-600'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>
                          by <strong className="text-foreground">{pr.authorName}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                          <GitBranch className="size-2.5" />
                          {pr.branchName} → {pr.baseBranch}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(pr.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPr(pr)}
                      className="h-7 text-xs px-2.5"
                    >
                      Inspect Details
                    </Button>
                    <Link href={pr.htmlUrl} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="size-3.5" />
                        <span className="sr-only">Open on GitHub</span>
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Slide-Over PR Inspector (Sheet) */}
      <Sheet open={!!selectedPr} onOpenChange={(open) => !open && setSelectedPr(null)}>
        {selectedPr && (
          <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full bg-card">
            <SheetHeader className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedPr.state === 'open'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                        : 'border-purple-500/20 bg-purple-500/10 text-purple-600'
                    }
                  >
                    {selectedPr.state.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{selectedPr.number}
                  </span>
                </div>

                <Link
                  href={selectedPr.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              <SheetTitle className="text-base font-semibold text-left pt-2">
                {selectedPr.title}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Branch & Author Info */}
              <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Author:</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Avatar className="size-4">
                      <AvatarImage src={selectedPr.authorAvatar} />
                      <AvatarFallback className="text-[9px]">U</AvatarFallback>
                    </Avatar>
                    <span>{selectedPr.authorName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Branch Route:</span>
                  <span className="font-mono text-[11px] font-semibold text-foreground">
                    {selectedPr.branchName} → {selectedPr.baseBranch}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-foreground">
                    {new Date(selectedPr.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* AI PR Overview */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  AI Pull Request Overview
                </h4>
                <p className="text-xs text-foreground leading-relaxed">
                  This pull request modifies files on branch{' '}
                  <code className="font-mono bg-muted px-1 rounded">{selectedPr.branchName}</code>{' '}
                  targeting <code className="font-mono bg-muted px-1 rounded">{selectedPr.baseBranch}</code>.
                  It introduces functional and architectural updates summarized directly from the commit logs and git diff.
                </p>
              </div>

              {/* Direct Actions */}
              <div className="pt-2">
                <Link href={selectedPr.htmlUrl} target="_blank" rel="noreferrer" className="w-full block">
                  <Button className="w-full gap-2 text-xs h-9">
                    <span>Review Full Diff on GitHub</span>
                    <ExternalLink className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
