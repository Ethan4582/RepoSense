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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

type PullRequest = NonNullable<RouterOutputs['project']['getPullRequests']>[number];

export default function PullRequestsPage() {
  const { projectId, project, projects, setProjectId } = useProject();
  const [selectedRepoFilter, setSelectedRepoFilter] = React.useState<string>(projectId ?? 'all');
  const [filterState, setFilterState] = React.useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = React.useState('');
  const [selectedPr, setSelectedPr] = React.useState<PullRequest | null>(null);
  const [expandedPrIds, setExpandedPrIds] = React.useState<Set<number | string>>(new Set());
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (projectId && selectedRepoFilter === 'all') {
      setSelectedRepoFilter(projectId);
    }
  }, [projectId]);

  const queryProjectId = selectedRepoFilter === 'all' ? undefined : selectedRepoFilter;

  const { data: prs, isLoading: isPrsLoading } = api.project.getPullRequests.useQuery(
    { projectId: queryProjectId },
    { refetchInterval: 10000 }
  );

  const { data: commits, isLoading: isCommitsLoading } = api.project.getCommits.useQuery(
    { projectId: queryProjectId },
    { refetchInterval: 10000 }
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

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Header Bar: Repository Filter & Context Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitPullRequest className="size-6 text-primary" />
            Pull Requests
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Repository-scoped GitHub PRs, commit history, and AI inspection
            {project && selectedRepoFilter !== 'all' ? (
              <>
                {' for '}
                <strong className="text-foreground">{project.name}</strong>
              </>
            ) : (
              ' across all linked repositories'
            )}.
          </p>
        </div>

        {/* Repository Switcher / Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Repository:</span>
            <Select
              value={selectedRepoFilter}
              onValueChange={(val) => {
                setSelectedRepoFilter(val);
                if (val !== 'all') {
                  setProjectId(val);
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-[200px] max-w-[280px] text-xs gap-2 border-border/80 bg-background">
                <FolderGit2 className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="All Repositories" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-xs font-medium">
                  All Repositories
                </SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    <span className="font-medium truncate">{p.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {project?.repoUrl && (
            <Link
              href={`${project.repoUrl}/pulls`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-xs shrink-0"
                title={`View ${project.name} on GitHub`}
              >
                <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Commit Activity & Velocity Chart */}
      <Card className="shadow-xs overflow-hidden border">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Commit Activity & Velocity
              </CardTitle>
              <CardDescription className="text-xs">
                Historical commit frequency and contribution pace{project && selectedRepoFilter !== 'all' ? ` for ${project.name}` : ''}.
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
                    <linearGradient id="commitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary, #6366f1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--primary, #6366f1)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickMargin={8}
                    stroke="#888888"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="#888888"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} commits`, 'Pushed']}
                  />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    stroke="var(--primary, #6366f1)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#commitGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
              {isCommitsLoading ? 'Aggregating commit history...' : 'No commit activity recorded yet.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="inline-flex rounded-lg border bg-muted/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterState('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterState === 'all'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('open')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterState === 'open'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Open ({counts.open})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('closed')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filterState === 'closed'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
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
            placeholder="Search PRs, branches, authors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/20"
          />
        </div>
      </div>

      {/* Main Pull Requests Table with Expandable Rows */}
      <Card className="overflow-hidden border shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 text-xs font-semibold text-muted-foreground">
              <TableHead className="w-8"></TableHead>
              <TableHead>Pull Request</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40">Author</TableHead>
              <TableHead className="w-48">Branches</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPrsLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  Fetching repository pull requests from GitHub...
                </TableCell>
              </TableRow>
            ) : filteredPrs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  {search ? (
                    'No pull requests match your search criteria.'
                  ) : !projects || projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <p>No pull requests found. Link a GitHub repository to track pull requests and commit activity.</p>
                      <Link href="/create">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 mt-1">
                          <FolderGit2 className="size-3 text-primary" />
                          <span>Link Repository</span>
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    'No pull requests found for the selected repository.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredPrs.map((pr) => {
                const isOpen = pr.state === 'open';
                const isExpanded = expandedPrIds.has(pr.id);

                return (
                  <React.Fragment key={pr.id}>
                    <TableRow
                      className="hover:bg-muted/40 cursor-pointer group text-xs transition-colors"
                      onClick={() => toggleExpand(pr.id)}
                    >
                      {/* Expansion Chevron */}
                      <TableCell className="px-2 text-muted-foreground">
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(pr.id, e)}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </button>
                      </TableCell>

                      {/* PR Title & Number */}
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

                    {/* Expandable row showing commit messages */}
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20 border-b">
                        <TableCell colSpan={7} className="p-4">
                          <div className="space-y-3 pl-6 border-l-2 border-primary/40 my-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <GitCommit className="size-3.5 text-primary" />
                                PR Commits & Activity
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {pr.commits?.length ?? 0} commits recorded
                              </span>
                            </div>

                            {pr.commits && pr.commits.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {pr.commits.map((c) => (
                                  <div
                                    key={c.id}
                                    className="rounded-lg border bg-background p-2.5 text-xs space-y-1 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                                      <span className="font-semibold text-primary">
                                        {c.commitHash.slice(0, 7)}
                                      </span>
                                      <span>
                                        {new Date(c.commmitDate).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-foreground font-medium line-clamp-1">
                                      {c.commitMessage}
                                    </p>
                                    {c.summary && (
                                      <p className="text-muted-foreground text-[11px] bg-muted/40 p-1.5 rounded leading-relaxed border-l-2 border-primary/50">
                                        {c.summary}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground py-2 italic">
                                No specific commit breakdown stored for this PR.
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Slide-over Inspection Sheet */}
      <Sheet open={!!selectedPr} onOpenChange={(open) => !open && setSelectedPr(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-5 select-none">
          {selectedPr && (
            <>
              <SheetHeader className="space-y-2 border-b pb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-primary">#{selectedPr.number}</span>
                  <span>•</span>
                  <span>{selectedPr.branchName} → {selectedPr.baseBranch}</span>
                </div>
                <SheetTitle className="text-base font-bold leading-snug text-foreground">
                  {selectedPr.title}
                </SheetTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0.5 font-semibold ${
                      selectedPr.state === 'open'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {selectedPr.state === 'open' ? 'Open' : 'Closed'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    by <strong className="text-foreground">{selectedPr.authorName}</strong>
                  </span>
                </div>
              </SheetHeader>

              {/* AI Summary / Context */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" />
                  PR Summary & Context
                </h4>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                  {selectedPr.body ? (
                    <div className="whitespace-pre-wrap font-sans text-xs">
                      {selectedPr.body}
                    </div>
                  ) : (
                    <p className="italic text-muted-foreground">
                      No description body provided on GitHub for this pull request.
                    </p>
                  )}
                </div>
              </div>

              {/* Linked Commits in this PR */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <GitCommit className="size-3 text-primary" />
                  Included Commits ({selectedPr.commits?.length ?? 0})
                </h4>
                {selectedPr.commits && selectedPr.commits.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPr.commits.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border bg-card p-2.5 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-primary">{c.commitHash.slice(0, 7)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.commmitDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-medium text-foreground text-xs line-clamp-2">
                          {c.commitMessage}
                        </p>
                        {c.summary && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded">
                            {c.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No indexed commits attached to this pull request.
                  </p>
                )}
              </div>

              {/* View on GitHub Button */}
              <div className="pt-3 border-t">
                <Link href={selectedPr.htmlUrl} target="_blank" rel="noreferrer" className="w-full block">
                  <Button className="w-full gap-2 text-xs" variant="default">
                    <span>Open PR on GitHub</span>
                    <ExternalLink className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
