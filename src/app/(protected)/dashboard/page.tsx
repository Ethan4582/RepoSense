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

  const effectiveProjectId = project?.id ?? 'general';
  const effectiveProjectName = project?.name ?? 'General AI';

  return (
    <ChatView
      key={`${effectiveProjectId}-${currentThreadId ?? 'new'}-${newChatTimestamp ?? 'init'}`}
      projectId={effectiveProjectId}
      projectName={effectiveProjectName}
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
