"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import useProject from "~/hooks/use-project";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  ListPagination,
  usePaginatedItems,
} from "~/components/list-pagination";

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
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

type Filter = "all" | "open" | "merged" | "closed";

function prStatus(pr: PullRequest): "open" | "merged" | "closed" {
  if (pr.mergedAt) return "merged";
  return pr.state;
}

function statusStyles(status: "open" | "merged" | "closed") {
  if (status === "open")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "merged")
    return "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400";
  return "border-border bg-muted text-muted-foreground";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PullRequestsPage() {
  const { projectId, project, projects, setProjectId } = useProject();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [search, setSearch] = React.useState("");
  const [pullRequests, setPullRequests] = React.useState<PullRequest[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "projectId",
    );
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

    fetch(`/api/projects/${projectId}/pulls`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as {
          pullRequests?: PullRequest[];
          error?: string;
        };
        if (!res.ok)
          throw new Error(data.error ?? "Could not load pull requests.");
        return data.pullRequests ?? [];
      })
      .then((items) => {
        if (!cancelled) setPullRequests(items);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load pull requests.",
          );
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
      open: pullRequests.filter((pr) => prStatus(pr) === "open").length,
      merged: pullRequests.filter((pr) => prStatus(pr) === "merged").length,
      closed: pullRequests.filter((pr) => prStatus(pr) === "closed").length,
    };
  }, [pullRequests]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return pullRequests.filter((pr) => {
      const status = prStatus(pr);
      if (filter !== "all" && status !== filter) return false;
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
  const pullRequestPagination = usePaginatedItems(filtered, 10);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <GitPullRequest className="text-primary size-6" />
            Pull Requests
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Native GitHub pull requests for{" "}
            <strong className="text-foreground">
              {project
                ? `${project.repoOwner}/${project.repoName}`
                : "your repositories"}
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={projectId ?? undefined}
            onValueChange={(value) => setProjectId(value)}
          >
            <SelectTrigger className="h-8 max-w-[280px] min-w-[200px] gap-2 text-xs">
              <GitPullRequest className="text-primary size-3.5 shrink-0" />
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
            <a
              href={`${project.repoUrl}/pulls`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="View on GitHub"
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </a>
          ) : null}

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading || !projectId}
            title="Refresh pull requests"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as Filter)}
          variant="outline"
          size="sm"
        >
          {(["all", "open", "merged", "closed"] as const).map((value) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={`Show ${value} pull requests`}
              className="capitalize"
            >
              {value} ({counts[value]})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
          <Input
            placeholder="Search PRs, authors, labels..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-muted/20 h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {!projectId ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <GitPullRequest className="text-muted-foreground/40 mx-auto mb-3 size-8" />
          <h2 className="text-sm font-semibold">No repository selected</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Link a repository to view its native pull requests.
          </p>
          <Link href="/create">
            <Button size="sm" className="mt-4">
              Link repository
            </Button>
          </Link>
        </div>
      ) : error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-6 text-sm">
          {error}
        </div>
      ) : loading && pullRequests.length === 0 ? (
        <div className="text-muted-foreground flex h-56 items-center justify-center gap-2 rounded-lg border text-xs">
          <Loader2 className="text-primary size-4 animate-spin" />
          Fetching pull requests from GitHub...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <GitPullRequest className="text-muted-foreground/40 mx-auto mb-3 size-8" />
          <h2 className="text-sm font-semibold">No pull requests found</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {search
              ? "No PRs match your search."
              : "This repository has no matching pull requests."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="divide-border/50 border-border/50 bg-card divide-y overflow-hidden rounded-xl border shadow-xs">
            {pullRequestPagination.paginatedItems.map((pr) => {
              const status = prStatus(pr);
              const isExpanded = expanded.has(pr.id);

              return (
                <div
                  key={pr.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(pr.id)}
                    className="focus-visible:ring-ring flex w-full items-start gap-3 px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    <span className="text-muted-foreground mt-1 shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs font-semibold">
                          #{pr.number}
                        </span>
                        <span className="text-foreground line-clamp-1 text-sm font-medium">
                          {pr.title}
                        </span>
                        {pr.isDraft ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground text-[9px]"
                          >
                            Draft
                          </Badge>
                        ) : null}
                      </div>

                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="flex items-center gap-1">
                          {status === "merged" ? (
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
                            <Badge
                              key={label}
                              variant="secondary"
                              className="text-[9px] font-normal"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold capitalize",
                          statusStyles(status),
                        )}
                      >
                        {status}
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <Avatar className="size-4">
                          <AvatarImage src={pr.authorAvatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[8px]">
                            {pr.authorName[0]?.toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        {pr.authorName}
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="bg-muted/15 rounded-b-md px-4 py-3 pl-10">
                      {pr.body ? (
                        <div className="text-foreground/90 max-h-72 overflow-y-auto text-xs leading-6 whitespace-pre-wrap">
                          {pr.body}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs italic">
                          No description provided on GitHub.
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-[11px]"
                          >
                            <Link href={`/wiki/${projectId}`}>
                              <ExternalLink className="size-3" />
                              View wiki
                            </Link>
                          </Button>
                          <span className="text-muted-foreground text-[10px]">
                            Updated {formatDate(pr.updatedAt)}
                          </span>
                        </div>
                        <a href={pr.htmlUrl} target="_blank" rel="noreferrer">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 rounded-md text-[11px]"
                          >
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
          <ListPagination
            page={pullRequestPagination.page}
            pageSize={pullRequestPagination.pageSize}
            totalItems={filtered.length}
            onPageChange={pullRequestPagination.setPage}
          />
        </div>
      )}
    </div>
  );
}
