import * as React from 'react';
import { ArrowLeft, Bookmark, Check, ChevronRight, Copy, ExternalLink, FileCode2, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';
import { WikiMarkdown, type CitationTarget } from './markdown';
import { CodeViewer, type ActiveFile } from './code-viewer';
import { getModelInfo } from '~/lib/providers/catalog';
import { IndexingLoader } from '~/components/indexing-loader';
import { WikiComposer } from './wiki-composer';

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
  composerProps?: {
    question: string;
    onQuestionChange: (value: string) => void;
    onSubmit: () => void;
    streaming: boolean;
    repoName: string;
    selectedModel: string;
    onModelSelect: (modelId: string) => void;
    availableKeys?: string[];
  };
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
  composerProps,
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

      {/* Right Pane: Multi-file Context & Vertically Stacked Excerpt Panels */}
      <section className="scrollbar-none flex min-h-0 flex-col overflow-y-auto bg-muted/5 p-4 pb-36 md:p-6">
        {citedFiles.length > 0 ? (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-foreground">
                Referenced Sources ({citedFiles.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click headers to collapse/expand
              </span>
            </div>

            {/* Vertically stacked full-width panels */}
            {citedFiles.map((f, idx) => {
              const isSelected = activeFile ? activeFile.filePath === f.filePath : idx === 0;
              return (
                <CodeViewer
                  key={f.filePath}
                  projectId={projectId}
                  branch={activeBranch}
                  file={{
                    filePath: f.filePath,
                    startLine: f.startLine ?? (activeFile?.filePath === f.filePath ? activeFile.startLine : undefined),
                    endLine: f.endLine ?? (activeFile?.filePath === f.filePath ? activeFile.endLine : undefined),
                  }}
                  collapsible
                  defaultExpanded={isSelected}
                  className="w-full"
                />
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border/50 bg-background/60 p-6 text-center shadow-xs">
              <FileCode2 className="mx-auto mb-2.5 size-7 text-muted-foreground/50" />
              <div className="text-[13px] font-semibold text-foreground">
                No Referenced Source Files
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {streaming
                  ? 'Scanning codebase for citations...'
                  : 'No specific source lines were cited for this answer.'}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
