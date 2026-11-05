"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import useProject from "~/hooks/use-project";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import {
  ListPagination,
  usePaginatedItems,
} from "~/components/list-pagination";

interface EnrichedProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  isPrivateRepo: boolean;
  isPublicWiki: boolean;
  defaultBranch?: string | null;
  lastIndexedBranch?: string | null;
  lastIndexedAt?: string | Date | null;
  description?: string | null;
  stars?: number;
  language?: string | null;
  _count?: { wikiPages: number };
  role?: "OWNER" | "EDITOR" | "CONTRIBUTOR" | "VIEWER";
}

function formatStars(count?: number | null): string {
  if (!count) return "0";
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "m";
  if (count >= 1_000) return (count / 1_000).toFixed(1) + "k";
  return String(count);
}

function getLanguageColor(language?: string | null): string {
  if (!language) return "#8b949e";
  const colors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Shell: "#89e051",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Dart: "#00b4ab",
  };
  return colors[language] ?? "#6366f1";
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    projects: rawProjects,
    isLoading,
    isError,
    refetchProjects,
  } = useProject();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [localVisibility, setLocalVisibility] = React.useState<
    Record<string, boolean>
  >({});
  const [projectToRename, setProjectToRename] =
    React.useState<EnrichedProject | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [projectToDelete, setProjectToDelete] =
    React.useState<EnrichedProject | null>(null);

  const projects =
    (rawProjects as unknown as EnrichedProject[] | undefined) ?? [];

  // Routing & Onboarding Flow:
  // When an authenticated user has zero repositories, automatically redirect them to /create
  React.useEffect(() => {
    if (!isLoading && rawProjects?.length === 0) {
      router.replace("/create");
    }
  }, [isLoading, rawProjects, router]);

  const handleStartRename = (
    project: EnrichedProject,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setProjectToRename(project);
    setRenameValue(project.name);
  };

  const handleConfirmRename = async () => {
    if (!projectToRename || !renameValue.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectToRename.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename repository");
      toast.success("Repository renamed");
      setProjectToRename(null);
      await refetchProjects();
    } catch {
      toast.error("Could not rename repository");
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const target = projectToDelete;
    setProjectToDelete(null);
    try {
      const res = await fetch(`/api/projects/${target.id}/archive`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Could not delete repository");
      toast.success("Repository permanently deleted");
      await refetchProjects();
    } catch {
      toast.error("Could not delete repository");
    }
  };

  const copyShareLink = async (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const url = `${window.location.origin}/wiki/${projectId}`;
      await navigator.clipboard.writeText(url);
      toast.success("Wiki link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleToggleVisibility = async (
    project: EnrichedProject,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (project.isPrivateRepo) {
      toast.error("Private repositories cannot have public wikis");
      return;
    }

    const currentPublic = localVisibility[project.id] ?? project.isPublicWiki;
    const nextPublic = !currentPublic;

    setLocalVisibility((prev) => ({ ...prev, [project.id]: nextPublic }));
    setTogglingId(project.id);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublicWiki: nextPublic }),
      });
      if (!res.ok) {
        throw new Error("Failed to update visibility");
      }
      toast.success(nextPublic ? "Wiki is now Public" : "Wiki is now Private");
      await refetchProjects();
    } catch (err) {
      setLocalVisibility((prev) => ({ ...prev, [project.id]: currentPublic }));
      toast.error(
        err instanceof Error ? err.message : "Could not update visibility",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (trimmed.includes("github.com/") || trimmed.startsWith("http")) {
      router.push(`/create?repo=${encodeURIComponent(trimmed)}`);
    }
  };

  const isLink =
    searchQuery.trim().includes("github.com/") ||
    searchQuery.trim().startsWith("http");

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || isLink) return projects;
    return projects.filter((p) => {
      const fullName = `${p.repoOwner}/${p.repoName}`.toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      const lang = (p.language ?? "").toLowerCase();
      return (
        fullName.includes(q) ||
        name.includes(q) ||
        desc.includes(q) ||
        lang.includes(q)
      );
    });
  }, [projects, searchQuery, isLink]);
  const projectPagination = usePaginatedItems(filteredProjects, 8);

  if (isError) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Could not load your repositories</CardTitle>
            <CardDescription>
              Your account data is still safe. Retry the request or contact the
              administrator if this continues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void refetchProjects()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !rawProjects || rawProjects.length === 0) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-3 text-xs">
          <Loader2 className="text-primary size-6 animate-spin" />
          <span>Loading repositories...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex min-h-full flex-col">
      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-8">
        {/* Header & Quick Search Matching Reference Screen */}
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-foreground text-3xl font-normal tracking-tight sm:text-4xl">
            Which repo would you like to understand?
          </h1>

          <Card className="mt-8 gap-0 py-0 shadow-none">
            <CardContent className="flex items-center gap-2 p-1.5">
              <Search className="text-muted-foreground ml-2 size-4 shrink-0" />
              <form
                onSubmit={handleSearchSubmit}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories or paste a GitHub link"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                {isLink ? (
                  <Button type="submit" size="sm">
                    <Sparkles data-icon="inline-start" />
                    Index
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Repository Grid */}
        <section className="mt-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Dedicated "+ Add repo" card */}
            <Link
              href="/create"
              className="group bg-primary/[0.03] hover:bg-primary/[0.06] relative flex min-h-[170px] flex-col justify-between rounded-xl border border-dashed p-5 transition-colors"
            >
              <div className="text-primary flex items-center gap-2 font-semibold">
                <Plus className="size-5" />
                <span className="text-base font-semibold">Add repo</span>
              </div>
              <div className="mt-8 flex items-center justify-end">
                <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>

            {/* Repository Cards */}
            {projectPagination.paginatedItems.map((project) => {
              const isPublic =
                localVisibility[project.id] ?? project.isPublicWiki;
              const isBusy = togglingId === project.id;
              const primaryLang = project.language || "Documentation";
              const langColor = getLanguageColor(project.language);

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/wiki/${project.id}`)}
                  className="group bg-card border-border/50 hover:bg-muted/20 relative flex min-h-[170px] cursor-pointer flex-col justify-between rounded-xl border p-5 shadow-xs transition-colors"
                >
                  {/* Top: Repo name & Visibility / Actions */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2
                        className="text-foreground flex-1 truncate text-[15px] font-medium tracking-tight"
                        title={`${project.repoOwner}/${project.repoName}`}
                      >
                        {project.repoOwner} / {project.repoName}
                      </h2>

                      <div
                        className="flex shrink-0 items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Visibility Tag & Quick Toggle */}
                        <div
                          className="border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors"
                          title={
                            project.isPrivateRepo
                              ? "Private repository"
                              : `Toggle visibility (currently ${isPublic ? "Public" : "Private"})`
                          }
                        >
                          <span className="font-normal">
                            {isPublic ? "Public" : "Private"}
                          </span>
                          {!project.isPrivateRepo && (
                            <Switch
                              checked={isPublic}
                              disabled={isBusy}
                              onClick={(e) =>
                                handleToggleVisibility(project, e)
                              }
                              className="origin-center scale-75 data-[state=checked]:bg-emerald-500"
                            />
                          )}
                        </div>

                        {/* Three-dot Action Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              title="More options"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 text-xs"
                          >
                            <DropdownMenuItem
                              onClick={(e) => handleStartRename(project, e)}
                              className="cursor-pointer gap-2"
                            >
                              <Pencil className="text-muted-foreground size-3.5" />
                              <span>Edit filename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/wiki/${project.id}?mode=edit`);
                              }}
                              className="cursor-pointer gap-2"
                            >
                              <Pencil className="text-muted-foreground size-3.5" />
                              <span>Edit wiki</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => copyShareLink(project.id, e)}
                              className="cursor-pointer gap-2"
                            >
                              <LinkIcon className="text-muted-foreground size-3.5" />
                              <span>Repository URL</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              asChild
                              className="cursor-pointer gap-2"
                            >
                              <Link
                                href={`/settings/projects/${project.id}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Settings className="text-muted-foreground size-3.5" />
                                <span>
                                  {project.role === "OWNER"
                                    ? "Manage access"
                                    : "Project settings"}
                                </span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(project);
                              }}
                              className="text-destructive focus:text-destructive cursor-pointer gap-2"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Middle: Description */}
                    <p className="text-muted-foreground mt-2 line-clamp-2 min-h-[34px] text-xs leading-relaxed">
                      {project.description ||
                        `${project.name} living architecture and code wiki.`}
                    </p>
                  </div>

                  {/* Bottom: Stars, Language, and Open arrow */}
                  <div className="border-border/40 mt-5 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-3">
                      {/* Star count */}
                      <div className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{formatStars(project.stars)}</span>
                      </div>

                      {/* Primary language badge */}
                      <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: langColor }}
                        />
                        <span>{primaryLang}</span>
                      </div>
                    </div>

                    {/* Open arrow */}
                    <div className="bg-muted/40 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground flex size-7 items-center justify-center rounded-full transition-all group-hover:translate-x-0.5">
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <ListPagination
              page={projectPagination.page}
              pageSize={projectPagination.pageSize}
              totalItems={filteredProjects.length}
              onPageChange={projectPagination.setPage}
            />
          </div>

          {filteredProjects.length === 0 && (
            <div className="border-border/60 mt-12 rounded-2xl border border-dashed py-12 text-center">
              <BookOpen className="text-muted-foreground/40 mx-auto mb-3 size-8" />
              <h3 className="text-foreground text-sm font-medium">
                No repositories match your search
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Try another keyword or paste a GitHub link.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Rename Dialog */}
      <Dialog
        open={!!projectToRename}
        onOpenChange={(isOpen) => !isOpen && setProjectToRename(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Filename / Name</DialogTitle>
            <DialogDescription>
              Enter a new display name for the &ldquo;{projectToRename?.name}
              &rdquo; repository.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleConfirmRename();
            }}
            className="space-y-4 py-2"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Repository name"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProjectToRename(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !renameValue.trim() ||
                  renameValue.trim() === projectToRename?.name
                }
              >
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(isOpen) => !isOpen && setProjectToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &ldquo;{projectToDelete?.name}
              &rdquo; repository and all associated data, including chat
              questions, conversation history, indexing jobs, indexed files, and
              generated wiki content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete repository
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
