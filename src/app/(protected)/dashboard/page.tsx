'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  GithubIcon,
  MoreVertical,
  UserPlus,
  Archive,
  FolderGit2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import useProject from '~/hooks/use-project';
import useRefetch from '~/hooks/use-refetch';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
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
import { Input } from '~/components/ui/input';
import TeamMembers from './team-member';
import { ChatView } from '~/components/chat/chat-view';

export default function DashboardPage() {
  const { project, projectId, projects } = useProject();
  const refetch = useRefetch();

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const archiveMutation = api.project.archiveProject.useMutation();
  const { data: questions } = api.project.getQuestion.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const handleArchive = () => {
    if (!projectId) return;
    archiveMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          toast.success('Project archived successfully');
          setArchiveOpen(false);
          refetch();
        },
        onError: () => {
          toast.error('Failed to archive project');
        },
      }
    );
  };

  if (!project) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
          <FolderGit2 className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No Project Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a project from the sidebar or link a new repository to start chatting with your codebase.
        </p>
        <Link href="/create" className="mt-4">
          <Button size="sm">Create New Project</Button>
        </Link>
      </div>
    );
  }

  const joinLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${projectId}` : '';

  return (
    <div className="flex flex-col gap-4">
      {/* Phase 14 Header: Repo name, GitHub link, indexing status pill, team members & ⋯ menu */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GithubIcon className="size-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground truncate">
                {project.name}
              </h1>
              <Badge variant="outline" className="gap-1 text-[11px] font-normal border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-3" />
                Indexed
              </Badge>
            </div>

            <Link
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              <span className="truncate">{project.repoUrl}</span>
              <ExternalLink className="size-3 shrink-0" />
            </Link>
          </div>
        </div>

        {/* Right side: Team members and ⋯ actions */}
        <div className="flex items-center gap-2">
          <TeamMembers />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground">
                <MoreVertical className="size-4" />
                <span className="sr-only">Project options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setInviteOpen(true)} className="gap-2 cursor-pointer">
                <UserPlus className="size-4" />
                <span>Invite Members</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setArchiveOpen(true)}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Archive className="size-4" />
                <span>Archive Project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Area: ChatGPT conversation surface */}
      <ChatView
        projectId={project.id}
        projectName={project.name}
        chatProvider={(project.chatProvider as any) || 'GEMINI'}
        chatModel={project.chatModel || 'gemini-2.5-flash'}
        initialQuestions={questions as any}
      />

      {/* Invite Members Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Members</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Share this link with your team members so they can join and collaborate on this repository:
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Input
              readOnly
              value={joinLink}
              className="text-xs font-mono"
            />
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(joinLink);
                toast.success('Invite link copied to clipboard');
              }}
            >
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Project Alert Dialog */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{project.name}</strong>? You can restore it later from project settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
