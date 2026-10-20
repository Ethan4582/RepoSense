'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  GitCommit,
  GitPullRequest,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  User,
  Sparkles,
} from 'lucide-react';
import useProject from '~/hooks/use-project';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

export default function PullRequestsPage() {
  const { projectId, project } = useProject();
  const [search, setSearch] = React.useState('');
  const [expandedCommitId, setExpandedCommitId] = React.useState<string | null>(null);

  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const filteredCommits = React.useMemo(() => {
    if (!commits) return [];
    if (!search.trim()) return commits;
    const term = search.toLowerCase();
    return commits.filter(
      (c) =>
        c.commitMessage.toLowerCase().includes(term) ||
        c.commitAuthorName.toLowerCase().includes(term) ||
        c.commitHash.toLowerCase().includes(term)
    );
  }, [commits, search]);

  const toggleExpand = (id: string) => {
    setExpandedCommitId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitPullRequest className="size-6 text-primary" />
            Commits & Pull Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track repository changes, contributor activity, and AI-summarized commit logs for{' '}
            <strong className="text-foreground">{project?.name ?? 'your project'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={project?.repoUrl ? `${project.repoUrl}/pulls` : '#'}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <span>View GitHub PRs</span>
              <ExternalLink className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Commits Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {commits?.length ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Contributors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {new Set(commits?.map((c) => c.commitAuthorName)).size || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repository Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                main / master
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Commits Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="border-b bg-muted/20 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold">
              Commit History & Summaries
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter by message or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading commits...
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No commits found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Commit Message</TableHead>
                  <TableHead className="w-[180px]">Author</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[100px] text-right">Commit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommits.map((commit) => {
                  const isExpanded = expandedCommitId === commit.id;
                  const dateStr = new Date(commit.commmitDate).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <React.Fragment key={commit.id}>
                      <TableRow
                        onClick={() => toggleExpand(commit.id)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="p-2 text-center">
                          <Button variant="ghost" size="icon" className="size-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>

                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <GitCommit className="size-4 text-primary shrink-0" />
                            <span className="truncate max-w-md">{commit.commitMessage}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img
                              src={commit.commitAuthorAvatar}
                              alt={commit.commitAuthorName}
                              className="size-6 rounded-full border shrink-0"
                            />
                            <span className="text-xs text-muted-foreground truncate">
                              {commit.commitAuthorName}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {dateStr}
                        </TableCell>

                        <TableCell className="text-right">
                          <Link
                            href={`${project?.repoUrl}/commit/${commit.commitHash}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                          >
                            <span>{commit.commitHash.slice(0, 7)}</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        </TableCell>
                      </TableRow>

                      {/* Expandable Row for AI Summary */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="p-4">
                            <div className="rounded-lg border bg-card p-4 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <Sparkles className="size-3.5" />
                                <span>AI Commit Summary</span>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                                {commit.summary || 'No AI summary available for this commit.'}
                              </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
