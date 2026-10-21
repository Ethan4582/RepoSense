'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import {
  GitPullRequest,
  Video,
  Bookmark,
  KeyRound,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Pin,
  PinOff,
  Trash2,
  MoreHorizontal,
  Pencil,
  FolderPlus,
  Settings,
  FolderGit2,
  Check,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  Sliders,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import useProject from '~/hooks/use-project';
import { useThreadFolders } from '~/hooks/use-thread-folders';
import { api } from '~/trpc/react';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';
import {
  RenameThreadDialog,
  FolderThreadDialog,
  DeleteThreadDialog,
} from '~/components/chat/thread-action-dialogs';

const WORKSPACE_TABS = [
  {
    title: 'Pull Requests',
    shortTitle: 'Pull Requests',
    subtitle: 'Repository-scoped GitHub PRs',
    icon: GitPullRequest,
    url: '/pull-requests',
  },
  {
    title: 'Meetings & Issues',
    shortTitle: 'Meetings',
    subtitle: 'Notion-style audio & issues',
    icon: Video,
    url: '/meetings',
  },
  {
    title: 'QA Bookmarks',
    shortTitle: 'QA Bookmarks',
    subtitle: 'Searchable saved QA vault',
    icon: Bookmark,
    url: '/qa',
  },
  {
    title: 'API Keys',
    shortTitle: 'API Keys',
    subtitle: 'Clean centralized BYOK page',
    icon: KeyRound,
    url: '/settings',
  },
];

export function AppSideBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get('threadId') ?? searchParams.get('thread');
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { projects, projectId, setProjectId } = useProject();

  const [profilePopoverOpen, setProfilePopoverOpen] = React.useState(false);
  const [targetThread, setTargetThread] = React.useState<{ id: string; title: string } | null>(null);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [folderOpen, setFolderOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { folders, assignFolder, existingFolders } = useThreadFolders(projectId);

  const { data: questions, refetch: refetchQuestions } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? '' },
    {
      enabled: !!projectId,
      refetchInterval: 3000,
      refetchOnWindowFocus: true,
    }
  );

  const togglePinMutation = api.project.togglePinQuestion.useMutation({
    onSuccess: () => {
      void refetchQuestions();
      toast.success('Thread pin updated');
    },
    onError: () => toast.error('Failed to update pin'),
  });

  const deleteQuestionMutation = api.project.deleteQuestion.useMutation({
    onSuccess: () => {
      void refetchQuestions();
      toast.success('Thread deleted');
      setDeleteOpen(false);
      if (targetThread && currentThreadId === targetThread.id) {
        router.push('/dashboard');
      }
    },
    onError: () => toast.error('Failed to delete thread'),
  });

  const pinnedQuestions = React.useMemo(
    () => questions?.filter((q) => q.isPinned) ?? [],
    [questions]
  );
  const recentQuestions = React.useMemo(
    () => questions?.filter((q) => !q.isPinned) ?? [],
    [questions]
  );

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
    toast.success(`Switched to ${isDark ? 'Dark' : 'Light'} theme`);
  };

  const handleStartNewChat = () => {
    if (!projectId && projects && projects.length > 0) {
      setProjectId(projects[0]!.id);
    }
    router.push(`/dashboard?new=true&t=${Date.now()}`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar select-none">
      {/* Top Header: Logo, Sidebar Toggle & Clean "New Chat" Initiation (Gemini Style) */}
      <SidebarHeader className="border-b border-border/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" priority />
            </div>
            {open && (
              <span className="font-bold text-base tracking-tight text-foreground">
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

        {/* Primary "New chat" initiation button anchored at the top */}
        <div>
          {open ? (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleStartNewChat}
                variant="outline"
                className="flex-1 justify-start gap-2 h-9 text-xs font-semibold shadow-xs border-border/80 bg-background hover:bg-muted text-foreground transition-all"
              >
                <Plus className="size-4 text-primary shrink-0" />
                <span>New chat</span>
              </Button>
              <Link href="/create">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 border-border/80 text-muted-foreground hover:text-foreground shrink-0"
                  title="Link a new repository URL"
                >
                  <FolderGit2 className="size-4 text-primary" />
                </Button>
              </Link>
            </div>
          ) : (
            <Button
              onClick={handleStartNewChat}
              variant="outline"
              size="icon"
              className="size-8 mx-auto flex items-center justify-center border-border/80 text-foreground"
              title="New chat"
            >
              <Plus className="size-4 text-primary" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 gap-3 overflow-y-auto">
        {/* WORKSPACE TABS */}
        <SidebarGroup className="p-0">
          {open && (
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {WORKSPACE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.url;

                return (
                  <SidebarMenuItem key={tab.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={tab.title}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors w-full cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary hover:text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Link href={tab.url} prefetch>
                        <Icon className="size-4 shrink-0" />
                        {open && (
                          <div className="flex flex-col text-left truncate">
                            <span className="truncate">{tab.title}</span>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PINNED THREADS */}
        {open && pinnedQuestions.length > 0 && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
              <Pin className="size-3 text-primary rotate-45" />
              <span>Pinned</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {pinnedQuestions.map((q) => {
                  const isCurrent = currentThreadId === q.id;
                  const folder = folders[q.id];

                  return (
                    <SidebarMenuItem key={q.id}>
                      <div
                        className={cn(
                          'group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer w-full',
                          isCurrent
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Link
                          href={`/dashboard?threadId=${q.id}`}
                          prefetch
                          className="flex flex-col truncate min-w-0 pr-2 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{q.question}</span>
                          </div>
                          {folder && (
                            <span className="text-[10px] text-muted-foreground/70 truncate">
                              📁 {folder}
                            </span>
                          )}
                        </Link>

                        {/* Thread Action Dots Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinMutation.mutate({ questionId: q.id });
                              }}
                              className="gap-2"
                            >
                              <PinOff className="size-3.5 text-muted-foreground" />
                              <span>Unpin</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setRenameOpen(true);
                              }}
                              className="gap-2"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setFolderOpen(true);
                              }}
                              className="gap-2"
                            >
                              <FolderPlus className="size-3.5 text-muted-foreground" />
                              <span>Organize / Move</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setDeleteOpen(true);
                              }}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* RECENT THREADS */}
        {open && recentQuestions.length > 0 && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Recent
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {recentQuestions.map((q) => {
                  const isCurrent = currentThreadId === q.id;
                  const folder = folders[q.id];

                  return (
                    <SidebarMenuItem key={q.id}>
                      <div
                        className={cn(
                          'group relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer w-full',
                          isCurrent
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Link
                          href={`/dashboard?threadId=${q.id}`}
                          prefetch
                          className="flex flex-col truncate min-w-0 pr-2 flex-1 text-left"
                        >
                          <span className="truncate">{q.question}</span>
                          {folder && (
                            <span className="text-[10px] text-muted-foreground/70 truncate">
                              📁 {folder}
                            </span>
                          )}
                        </Link>

                        {/* Thread Action Dots Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 text-xs">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinMutation.mutate({ questionId: q.id });
                              }}
                              className="gap-2"
                            >
                              <Pin className="size-3.5 text-muted-foreground rotate-45" />
                              <span>Pin thread</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setRenameOpen(true);
                              }}
                              className="gap-2"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setFolderOpen(true);
                              }}
                              className="gap-2"
                            >
                              <FolderPlus className="size-3.5 text-muted-foreground" />
                              <span>Organize / Move</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetThread({ id: q.id, title: q.question });
                                setDeleteOpen(true);
                              }}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Bottom Sidebar Profile: Profile Icon, Name + Dedicated Settings Gear (Gemini Reference UI) */}
      <SidebarFooter className="border-t border-border/40 p-2">
        <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
          <div className="flex items-center justify-between w-full">
            {/* Clickable Profile Entry */}
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 overflow-hidden flex-1 p-1 rounded-lg hover:bg-muted/60 transition-colors text-left"
              >
                <Avatar className="size-7 shrink-0 border border-border">
                  <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? 'User'} />
                  <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-semibold">
                    {user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>

                {open && (
                  <div className="flex flex-col truncate min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {user?.fullName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'Developer'}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {user?.primaryEmailAddress?.emailAddress}
                    </span>
                  </div>
                )}
              </button>
            </PopoverTrigger>

            {/* Dedicated Settings Gear Icon Button (Right beside profile entry) */}
            {open && (
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground shrink-0 ml-1"
                  title="Settings & Preferences"
                >
                  <Settings className="size-4" />
                </Button>
              </PopoverTrigger>
            )}
          </div>

          {/* Consolidated Popover Menu Providing Profile Configuration, Clerk Settings, Preferences, and Login/Logout Actions */}
          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            className="w-64 p-2 shadow-2xl border rounded-xl bg-popover text-foreground space-y-1.5"
          >
            {/* User Account Summary */}
            <div className="px-2 py-1.5 flex items-center gap-2.5 border-b border-border/40 pb-2">
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {user?.firstName?.[0] ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-foreground truncate">
                  {user?.fullName ?? 'Developer'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            </div>

            {/* Account Group (Gemini Style) */}
            <div className="pt-1">
              <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  openUserProfile();
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted text-foreground transition-colors text-left"
              >
                <UserIcon className="size-3.5 text-muted-foreground" />
                <span>Account Settings (Clerk)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted text-foreground transition-colors text-left"
              >
                <KeyRound className="size-3.5 text-muted-foreground" />
                <span>API Keys & Preferences</span>
              </button>
            </div>

            {/* Active Repositories Switcher */}
            <div className="pt-1 border-t border-border/40">
              <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Repositories</span>
                <Link
                  href="/create"
                  onClick={() => setProfilePopoverOpen(false)}
                  className="text-primary hover:underline lowercase text-[10px]"
                >
                  + link repo
                </Link>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {projects?.map((p) => {
                  const isCurrent = p.id === projectId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProjectId(p.id);
                        setProfilePopoverOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs text-left transition-colors',
                        isCurrent ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FolderGit2 className="size-3 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      {isCurrent && <Check className="size-3 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferences & Sign Out */}
            <div className="pt-1 border-t border-border/40 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  toggleDarkMode();
                  setProfilePopoverOpen(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs hover:bg-muted text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sun className="size-3.5 text-muted-foreground dark:hidden" />
                  <Moon className="size-3.5 text-muted-foreground hidden dark:block" />
                  <span>Toggle Theme</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  void signOut({ redirectUrl: '/sign-in' });
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-destructive/10 text-destructive transition-colors text-left"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Global Dialogs for Thread Management */}
        {targetThread && (
          <>
            <RenameThreadDialog
              open={renameOpen}
              onOpenChange={setRenameOpen}
              threadId={targetThread.id}
              initialTitle={targetThread.title}
              onRenamed={() => {
                void refetchQuestions();
                setTargetThread(null);
              }}
            />
            <FolderThreadDialog
              open={folderOpen}
              onOpenChange={setFolderOpen}
              threadId={targetThread.id}
              currentFolder={folders[targetThread.id]}
              existingFolders={existingFolders}
              onFolderAssigned={(folder) => {
                assignFolder(targetThread.id, folder);
                setTargetThread(null);
              }}
            />
            <DeleteThreadDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              threadTitle={targetThread.title}
              isPending={deleteQuestionMutation.isPending}
              onConfirm={() => deleteQuestionMutation.mutate({ questionId: targetThread.id })}
            />
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
