"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Compass,
  FolderGit2,
  Globe2,
  History,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Video,
  GitPullRequest,
  Loader2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { Card, CardContent } from "~/components/ui/card";
import useProject from "~/hooks/use-project";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

const NAV_ITEMS = [
  { title: "Dashboard", icon: Compass, url: "/dashboard" },
  { title: "Public Wikis", icon: Globe2, url: "/explore" },
  { title: "QA", icon: Bookmark, url: "/qa" },
  { title: "History", icon: History, url: "/history" },
  { title: "Pull Requests", icon: GitPullRequest, url: "/pulls" },
  { title: "Meetings", icon: Video, url: "/meetings" },
  { title: "API Keys", icon: KeyRound, url: "/settings" },
];

type ProjectSummary = {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  isPublicWiki: boolean;
  isPrivateRepo: boolean;
  deletedAt: string | Date | null;
  role?: "OWNER" | "EDITOR" | "CONTRIBUTOR" | "VIEWER";
  indexingJobs?: Array<{ status: string }>;
  _count?: { wikiPages: number };
};

interface AppSideBarProps {
  onClose?: () => void;
}

export function AppSideBar({ onClose }: AppSideBarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar();
  const {
    projects,
    project,
    projectId,
    setProjectId,
    refetchProjects,
    isError: projectsFailed,
  } = useProject();

  const [busyProject, setBusyProject] = React.useState<string | null>(null);

  // Rename Dialog State
  const [projectToRename, setProjectToRename] =
    React.useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Delete Dialog State
  const [projectToDelete, setProjectToDelete] =
    React.useState<ProjectSummary | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");

  const updateProject = async (id: string, data: Record<string, unknown>) => {
    setBusyProject(id);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Could not update wiki.");
      }
      await refetchProjects();
      toast.success("Wiki updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update wiki.",
      );
    } finally {
      setBusyProject(null);
    }
  };

  const openRenameDialog = (project: ProjectSummary) => {
    setProjectToRename(project);
    setRenameValue(project.name);
  };

  const handleConfirmRename = async () => {
    if (!projectToRename) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === projectToRename.name) {
      setProjectToRename(null);
      return;
    }
    const currentId = projectToRename.id;
    setProjectToRename(null);
    await updateProject(currentId, { name: trimmed });
  };

  const openDeleteDialog = (project: ProjectSummary) => {
    setDeleteConfirmation("");
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const targetProject = projectToDelete;
    setProjectToDelete(null);
    setBusyProject(targetProject.id);
    try {
      const res = await fetch(`/api/projects/${targetProject.id}/archive`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Could not delete wiki.");
      await refetchProjects();
      toast.success("Wiki deleted");
      if (projectId === targetProject.id) router.push("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete wiki.",
      );
    } finally {
      setBusyProject(null);
    }
  };

  const visibleProjects = (projects ?? []).filter(
    (project) => !project.deletedAt,
  );

  return (
    <Sidebar
      collapsible="offcanvas"
      className="bg-sidebar select-none group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
    >
      <SidebarHeader className="gap-2 p-3 pb-2">
        <div className="flex h-8 items-center">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="RepoSense"
                fill
                className="object-cover"
                priority
              />
            </div>
            {open && (
              <span className="text-foreground text-base font-bold tracking-tight">
                Repo<span className="text-primary">Sense</span>
              </span>
            )}
          </Link>
        </div>

        <Card className="border-border/40 gap-0 py-0 shadow-none">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("open-command-palette"))
              }
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 items-center rounded-lg text-xs transition-colors",
                open
                  ? "w-full justify-between px-3"
                  : "mx-auto size-8 justify-center p-0",
              )}
              title="Search anything (Ctrl+K)"
            >
              <span className="flex items-center gap-2">
                <Search className="size-4 shrink-0" />
                {open && <span>Search...</span>}
              </span>
              {open && (
                <kbd className="bg-muted text-muted-foreground pointer-events-none rounded px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl K
                </kbd>
              )}
            </button>
          </CardContent>
        </Card>

        <Link href="/create" className="block">
          <Button
            variant="outline"
            className={cn(
              "bg-background text-foreground hover:bg-muted h-9 rounded-lg text-xs font-semibold",
              open ? "w-full justify-start gap-2" : "mx-auto size-8 p-0",
            )}
            title="New Wiki"
          >
            <Plus className="text-primary size-4 shrink-0" />
            {open && <span>New Wiki</span>}
          </Button>
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none gap-2 overflow-y-auto px-2 py-1">
        <SidebarGroup className="p-0">
          {open && (
            <SidebarGroupLabel className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wider uppercase">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Link href={item.url} prefetch onClick={onClose}>
                        <Icon className="size-4 shrink-0" />
                        {open && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {projectId && project ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(
                      `/settings/projects/${projectId}`,
                    )}
                    tooltip="Updates & access"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                  >
                    <Link
                      href={`/settings/projects/${projectId}`}
                      prefetch
                      onClick={onClose}
                    >
                      <Settings className="size-4 shrink-0" />
                      {open && <span>Updates &amp; access</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {open && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-muted-foreground flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider uppercase">
              <span>Repositories</span>
              <span className="text-muted-foreground/70 text-[10px] font-normal normal-case">
                {visibleProjects.length}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {projectsFailed ? (
                <div className="border-destructive/30 bg-destructive/5 mx-1 flex flex-col gap-2 rounded-xl border p-3 text-center">
                  <p className="text-destructive text-[10px] leading-4">
                    Repositories could not be loaded.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => void refetchProjects()}
                  >
                    Try again
                  </Button>
                </div>
              ) : visibleProjects.length === 0 ? (
                <div className="mx-1 rounded-lg border border-dashed px-3 py-4 text-center">
                  <BookOpen className="text-muted-foreground/40 mx-auto mb-1.5 size-4" />
                  <p className="text-muted-foreground text-[10px] leading-4">
                    No wikis yet. Link a GitHub repository to generate one.
                  </p>
                </div>
              ) : (
                <SidebarMenu className="gap-0.5">
                  {visibleProjects.map((project) => {
                    const isCurrent = project.id === projectId;
                    const isBusy = busyProject === project.id;

                    return (
                      <SidebarMenuItem key={project.id}>
                        <div
                          className={cn(
                            "group relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-200 ease-out",
                            isCurrent
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Link
                            href={`/wiki/${project.id}`}
                            prefetch
                            onClick={() => {
                              setProjectId(project.id);
                              onClose?.();
                            }}
                            className="flex min-w-0 flex-1 items-center pr-1"
                          >
                            <span className="text-foreground truncate text-xs font-medium">
                              {project.name}
                            </span>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:bg-background/80 hover:text-foreground shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {isBusy ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-3.5" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 text-xs"
                            >
                              <DropdownMenuItem asChild className="gap-2">
                                <Link href={`/wiki/${project.id}`}>
                                  <ArrowRight className="text-muted-foreground size-3.5" />
                                  Open wiki
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="gap-2">
                                <Link href={`/settings/projects/${project.id}`}>
                                  <Settings className="text-muted-foreground size-3.5" />
                                  Project settings
                                </Link>
                              </DropdownMenuItem>
                              {project.role === "OWNER" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => openRenameDialog(project)}
                                    className="gap-2"
                                  >
                                    <Pencil className="text-muted-foreground size-3.5" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={project.isPrivateRepo || isBusy}
                                    onClick={() =>
                                      void updateProject(project.id, {
                                        isPublicWiki: !project.isPublicWiki,
                                      })
                                    }
                                    className="gap-2"
                                  >
                                    {project.isPublicWiki ? (
                                      <Lock className="text-muted-foreground size-3.5" />
                                    ) : (
                                      <Globe2 className="text-muted-foreground size-3.5" />
                                    )}
                                    {project.isPublicWiki
                                      ? "Make private"
                                      : "Make public"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openDeleteDialog(project)}
                                    className="text-destructive focus:text-destructive gap-2"
                                  >
                                    <Trash2 className="size-3.5" />
                                    Delete wiki
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarRail />

      {/* Shadcn Rename Wiki Dialog */}
      <Dialog
        open={!!projectToRename}
        onOpenChange={(isOpen) => !isOpen && setProjectToRename(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Wiki</DialogTitle>
            <DialogDescription>
              Enter a new display name for the &ldquo;{projectToRename?.name}
              &rdquo; repository wiki.
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
              placeholder="Wiki name"
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

      {/* Shadcn Delete Wiki AlertDialog */}
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-wiki-confirmation" className="text-xs">
              Type{" "}
              <strong>
                {projectToDelete?.repoOwner}/{projectToDelete?.repoName}
              </strong>{" "}
              to confirm.
            </Label>
            <Input
              id="delete-wiki-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              disabled={
                deleteConfirmation !==
                `${projectToDelete?.repoOwner}/${projectToDelete?.repoName}`
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete wiki
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
