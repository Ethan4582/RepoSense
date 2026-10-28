"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  History,
  Search,
  Calendar,
  Sparkles,
  ExternalLink,
  Copy,
  Trash2,
  Pin,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { WikiMarkdown } from "~/components/wiki/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import useProject from "~/hooks/use-project";
import { api } from "~/trpc/react";
import {
  ListPagination,
  usePaginatedItems,
} from "~/components/list-pagination";

export default function HistoryPage() {
  const router = useRouter();
  const { projectId, project, projects, setProjectId } = useProject();
  const [selectedProjectFilter, setSelectedProjectFilter] =
    React.useState<string>(projectId ?? "all");
  const [search, setSearch] = React.useState("");

  const initialProjectSynced = React.useRef(false);
  React.useEffect(() => {
    if (projectId && !initialProjectSynced.current) {
      setSelectedProjectFilter(projectId);
      initialProjectSynced.current = true;
    }
  }, [projectId]);

  const queryProjectId =
    selectedProjectFilter === "all" ? undefined : selectedProjectFilter;

  // Dropdown accordion state: store expanded question IDs
  const [expandedQuestionIds, setExpandedQuestionIds] = React.useState<
    Set<string>
  >(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const {
    data: historyQuestions,
    isLoading,
    refetch,
  } = api.project.getAllQuestions.useQuery(
    { projectId: queryProjectId, query: search },
    { refetchInterval: 5000 },
  );
  const historyPagination = usePaginatedItems(historyQuestions ?? [], 10);

  const toggleBookmarkMutation = api.project.toggleBookmarkQuestion.useMutation(
    {
      onSuccess: (data) => {
        void refetch();
        toast.success(
          data.isBookmarked ? "Saved to bookmarks" : "Bookmark removed",
        );
      },
      onError: () => toast.error("Failed to update bookmark"),
    },
  );

  const deleteQuestionMutation = api.project.deleteQuestion.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success("Question removed from history");
    },
    onError: () => toast.error("Failed to delete question"),
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <History className="text-primary size-6" />
            Question History
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Complete archive of all questions and answers ever asked
            {project && selectedProjectFilter !== "all" ? (
              <>
                {" for "}
                <strong className="text-foreground">{project.name}</strong>
              </>
            ) : (
              " across all linked repositories"
            )}
            .
          </p>
        </div>

        {/* Repository Filter */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
            Repository:
          </span>
          <Select
            value={selectedProjectFilter}
            onValueChange={(val) => {
              setSelectedProjectFilter(val);
              if (val !== "all") {
                setProjectId(val);
              }
            }}
          >
            <SelectTrigger className="h-9 min-w-[200px] gap-2 rounded-lg text-xs">
              <FolderGit2 className="text-primary size-3.5 shrink-0" />
              <SelectValue placeholder="All Repositories" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all" className="text-xs font-medium">
                All Repositories
              </SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  <span className="truncate font-medium">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prominent Wide Search Bar */}
      <div className="relative w-full">
        <Search className="text-muted-foreground absolute top-3.5 left-3.5 size-4" />
        <Input
          placeholder="Search all past inquiries, answers, and code citations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-muted/20 h-11 rounded-lg pl-10 text-sm"
        />
      </div>

      {/* Questions Header */}
      <div className="text-muted-foreground flex items-center justify-between pt-1 text-xs font-semibold tracking-wider uppercase">
        <span>All Questions ({historyQuestions?.length ?? 0})</span>
      </div>

      {/* Questions List */}
      <div className="w-full">
        {isLoading ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-20 text-center text-xs">
            <Sparkles className="text-primary size-5 animate-spin" />
            <span>Loading question history...</span>
          </div>
        ) : !historyQuestions || historyQuestions.length === 0 ? (
          <div className="text-muted-foreground space-y-3 py-20 text-center text-xs">
            <History className="text-muted-foreground/30 mx-auto size-8" />
            <p className="text-foreground text-sm font-medium">
              {search
                ? "No matching questions found."
                : "No questions asked yet."}
            </p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed">
              Every question you ask on any repository wiki will automatically
              appear here in your full history.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="divide-border/40 divide-y">
              {historyPagination.paginatedItems.map((b) => {
                const repoUrl =
                  (b as unknown as { project?: { repoUrl?: string } }).project
                    ?.repoUrl ?? project?.repoUrl;
                const targetProjectId = b.projectId || projectId;
                const isExpanded = expandedQuestionIds.has(b.id);

                let repoOwner =
                  (b as unknown as { project?: { repoOwner?: string } }).project
                    ?.repoOwner ?? "";
                let repoName =
                  (b as unknown as { project?: { repoName?: string } }).project
                    ?.repoName ?? "";
                if (!repoOwner && repoUrl) {
                  const parts = repoUrl.replace(/\.git$/, "").split("/");
                  repoName = parts.pop() ?? "";
                  repoOwner = parts.pop() ?? "";
                }

                return (
                  <div
                    key={b.id}
                    className="hover:bg-muted/10 space-y-3 py-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="min-w-0 flex-1 cursor-pointer space-y-1.5 select-none"
                        onClick={(e) => toggleExpand(b.id, e)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(b.id, e)}
                            className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors"
                            aria-label={
                              isExpanded ? "Collapse answer" : "Expand answer"
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="text-foreground/80 size-4" />
                            ) : (
                              <ChevronRight className="text-muted-foreground size-4" />
                            )}
                          </button>

                          {b.isPinned && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600"
                            >
                              <Pin className="size-2.5 fill-amber-500/20" />
                              Pinned
                            </Badge>
                          )}

                          {b.isBookmarked && (
                            <Badge
                              variant="outline"
                              className="border-primary/20 bg-primary/10 text-primary gap-1 text-[10px]"
                            >
                              <Bookmark className="fill-primary size-2.5" />
                              Bookmarked
                            </Badge>
                          )}

                          <h3 className="text-foreground hover:text-primary text-base font-semibold transition-colors">
                            {b.question}
                          </h3>

                          {/* Project Badge if in All Repositories view */}
                          {selectedProjectFilter === "all" &&
                            (b as unknown as { project?: { name?: string } })
                              .project?.name && (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground gap-1 text-[10px]"
                              >
                                <FolderGit2 className="text-primary size-2.5" />
                                {
                                  (
                                    b as unknown as {
                                      project?: { name?: string };
                                    }
                                  ).project?.name
                                }
                              </Badge>
                            )}
                        </div>

                        <div className="text-muted-foreground flex items-center gap-2 pl-6 text-[11px]">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(b.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {b.user && (
                            <>
                              <span>•</span>
                              <span>
                                Asked by {b.user.firstName ?? "Anonymous"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (targetProjectId) {
                              router.push(
                                `/wiki/${targetProjectId}?questionId=${b.id}`,
                              );
                            }
                          }}
                          className="h-8 gap-1 px-3 text-xs"
                        >
                          <span>Open Instance</span>
                          <ExternalLink className="text-muted-foreground size-3" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={
                            b.isBookmarked
                              ? "text-primary size-8"
                              : "text-muted-foreground hover:text-foreground size-8"
                          }
                          title={
                            b.isBookmarked
                              ? "Remove Bookmark"
                              : "Bookmark Question"
                          }
                          onClick={() =>
                            toggleBookmarkMutation.mutate({ questionId: b.id })
                          }
                        >
                          <Bookmark
                            className={`size-3.5 ${b.isBookmarked ? "fill-primary" : ""}`}
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground size-8"
                          title="Copy Answer"
                          onClick={() => {
                            void navigator.clipboard.writeText(b.answers);
                            toast.success("Answer copied to clipboard");
                          }}
                        >
                          <Copy className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8"
                          title="Delete Question"
                          onClick={() =>
                            deleteQuestionMutation.mutate({ questionId: b.id })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Collapsible Answer Accordion */}
                    {isExpanded && (
                      <div className="border-border/50 bg-muted/15 text-foreground ml-6 rounded-lg border p-5 text-sm">
                        <WikiMarkdown
                          content={b.answers}
                          githubRepo={
                            repoOwner && repoName
                              ? { owner: repoOwner, repo: repoName }
                              : undefined
                          }
                          branch={b.branch ?? "main"}
                          className="compact"
                          onCitation={(target) => {
                            if (targetProjectId) {
                              router.push(
                                `/wiki/${targetProjectId}?questionId=${b.id}`,
                              );
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <ListPagination
              page={historyPagination.page}
              pageSize={historyPagination.pageSize}
              totalItems={historyQuestions.length}
              onPageChange={historyPagination.setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
