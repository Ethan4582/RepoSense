'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Terminal, FolderGit2 } from 'lucide-react';
import useProject from '~/hooks/use-project';
import ChatView from '~/components/chat/chat-view';
import { Button } from '~/components/ui/button';

function DashboardContent() {
  const { project, projectId, setProjectId, projects } = useProject();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get('threadId') ?? searchParams.get('thread');
  const isNewChat = searchParams.get('new') === 'true';
  const newChatTimestamp = searchParams.get('t');

  // Auto-select first project if none is currently selected
  React.useEffect(() => {
    if (!projectId && projects && projects.length > 0) {
      setProjectId(projects[0]!.id);
    }
  }, [projectId, projects, setProjectId]);

  if (!project) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Terminal className="size-6" />
          </div>
          <h2 className="text-base font-medium text-foreground">No Project Selected</h2>
          <p className="text-xs text-muted-foreground">
            Link a GitHub repository to ask questions and chat with your codebase.
          </p>
          <div className="pt-2">
            <Link href="/create">
              <Button size="sm" className="text-xs gap-1.5 shadow-xs">
                <FolderGit2 className="size-3.5" />
                <span>Link Repository</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatView
      key={`${project.id}-${currentThreadId ?? 'new'}-${newChatTimestamp ?? 'init'}`}
      projectId={project.id}
      projectName={project.name}
      initialThreadId={isNewChat ? null : currentThreadId}
      activeThreadId={isNewChat ? null : currentThreadId}
    />
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="size-2 animate-pulse rounded-full bg-primary" />
            <span>Loading workspace...</span>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}
