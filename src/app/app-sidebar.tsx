'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  FolderGit2,
  Globe2,
  KeyRound,
  Lock,
  LogOut,
  MoreHorizontal,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  User as UserIcon,
  Video,
  GitPullRequest,
  Loader2,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import useProject from '~/hooks/use-project';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { title: 'Dashboard', icon: Compass, url: '/dashboard' },
  { title: 'Public Wikis', icon: Globe2, url: '/explore' },
  { title: 'New Repository', icon: FolderGit2, url: '/create' },
  { title: 'Pull Requests', icon: GitPullRequest, url: '/pulls' },
  { title: 'Meetings', icon: Video, url: '/meetings' },
  { title: 'API Keys', icon: KeyRound, url: '/settings' },
];

type ProjectSummary = {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  isPublicWiki: boolean;
  isPrivateRepo: boolean;
  deletedAt: string | Date | null;
  indexingJobs?: Array<{ status: string }>;
  _count?: { wikiPages: number };
};

function statusFor(project: ProjectSummary) {
  const status = project.indexingJobs?.[0]?.status;
  if (!status) return { color: 'bg-muted-foreground/40', label: 'Not indexed' };
  if (status === 'FAILED') return { color: 'bg-red-500', label: 'Indexing failed' };
  if (status === 'COMPLETED') return { color: 'bg-emerald-500', label: 'Ready' };
  if (status === 'RUNNING') return { color: 'bg-amber-500 animate-pulse', label: 'Indexing' };
  if (status === 'QUEUED') return { color: 'bg-amber-400', label: 'Queued' };
  return { color: 'bg-muted-foreground/40', label: status.toLowerCase() };
}

export function AppSideBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { projects, projectId, setProjectId, refetchProjects } = useProject();

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [busyProject, setBusyProject] = React.useState<string | null>(null);

  // Rename Dialog State
  const [projectToRename, setProjectToRename] = React.useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState('');

  // Delete Dialog State
  const [projectToDelete, setProjectToDelete] = React.useState<ProjectSummary | null>(null);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  };

  const updateProject = async (id: string, data: Record<string, unknown>) => {
    setBusyProject(id);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Could not update wiki.');
      }
      await refetchProjects();
      toast.success('Wiki updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update wiki.');
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
    setProjectToDelete(project);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const targetProject = projectToDelete;
    setProjectToDelete(null);
    setBusyProject(targetProject.id);
    try {
      const res = await fetch(`/api/projects/${targetProject.id}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Could not delete wiki.');
      await refetchProjects();
      toast.success('Wiki deleted');
      if (projectId === targetProject.id) router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete wiki.');
    } finally {
      setBusyProject(null);
    }
  };

  const visibleProjects = (projects ?? []).filter((project) => !project.deletedAt);

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar select-none">
      <SidebarHeader className="border-b border-border/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" priority />
            </div>
            {open && (
              <span className="text-base font-bold tracking-tight text-foreground">
                Repo<span className="text-primary">Sense</span>
              </span>
            )}
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(!open)}
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            {open ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
          </Button>
        </div>

        <Link href="/create" className="block">
          <Button
            variant="outline"
            className={cn(
              'h-9 border-border/80 bg-background text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-muted',
              open ? 'w-full justify-start gap-2' : 'mx-auto size-8 p-0'
            )}
            title="New Repository Wiki"
          >
            <Plus className="size-4 shrink-0 text-primary" />
            {open && <span>New Repository Wiki</span>}
          </Button>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-3 overflow-y-auto p-2">
        <SidebarGroup className="p-0">
          {open && (
            <SidebarGroupLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-primary font-semibold text-primary-foreground shadow-xs hover:bg-primary hover:text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Link href={item.url} prefetch>
                        <Icon className="size-4 shrink-0" />
                        {open && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {open && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Repositories</span>
              <span className="text-[10px] font-normal normal-case text-muted-foreground/70">
                {visibleProjects.length}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {visibleProjects.length === 0 ? (
                <div className="mx-1 rounded-lg border border-dashed px-3 py-4 text-center">
                  <BookOpen className="mx-auto mb-1.5 size-4 text-muted-foreground/40" />
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    No wikis yet. Link a GitHub repository to generate one.
                  </p>
                </div>
              ) : (
                <SidebarMenu className="gap-0.5">
                  {visibleProjects.map((project) => {
                    const status = statusFor(project);
                    const isCurrent = project.id === projectId;
                    const isBusy = busyProject === project.id;

                    return (
                      <SidebarMenuItem key={project.id}>
                        <div
                          className={cn(
                            'group relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors',
                            isCurrent
                              ? 'bg-primary/10 font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Link
                            href={`/wiki/${project.id}`}
                            prefetch
                            onClick={() => setProjectId(project.id)}
                            className="flex min-w-0 flex-1 items-center pr-1"
                          >
                            <span className="truncate text-xs font-medium text-foreground">
                              {project.name}
                            </span>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background/80 hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {isBusy ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-3.5" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuItem asChild className="gap-2">
                                <Link href={`/wiki/${project.id}`}>
                                  <ArrowRight className="size-3.5 text-muted-foreground" />
                                  Open wiki
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openRenameDialog(project)} className="gap-2">
                                <Pencil className="size-3.5 text-muted-foreground" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={project.isPrivateRepo || isBusy}
                                onClick={() =>
                                  void updateProject(project.id, { isPublicWiki: !project.isPublicWiki })
                                }
                                className="gap-2"
                              >
                                {project.isPublicWiki ? (
                                  <Lock className="size-3.5 text-muted-foreground" />
                                ) : (
                                  <Globe2 className="size-3.5 text-muted-foreground" />
                                )}
                                {project.isPublicWiki ? 'Make private' : 'Make public'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(project)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                                Delete wiki
                              </DropdownMenuItem>
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

      <SidebarFooter className="border-t border-border/40 p-2">
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <div className="flex w-full items-center justify-between">
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex flex-1 items-center gap-2.5 overflow-hidden rounded-lg p-1 text-left transition-colors hover:bg-muted/60"
              >
                <Avatar className="size-7 shrink-0 border border-border">
                  <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? 'User'} />
                  <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                    {user?.firstName?.[0] ??
                      user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ??
                      'U'}
                  </AvatarFallback>
                </Avatar>
                {open && (
                  <div className="flex min-w-0 flex-col truncate">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {user?.fullName ??
                        user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
                        'Developer'}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </span>
                  </div>
                )}
              </button>
            </PopoverTrigger>

            {open && (
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              </PopoverTrigger>
            )}
          </div>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            className="w-64 space-y-1.5 rounded-xl border bg-popover p-2 text-foreground shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border/40 px-2 py-1.5 pb-2">
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {user?.firstName?.[0] ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">
                  {user?.fullName ?? 'Developer'}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  openUserProfile();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
              >
                <UserIcon className="size-3.5 text-muted-foreground" />
                <span>Account settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
              >
                <KeyRound className="size-3.5 text-muted-foreground" />
                <span>API keys</span>
              </button>
            </div>

            <div className="space-y-0.5 border-t border-border/40 pt-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Sun className="size-3.5 text-muted-foreground dark:hidden" />
                  <Moon className="hidden size-3.5 text-muted-foreground dark:block" />
                  <span>Toggle theme</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  void signOut({ redirectUrl: '/sign-in' });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      {/* Shadcn Rename Wiki Dialog */}
      <Dialog open={!!projectToRename} onOpenChange={(isOpen) => !isOpen && setProjectToRename(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Wiki</DialogTitle>
            <DialogDescription>
              Enter a new display name for the &ldquo;{projectToRename?.name}&rdquo; repository wiki.
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
              <Button type="button" variant="outline" onClick={() => setProjectToRename(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renameValue.trim() === projectToRename?.name}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shadcn Delete Wiki AlertDialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(isOpen) => !isOpen && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the &ldquo;{projectToDelete?.name}&rdquo; wiki and remove all its generated documentation pages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
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
