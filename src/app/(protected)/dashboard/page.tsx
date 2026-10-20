'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  MoreVertical,
  UserPlus,
  Archive,
  FolderGit2,
  Pin,
  GitBranch,
  Copy,
  Check,
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
  DialogDescription,
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
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import TeamMembers from './team-member';
import ChatView from '~/components/chat/chat-view';

export default function DashboardPage() {
  const { project, projectId } = useProject();
  const refetch = useRefetch();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get('thread');

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [inviteRole, setInviteRole] = React.useState<'collaborator' | 'viewer'>('collaborator');
  const [copiedLink, setCopiedLink] = React.useState(false);

  const archiveMutation = api.project.archiveProject.useMutation();

  const { data: questions, refetch: refetchQuestions } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const { data: teamMembers } = api.project.getTeamMembers.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const togglePinMutation = api.project.togglePinQuestion.useMutation({
    onSuccess: () => {
      void refetchQuestions();
      toast.success('Pin status updated');
    },
    onError: () => toast.error('Failed to update pin'),
  });

  const activeQuestion = React.useMemo(() => {
    if (!questions || questions.length === 0) return null;
    if (currentThreadId) {
      return questions.find((q) => q.id === currentThreadId) ?? null;
    }
    return questions[0] ?? null;
  }, [questions, currentThreadId]);

  const handleArchive = () => {
    if (!projectId) return;
    archiveMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          toast.success('Project archived successfully');
          setArchiveOpen(false);
          void refetch();
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

  // Extract clean owner/repo from URL
  const repoSlug = (() => {
    try {
      const parts = project.repoUrl.replace(/\.git$/, '').split('/');
      const repo = parts.pop();
      const owner = parts.pop();
      if (owner && repo) return `${owner} / ${repo}`;
    } catch {}
    return project.name;
  })();

  const joinLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${projectId}` : '';

  const copyInviteLink = () => {
    if (!joinLink) return;
    void navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    toast.success('Invite link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Notion/T3 Document Header Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm">
        {/* Breadcrumb Context: 📁 Owner / Repo · [branch: main ▾] · [GitHub ↗] */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground truncate">
            <span className="text-base leading-none">📁</span>
            <span className="font-semibold truncate">{repoSlug}</span>
          </div>

          <span className="text-muted-foreground/40 text-xs">·</span>

          <Badge variant="outline" className="gap-1 text-[11px] font-mono px-2 py-0.5 border-border bg-muted/40 font-normal">
            <GitBranch className="size-3 text-muted-foreground" />
            main ▾
          </Badge>

          <span className="text-muted-foreground/40 text-xs hidden sm:inline">·</span>

          <Link
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {/* Right Header Actions: [+ Invite Members] [📌 Pin Thread] [Team] [···] */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <UserPlus className="size-3.5" />
            <span className="hidden sm:inline">+ Invite Members</span>
          </Button>

          {activeQuestion && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePinMutation.mutate({ questionId: activeQuestion.id })}
              className={`h-8 gap-1.5 text-xs font-medium ${
                activeQuestion.isPinned ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeQuestion.isPinned ? (
                <>
                  <Pin className="size-3.5 fill-amber-500/20" />
                  <span className="hidden md:inline">Pinned</span>
                </>
              ) : (
                <>
                  <Pin className="size-3.5" />
                  <span className="hidden md:inline">Pin Thread</span>
                </>
              )}
            </Button>
          )}

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
      </header>

      {/* Main Unified Canvas (Chat + Docked Composer) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatView
          projectId={project.id}
          projectName={project.name}
          initialQuestions={questions ?? []}
          activeThreadId={currentThreadId}
        />
      </div>

      {/* Section 3.6 Invite Members Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Invite Team Members
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Share this workspace link to collaborate with teammates on <strong className="text-foreground">{project.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Invite URL Copy Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Workspace Invite Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={joinLink}
                  className="font-mono text-xs h-9 bg-muted/30"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copyInviteLink}
                  className="h-9 px-3 gap-1.5 shrink-0"
                >
                  {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            {/* Role Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Default Access Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(val: 'collaborator' | 'viewer') => setInviteRole(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator" className="text-xs">
                    <span className="font-semibold">Collaborator</span> — Can index repos & run chats
                  </SelectItem>
                  <SelectItem value="viewer" className="text-xs">
                    <span className="font-semibold">Viewer</span> — Read-only chat & meetings
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Members List */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Members ({teamMembers?.length ?? 0})
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {teamMembers?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={member.user.imageUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {member.user.firstName?.[0] ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {member.user.firstName} {member.user.lastName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {member.user.emailAddress}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Collaborator
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Project Confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Repository</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{project.name}</strong>? This repository and its chat history will be hidden from your active workspaces.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {archiveMutation.isPending ? 'Archiving...' : 'Archive Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
