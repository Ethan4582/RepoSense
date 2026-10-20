'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FolderGit2 } from 'lucide-react';
import useProject from '~/hooks/use-project';
import { useThreadFolders } from '~/hooks/use-thread-folders';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import ChatView from '~/components/chat/chat-view';

function DashboardContent() {
  const { project, projectId } = useProject();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get('threadId') ?? searchParams.get('thread');
  const isNewChat = searchParams.get('new') === 'true';

  const { folders } = useThreadFolders(projectId);

  const { data: questions } = api.project.getQuestions.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const activeQuestion = React.useMemo(() => {
    if (isNewChat || !currentThreadId) return null;
    if (!questions || questions.length === 0) return null;
    return questions.find((q) => q.id === currentThreadId) ?? null;
  }, [questions, currentThreadId, isNewChat]);

  if (!project) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
          <FolderGit2 className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No Project Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a project or link a repository to start analyzing code.
        </p>
        <Link href="/create" className="mt-4">
          <Button size="sm">Create New Project</Button>
        </Link>
      </div>
    );
  }

  const threadTitle = activeQuestion ? activeQuestion.question : `New Chat · ${project.name}`;
  const currentFolder = activeQuestion ? folders[activeQuestion.id] : undefined;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Strictly Minimal Top Bar: Only Thread Title / Folder, No Options Menu */}
      <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 truncate min-w-0">
          {currentFolder && (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
              {currentFolder}
            </span>
          )}
          <h1 className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[280px] sm:max-w-md md:max-w-xl">
            {threadTitle}
          </h1>
        </div>

        {/* Clean, distraction-free surface: Right side is empty */}
        <div />
      </header>

      {/* Main Unified Canvas (Chat + Docked Compact Composer) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatView
          projectId={project.id}
          projectName={project.name}
          initialQuestions={questions ?? []}
          activeThreadId={activeQuestion?.id ?? null}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading workspace...</div>}>
      <DashboardContent />
    </React.Suspense>
  );
}
