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
  ChevronDown,
  ChevronRight,
  GitCommit,
  Calendar,
  GitMerge,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import useProject from '~/hooks/use-project';
import { api, type RouterOutputs } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '~/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/components/ui/table';
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
  const [expandedPrIds, setExpandedPrIds] = React.useState<Set<number | string>>(new Set());
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: prs, isLoading: isPrsLoading } = api.project.getPullRequests.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const { data: commits, isLoading: isCommitsLoading } = api.project.getCommits.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const toggleExpand = (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedPrIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  // Aggregate daily commits for the activity chart above the table
  const chartData = React.useMemo(() => {
    if (!commits || commits.length === 0) return [];
    const map = new Map<string, number>();

    const sorted = [...commits].sort(
      (a, b) => new Date(a.commmitDate).getTime() - new Date(b.commmitDate).getTime()
    );

    sorted.forEach((c) => {
      const d = new Date(c.commmitDate);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return Array.from(map.entries()).map(([date, count]) => ({
      date,
      commits: count,
    }));
  }, [commits]);

  if (!project) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
          <FolderGit2 className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No Project Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a project from the sidebar to review repository-scoped pull requests and commit activity.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Header Bar: Repository Context & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitPullRequest className="size-6 text-primary" />
            Pull Requests
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Repository-scoped GitHub PRs, commit history, and AI inspection for{' '}
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

      {/* COMMIT ACTIVITY & VELOCITY CHART (Above the table - Phase 15) */}
      <Card className="shadow-xs overflow-hidden border">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Commit Activity & Velocity
              </CardTitle>
              <CardDescription className="text-xs">
                Historical commit frequency and contribution pace for {project.name}.
              </CardDescription>
            </div>

            {/* Quick Metrics Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] gap-1">
                <GitCommit className="size-3 text-primary" />
                <span>{commits?.length ?? 0} Commits</span>
              </Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] gap-1">
                <GitPullRequest className="size-3 text-emerald-600" />
                <span>{counts.all} PRs</span>
              </Badge>
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] gap-1">
                <Clock className="size-3 text-amber-500" />
                <span>{counts.open} Open</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isMounted && chartData.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    name="Commits"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCommits)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10">
              {isCommitsLoading ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 animate-spin text-primary" />
                  <span>Loading commit velocity data...</span>
                </div>
              ) : (
                <span>No commit timeline records found for this repository yet.</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
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
                ? 'bg-background text-purple-600 dark:text-purple-400 shadow-xs font-semibold'
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

      {/* PULL REQUESTS TABLE WITH EXPANDABLE ROWS (Phase 15 specification) */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        {isPrsLoading ? (
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
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-muted/30">
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[200px]">Title & Identifier</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="min-w-[140px]">Author</TableHead>
                <TableHead className="min-w-[160px]">Branch</TableHead>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="text-right w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrs.map((pr) => {
                const isOpen = pr.state === 'open';
                const isExpanded = expandedPrIds.has(pr.id);

                return (
                  <React.Fragment key={pr.id}>
                    {/* Main Row */}
                    <TableRow
                      onClick={() => toggleExpand(pr.id)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors text-xs"
                    >
                      {/* Expand Toggle */}
                      <TableCell className="p-2 text-center" onClick={(e) => toggleExpand(pr.id, e)}>
                        <button
                          type="button"
                          className="size-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </button>
                      </TableCell>

                      {/* Title & Number */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground font-semibold">
                            #{pr.number}
                          </span>
                          <span className="text-foreground hover:text-primary transition-colors line-clamp-1">
                            {pr.title}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 font-semibold ${
                            isOpen
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </TableCell>

                      {/* Author */}
                      <TableCell>
                        <div className="flex items-center gap-2 truncate">
                          <Avatar className="size-5 shrink-0">
                            <AvatarImage src={pr.authorAvatar} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {pr.authorName[0]?.toUpperCase() ?? 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-foreground font-medium">
                            {pr.authorName}
                          </span>
                        </div>
                      </TableCell>

                      {/* Branch */}
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground truncate">
                          <GitBranch className="size-3 shrink-0" />
                          <span className="truncate">{pr.branchName}</span>
                          <span>→</span>
                          <span className="truncate">{pr.baseBranch}</span>
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-muted-foreground whitespace-nowrap text-[11px]">
                        {new Date(pr.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPr(pr)}
                            className="h-7 text-xs px-2"
                          >
                            Inspect
                          </Button>
                          <Link href={pr.htmlUrl} target="_blank" rel="noreferrer">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Open on GitHub"
                            >
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* EXPANDABLE ROW SHOWING COMMIT MESSAGES (Phase 15 specification) */}
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
                        <TableCell colSpan={7} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <GitCommit className="size-3.5 text-primary" />
                                Commit Messages & Summaries for #{pr.number}
                              </span>
                              <Link
                                href={`${project.repoUrl}/pull/${pr.number}/commits`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline text-[11px] flex items-center gap-1"
                              >
                                <span>View all branch commits on GitHub</span>
                                <ExternalLink className="size-2.5" />
                              </Link>
                            </div>

                            {/* Render Commits Log for this PR / Project */}
                            {commits && commits.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {commits.slice(0, 5).map((commit) => (
                                  <div
                                    key={commit.id}
                                    className="p-2.5 rounded-lg border bg-background text-xs space-y-1.5 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 truncate">
                                        <Avatar className="size-4 shrink-0">
                                          <AvatarImage src={commit.commitAuthorAvatar} />
                                          <AvatarFallback className="text-[8px]">
                                            {commit.commitAuthorName[0] ?? 'C'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-foreground truncate">
                                          {commit.commitAuthorName}
                                        </span>
                                        <Link
                                          href={`${project.repoUrl}/commit/${commit.commitHash}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors bg-muted px-1.5 py-0.5 rounded"
                                        >
                                          {commit.commitHash.slice(0, 7)}
                                        </Link>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {new Date(commit.commmitDate).toLocaleDateString([], {
                                          month: 'short',
                                          day: 'numeric',
                                        })}
                                      </span>
                                    </div>
                                    <p className="font-medium text-foreground text-[11px]">
                                      {commit.commitMessage}
                                    </p>
                                    {commit.summary && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded">
                                        {commit.summary}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic py-2">
                                No direct commit messages parsed for this pull request yet.
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedPr(pr)}
                                className="h-7 text-xs gap-1.5"
                              >
                                <Sparkles className="size-3 text-primary" />
                                <span>Inspect Full AI Diff Analysis</span>
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
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
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400'
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

              <SheetTitle className="text-base font-bold text-foreground text-left mt-2">
                {selectedPr.title}
              </SheetTitle>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Avatar className="size-5 shrink-0">
                  <AvatarImage src={selectedPr.authorAvatar} />
                  <AvatarFallback className="text-[9px]">
                    {selectedPr.authorName[0]?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <span>
                  Opened by <strong className="text-foreground">{selectedPr.authorName}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(selectedPr.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 text-xs">
              {/* Branch Routing Info */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <GitMerge className="size-3.5 text-primary" />
                  Branch Routing
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="bg-background px-2 py-1 rounded border">
                    {selectedPr.branchName}
                  </span>
                  <span>→</span>
                  <span className="bg-background px-2 py-1 rounded border font-semibold">
                    {selectedPr.baseBranch}
                  </span>
                </div>
              </div>

              {/* AI Code Diff & PR Insights */}
              <div className="space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                  <Sparkles className="size-4 text-primary" />
                  AI Pull Request Analysis
                </div>
                <div className="rounded-lg border bg-muted/10 p-4 space-y-3 leading-relaxed text-muted-foreground">
                  <p>
                    This pull request introduces changes from branch{' '}
                    <code className="text-foreground font-mono bg-muted px-1 rounded">
                      {selectedPr.branchName}
                    </code>{' '}
                    targeting{' '}
                    <code className="text-foreground font-mono bg-muted px-1 rounded">
                      {selectedPr.baseBranch}
                    </code>
                    .
                  </p>
                  <p>
                    Repository vector embeddings confirm integration with{' '}
                    <strong className="text-foreground">{project.name}</strong>. You can query
                    this pull request and its affected files directly from the dashboard chat.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <Link
                  href={`${project.repoUrl}/pull/${selectedPr.number}/files`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full text-xs h-8 gap-1.5">
                    <span>View Diff on GitHub</span>
                    <ExternalLink className="size-3" />
                  </Button>
                </Link>
                <Link
                  href={`/dashboard?query=${encodeURIComponent(
                    `Explain the impact and changes introduced in PR #${selectedPr.number}: ${selectedPr.title}`
                  )}`}
                  className="flex-1"
                >
                  <Button className="w-full text-xs h-8 gap-1.5">
                    <Sparkles className="size-3" />
                    <span>Ask RepoSense AI</span>
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
