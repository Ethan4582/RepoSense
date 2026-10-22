'use client';

import * as React from 'react';
import { ArrowLeft, ChevronRight, FileCode2, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { WikiMarkdown, type CitationTarget } from './markdown';
import { CodeViewer, type ActiveFile } from './code-viewer';
import { getModelInfo } from '~/lib/providers/catalog';
import Link from 'next/link';

interface WikiQaViewProps {
  projectId: string;
  projectName: string;
  repoOwner: string;
  repoName: string;
  commitSha?: string | null;
  activeBranch: string;
  question: string;
  selectedModel: string;
  answer: string;
  scanning: Array<{ filePath: string; startLine: number; endLine: number }>;
  qaError: string | null;
  streaming: boolean;
  activeFile: ActiveFile | null;
  isSignedIn: boolean;
  onBack: () => void;
  onCitation: (target: CitationTarget) => void;
  onSelectFile: (file: ActiveFile | null) => void;
  answerEndRef: React.RefObject<HTMLDivElement | null>;
}

export function WikiQaView({
  projectId,
  projectName,
  repoOwner,
  repoName,
  commitSha,
  activeBranch,
  question,
  selectedModel,
  answer,
  scanning,
  qaError,
  streaming,
  activeFile,
  isSignedIn,
  onBack,
  onCitation,
  onSelectFile,
  answerEndRef,
}: WikiQaViewProps) {
  const modelInfo = getModelInfo(selectedModel);
  const isLoading = streaming && !answer;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Left Pane: Question & Answer / Loading Skeleton */}
      <section className="min-h-0 overflow-y-auto border-r border-border/60 p-6 pb-36 md:p-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to {projectName}
        </button>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">{question}</h1>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Zap className="size-2.5 text-primary" />
            {modelInfo?.name ?? 'Fast'}
          </span>
        </div>

        <div className="mt-8">
          {qaError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {qaError}
              {!isSignedIn ? (
                <div className="mt-3">
                  <Link href="/sign-in">
                    <Button size="sm" className="h-7 text-xs">
                      Sign in to ask
                    </Button>
                  </Link>
                </div>
              ) : null}
            </div>
          ) : answer ? (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Answer
              </div>
              <WikiMarkdown
                content={answer}
                onCitation={onCitation}
                githubRepo={{ owner: repoOwner, repo: repoName }}
                commitSha={commitSha}
              />
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted/70" />
              <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70" />
            </div>
          )}

          <div ref={answerEndRef} />
        </div>
      </section>

      {/* Right Pane: CodeViewer or Scanning Events Box */}
      <section className="min-h-0 overflow-hidden bg-muted/10 p-4 pb-36 md:p-6">
        {activeFile ? (
          <CodeViewer
            projectId={projectId}
            branch={activeBranch}
            file={activeFile}
            onClose={() => onSelectFile(null)}
            className="h-full rounded-xl border border-border/60 bg-background shadow-xs"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="mb-3 text-[11px] font-semibold text-foreground">
                Relevant Context & Files
              </div>
              {scanning.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-center text-xs text-muted-foreground justify-center">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Scanning codebase...</span>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {scanning.map((file) => (
                    <button
                      key={file.filePath}
                      type="button"
                      onClick={() => onSelectFile(file)}
                      className="group flex w-full items-center gap-2.5 py-2 text-left text-xs transition-colors hover:text-primary"
                    >
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      <span className="font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                        Scanning {file.filePath.split('/').pop() ?? file.filePath}
                      </span>
                      <div className="ml-auto h-0.5 w-16 bg-muted">
                        <div className="h-full w-full animate-pulse bg-primary/40" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
