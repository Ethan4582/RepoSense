'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  MessageSquare,
  Bot,
  Video,
  GitPullRequest,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Button } from '~/components/ui/button';
import useProject from '~/hooks/use-project';
import { cn } from '~/lib/utils';

const navItems = [
  {
    title: 'Overview',
    icon: MessageSquare,
    url: '/dashboard',
  },
  {
    title: 'Q&A History',
    icon: Bot,
    url: '/qa',
  },
  {
    title: 'Pull Requests',
    icon: GitPullRequest,
    url: '/pull-requests',
  },
  {
    title: 'Meetings',
    icon: Video,
    url: '/meetings',
  },
];

export function AppSideBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const { projects, projectId, setProjectId } = useProject();

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      {/* Top Header: Logo & Toggle */}
      <SidebarHeader className="border-b border-border/40 p-3">
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
      </SidebarHeader>

      <SidebarContent className="p-2 gap-4">
        {/* Active Project Navigation Items */}
        <SidebarGroup>
          {open && (
            <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Project Tools
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.url;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => router.push(item.url)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {open && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects Section */}
        <SidebarGroup>
          <div className="flex items-center justify-between px-2 py-1">
            {open && (
              <SidebarGroupLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider p-0">
                Repositories
              </SidebarGroupLabel>
            )}
            {open && (
              <Link href="/create">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Create new project"
                >
                  <Plus className="size-3.5" />
                </Button>
              </Link>
            )}
          </div>

          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {projects?.map((proj) => {
                const isCurrent = proj.id === projectId;

                return (
                  <SidebarMenuItem key={proj.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        setProjectId(proj.id);
                        if (pathname !== '/dashboard') {
                          router.push('/dashboard');
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                        isCurrent
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase transition-colors',
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted-foreground/20 text-foreground'
                        )}
                      >
                        {proj.name[0]}
                      </div>
                      {open && <span className="truncate flex-1 text-left">{proj.name}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {open && (!projects || projects.length === 0) && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No repositories linked yet.
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Bottom Footer: Settings Navigation */}
      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push('/settings')}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                pathname === '/settings'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Settings className="size-4 shrink-0" />
              {open && <span>Settings</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
