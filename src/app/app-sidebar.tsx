'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  MessageSquare,
  GitPullRequest,
  Video,
  Bookmark,
  KeyRound,
  Plus,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Pin,
  PinOff,
  Trash2,
  FolderGit2,
  Check,
  GitBranch,
  ExternalLink,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import useProject from '~/hooks/use-project';
import { api } from '~/trpc/react';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';

const WORKSPACE_TABS = [
  {
    title: 'Chat & Discussions',
    shortTitle: 'Chat',
    subtitle: 'T3 composer + RAG canvas',
    icon: MessageSquare,
    url: '/dashboard',
  },
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
    title: 'API Keys & Vault',
    shortTitle: 'API Keys & Vault',
    subtitle: 'Clean centralized BYOK page',
    icon: KeyRound,
    url: '/settings',
  },
];

export function AppSideBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get('threadId');
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const { user } = useUser();
  const { projects, project, projectId, setProjectId } = useProject();

  const { data: questions, refetch: refetchQuestions } = api.project.getQuestion.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
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

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar select-none">
      {/* Top Header: Logo & Collapse Sidebar button */}
      <SidebarHeader className="border-b border-border/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-8 shrink-0 overflow-hidden rounded-lg">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" />
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

        {/* Repository Switcher Header & Branch Selector */}
        {open && (
          <div className="pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border bg-background/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderGit2 className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">{project?.name ?? 'Select Repository'}</span>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Repositories
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects?.map((p) => {
                  const isCurrent = p.id === projectId;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setProjectId(p.id)}
                      className="flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <span className="truncate">{p.name}</span>
                      {isCurrent && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/create" className="flex items-center gap-2 text-xs cursor-pointer text-primary font-medium">
                    <Plus className="size-3.5" />
                    <span>+ Link New Repository</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Branch indicator */}
            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="size-3" />
                branch: <strong className="text-foreground">main</strong>
              </span>
              {project?.repoUrl && (
                <Link
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-0.5"
                >
                  <span>GitHub</span>
                  <ExternalLink className="size-2.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="p-2 gap-3 overflow-y-auto">
        {/* WORKSPACE TABS */}
        <SidebarGroup className="p-0">
          {open && (
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Workspace Tabs
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
                      onClick={() => router.push(tab.url)}
                      tooltip={tab.title}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors w-full',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {open && (
                        <div className="flex flex-col text-left truncate">
                          <span className="truncate">{tab.title}</span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PINNED THREADS 📌 */}
        {open && pinnedQuestions.length > 0 && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Pinned Threads 📌</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                {pinnedQuestions.length}
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {pinnedQuestions.map((q) => {
                  const isSelected = currentThreadId === q.id;
                  return (
                    <SidebarMenuItem key={q.id}>
                      <div
                        onClick={() => router.push(`/dashboard?threadId=${q.id}`)}
                        className={cn(
                          'group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer w-full',
                          isSelected
                            ? 'bg-muted text-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <Pin className="size-3 text-amber-500 fill-amber-500/20 shrink-0" />
                          <span className="truncate text-left">{q.question}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          title="Unpin Thread"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinMutation.mutate({ questionId: q.id });
                          }}
                        >
                          <PinOff className="size-3" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* RECENT THREADS */}
        {open && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Recent Threads
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {recentQuestions.slice(0, 8).map((q) => {
                  const isSelected = currentThreadId === q.id;
                  return (
                    <SidebarMenuItem key={q.id}>
                      <div
                        onClick={() => router.push(`/dashboard?threadId=${q.id}`)}
                        className={cn(
                          'group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer w-full',
                          isSelected
                            ? 'bg-muted text-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <span className="text-muted-foreground/60 text-xs shrink-0">•</span>
                          <span className="truncate text-left">{q.question}</span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 hover:text-amber-500"
                            title="Pin Thread"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinMutation.mutate({ questionId: q.id });
                            }}
                          >
                            <Pin className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 hover:text-destructive"
                            title="Delete Thread"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteQuestionMutation.mutate({ questionId: q.id });
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </SidebarMenuItem>
                  );
                })}

                {recentQuestions.length === 0 && pinnedQuestions.length === 0 && (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground/70 italic">
                    No conversations yet.
                  </div>
                )}

                {/* [+ New Thread] Button anchored cleanly below thread list (ChatGPT style) */}
                <div className="pt-2 px-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="w-full justify-start gap-2 h-8 text-xs font-medium text-foreground hover:bg-muted border-dashed"
                  >
                    <Plus className="size-3.5 text-primary" />
                    <span>+ New Thread</span>
                  </Button>
                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Footer: User avatar & Account Settings */}
      <SidebarFooter className="border-t border-border/40 p-2.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <UserButton afterSignOutUrl="/sign-in" />
            {open && (
              <div className="flex flex-col truncate text-left">
                <span className="text-xs font-semibold text-foreground truncate">
                  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Developer'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress ?? 'Connected'}
                </span>
              </div>
            )}
          </div>

          {open && (
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Account & API Settings"
              >
                <KeyRound className="size-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
