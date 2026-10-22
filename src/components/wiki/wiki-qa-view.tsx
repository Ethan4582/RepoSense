import * as React from 'react';
import { ArrowLeft, Bookmark, Check, ChevronRight, Copy, ExternalLink, FileCode2, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';
import { WikiMarkdown, type CitationTarget } from './markdown';
import { CodeViewer, type ActiveFile } from './code-viewer';
import { getModelInfo } from '~/lib/providers/catalog';
import Link from 'next/link';
import { IndexingLoader } from '~/components/indexing-loader';

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
  const [saved, setSaved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Extract cited files from answer or scanning
  const citedFiles = React.useMemo(() => {
    const list: Array<{ filePath: string; startLine?: number; endLine?: number }> = [];
    const seen = new Set<string>();

    // From scanning
    for (const item of scanning) {
      if (!seen.has(item.filePath)) {
        seen.add(item.filePath);
        list.push(item);
      }
    }

    // From markdown citations in the answer
    const regex = /\[\[([^:\]\n]+):(\d+)(?:-(\d+))?\]\]/g;
    let match;
    while ((match = regex.exec(answer)) !== null) {
      const filePath = match[1];
      if (filePath && !seen.has(filePath)) {
        seen.add(filePath);
        list.push({
          filePath,
          startLine: Number(match[2]),
          endLine: match[3] ? Number(match[3]) : Number(match[2]),
        });
      }
    }

    return list;
  }, [scanning, answer]);

  const handleSaveAnswer = async () => {
    if (!isSignedIn || !answer || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answers: answer,
          branch: activeBranch,
          fileReference: citedFiles.map((f) => ({
            fileName: f.filePath,
            sourceCode: '',
            summary: `Citations from ${f.filePath}${f.startLine ? `:${f.startLine}-${f.endLine}` : ''}`,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save answer');
      }

      setSaved(true);
      toast.success('Answer saved to QA History');
    } catch {
      toast.error('Could not save answer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success('Answer copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Left Pane: Question & Prominent Answer */}
      <section className="scrollbar-none min-h-0 overflow-y-auto border-r border-border/50 p-6 pb-36 md:p-8">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to {projectName}
          </button>

          <div className="flex items-center gap-1.5">
            {isSignedIn && answer ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAnswer}
                disabled={isSaving || saved}
                className="h-7 gap-1.5 rounded-lg border-border/60 text-xs text-muted-foreground hover:text-foreground"
              >
                <Bookmark className={`size-3.5 ${saved ? 'fill-primary text-primary' : ''}`} />
                <span>{saved ? 'Saved' : isSaving ? 'Saving...' : 'Bookmark'}</span>
              </Button>
            ) : null}
            {answer ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={copyAnswer}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Copy answer"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </Button>
            ) : null}
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">{question}</h1>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Zap className="size-3 text-primary" />
            {modelInfo?.name ?? 'Fast'}
          </span>
        </div>

        <div className="mt-6">
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
              <WikiMarkdown
                content={answer}
                onCitation={onCitation}
                githubRepo={{ owner: repoOwner, repo: repoName }}
                commitSha={commitSha}
                branch={activeBranch}
              />
            </div>
          ) : (
            <div className="py-8">
              <IndexingLoader mode="qa" size="sm" />
            </div>
          )}

          <div ref={answerEndRef} />
        </div>
      </section>

      {/* Right Pane: Multi-file Context & Independent Excerpt Scroller */}
      <section className="flex min-h-0 flex-col overflow-hidden bg-muted/5 p-4 pb-36 md:p-6">
        {activeFile ? (
          <div className="flex h-full min-h-0 flex-col space-y-3">
            {/* Multi-file switcher tabs if multiple files exist */}
            {citedFiles.length > 1 ? (
              <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1">
                {citedFiles.map((f) => {
                  const isCurrent = f.filePath === activeFile.filePath;
                  return (
                    <button
                      key={f.filePath}
                      type="button"
                      onClick={() => onSelectFile(f)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        isCurrent
                          ? 'border-primary/50 bg-background font-medium text-primary shadow-xs'
                          : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      <FileCode2 className="size-3" />
                      <span className="truncate max-w-[140px]">{f.filePath.split('/').pop()}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="min-h-0 flex-1">
              <CodeViewer
                projectId={projectId}
                branch={activeBranch}
                file={activeFile}
                onClose={() => onSelectFile(null)}
                className="h-full rounded-xl border border-border/60 bg-background shadow-xs"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border/60 bg-background p-5 shadow-xs">
              <div className="mb-3 text-[12px] font-semibold text-foreground">
                Referenced Source Files
              </div>
              {citedFiles.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
                  {streaming ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Scanning codebase for citations...</span>
                    </>
                  ) : (
                    <span>No citations referenced in this answer.</span>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {citedFiles.map((file) => (
                    <button
                      key={file.filePath}
                      type="button"
                      onClick={() => onSelectFile(file)}
                      className="group flex w-full items-center justify-between gap-2.5 py-2.5 text-left text-xs transition-colors hover:text-primary"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        <span className="truncate font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                          {file.filePath}
                        </span>
                      </div>
                      {file.startLine ? (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          L{file.startLine}{file.endLine && file.endLine !== file.startLine ? `-${file.endLine}` : ''}
                        </span>
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      )}
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
