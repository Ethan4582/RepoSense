import * as React from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  History as HistoryIcon,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { WikiMarkdown, type CitationTarget } from "./markdown";
import { CodeViewer, type ActiveFile } from "./code-viewer";
import { getModelInfo } from "~/lib/providers/catalog";
import Link from "next/link";
import { IndexingLoader } from "~/components/indexing-loader";
import { WikiComposer } from "./wiki-composer";
import { ApiKeyRequiredCard } from "./api-key-required-card";
import type { ProviderId } from "~/lib/providers/types";
import { extractCitationRanges } from "~/lib/citations";

export interface QaConversationTurn {
  id: string;
  question: string;
  answer: string;
  model?: string;
  scanning?: Array<{ filePath: string; startLine: number; endLine: number }>;
  qaError?: string | null;
  streaming?: boolean;
}

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
  turns?: QaConversationTurn[];
  activeFile: ActiveFile | null;
  isSignedIn: boolean;
  onOpenHistory?: () => void;
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
  missingKeyProviders?: ProviderId[];
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
  turns,
  activeFile,
  isSignedIn,
  onOpenHistory,
  onBack,
  onCitation,
  onSelectFile,
  answerEndRef,
  composerProps,
  missingKeyProviders = [],
}: WikiQaViewProps) {
  const modelInfo = getModelInfo(selectedModel);
  const [savedTurns, setSavedTurns] = React.useState<Record<string, boolean>>(
    {},
  );
  const [savingTurnId, setSavingTurnId] = React.useState<string | null>(null);
  const [copiedTurnId, setCopiedTurnId] = React.useState<string | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const latestTurnRef = React.useRef<HTMLDivElement | null>(null);
  const rightPaneRef = React.useRef<HTMLElement | null>(null);
  const sourcePanelRefs = React.useRef<Record<string, HTMLDivElement | null>>(
    {},
  );

  // Synchronize right pane scrolling when active citation changes
  React.useEffect(() => {
    if (activeFile?.filePath) {
      const targetEl = sourcePanelRefs.current[activeFile.filePath];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeFile]);

  // Normalize turns: if `turns` array is provided and not empty, use it. Otherwise fallback to single turn from props.
  const displayTurns: QaConversationTurn[] = React.useMemo(() => {
    if (turns && turns.length > 0) return turns;
    if (question || answer || streaming || qaError) {
      return [
        {
          id: "turn-current",
          question,
          answer,
          model: selectedModel,
          scanning,
          qaError,
          streaming,
        },
      ];
    }
    return [];
  }, [turns, question, answer, selectedModel, scanning, qaError, streaming]);

  // When a new turn starts, scroll to reveal its block smoothly
  const prevTurnsLengthRef = React.useRef(displayTurns.length);
  React.useEffect(() => {
    if (displayTurns.length > prevTurnsLengthRef.current) {
      setTimeout(() => {
        latestTurnRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
    }
    prevTurnsLengthRef.current = displayTurns.length;
  }, [displayTurns.length]);

  // Extract cited files from all answers, live turn scanning events, or active file
  const citedFiles = React.useMemo(() => {
    const list: Array<{
      filePath: string;
      startLine?: number;
      endLine?: number;
    }> = [];
    const seen = new Set<string>();

    // 1. Exact citations shown in the answer take priority over retrieval ranges.
    const allAnswerText = displayTurns.map((t) => t.answer).join("\n\n");
    for (const citation of extractCitationRanges(allAnswerText)) {
      seen.add(citation.filePath);
      list.push(citation);
    }

    // 2. Include retrieved files that were not explicitly cited.
    for (const turn of displayTurns) {
      if (turn.scanning && turn.scanning.length > 0) {
        for (const scan of turn.scanning) {
          if (scan.filePath && !seen.has(scan.filePath)) {
            seen.add(scan.filePath);
            list.push({
              filePath: scan.filePath,
              startLine: scan.startLine,
              endLine: scan.endLine,
            });
          }
        }
      }
    }

    // 3. Current active file
    if (activeFile && !seen.has(activeFile.filePath)) {
      list.unshift({
        filePath: activeFile.filePath,
        startLine: activeFile.startLine,
        endLine: activeFile.endLine,
      });
    }

    return list;
  }, [displayTurns, activeFile]);

  const handleSaveTurn = async (turn: QaConversationTurn) => {
    if (!isSignedIn || !turn.answer || savingTurnId) return;
    setSavingTurnId(turn.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: turn.question,
          answers: turn.answer,
          branch: activeBranch,
          isBookmarked: true,
          fileReference: (turn.scanning ?? []).map((f) => ({
            fileName: f.filePath,
            startLine: f.startLine,
            endLine: f.endLine,
            sourceCode: "",
            summary: `Citations from ${f.filePath}${f.startLine ? `:${f.startLine}-${f.endLine}` : ""}`,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save answer");
      }

      setSavedTurns((prev) => ({ ...prev, [turn.id]: true }));
      toast.success("Answer saved to QA Bookmarks");
    } catch {
      toast.error("Could not save answer. Please try again.");
    } finally {
      setSavingTurnId(null);
    }
  };

  const copyTurnAnswer = async (turn: QaConversationTurn) => {
    await navigator.clipboard.writeText(turn.answer);
    setCopiedTurnId(turn.id);
    toast.success("Answer copied to clipboard");
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Left Pane: Pinned Chat Input Above Conversation Blocks */}
      <section className="border-border/70 relative flex min-h-0 flex-1 flex-col overflow-hidden border-r">
        {/* Top Header */}
        <div className="border-border/70 bg-background/95 flex shrink-0 items-center justify-between border-b px-6 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenHistory}
              className="bg-card text-foreground hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-xs transition-colors"
            >
              <HistoryIcon className="text-primary size-3.5" />
              <span>History</span>
            </button>
            <span className="text-muted-foreground text-xs">
              • Question thread
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            <ArrowLeft className="size-3" />
            <span>Return to Wiki</span>
          </button>
        </div>

        {/* Scrollable Conversation Blocks - Manual scrolling preserved, ample bottom space for fixed chat bar */}
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 scrollbar-none space-y-6 overflow-y-auto p-6 pb-48 md:p-8"
        >
          {displayTurns.map((turn, index) => {
            const isLatest = index === displayTurns.length - 1;
            const isTurnSaved = savedTurns[turn.id];
            const isTurnSaving = savingTurnId === turn.id;
            const isTurnCopied = copiedTurnId === turn.id;

            return (
              <div
                key={turn.id}
                ref={isLatest ? latestTurnRef : undefined}
                className="border-border/70 bg-card rounded-xl border p-6 shadow-xs"
              >
                {/* Question Header */}
                <div className="border-border/70 flex items-start justify-between gap-4 border-b pb-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      Q{index + 1}
                    </span>
                    <div className="space-y-1">
                      <h2 className="text-foreground text-lg font-bold tracking-tight break-words">
                        {turn.question}
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium">
                          <Zap className="text-primary size-3" />
                          {modelInfo?.name ?? "Fast"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {isSignedIn && turn.answer ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSaveTurn(turn)}
                        disabled={isTurnSaving || isTurnSaved}
                        className="border-border/60 text-muted-foreground hover:text-foreground h-7 gap-1.5 rounded-lg text-xs"
                      >
                        <Bookmark
                          className={`size-3.5 ${isTurnSaved ? "fill-primary text-primary" : ""}`}
                        />
                        <span>
                          {isTurnSaved
                            ? "Saved"
                            : isTurnSaving
                              ? "Saving..."
                              : "Bookmark"}
                        </span>
                      </Button>
                    ) : null}

                    {turn.answer ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void copyTurnAnswer(turn)}
                        className="text-muted-foreground hover:text-foreground size-7"
                        title="Copy answer"
                      >
                        {isTurnCopied ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Answer Content */}
                <div className="mt-4">
                  {turn.qaError ? (
                    <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
                      {turn.qaError}
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
                  ) : turn.answer ? (
                    <div className="space-y-4">
                      <WikiMarkdown
                        content={turn.answer}
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
                </div>
              </div>
            );
          })}

          <div ref={answerEndRef} />
        </div>

        {/* Floating Composer: Centered and stuck lower to the bottom */}
        {composerProps ? (
          <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-30 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-[680px]">
              {isSignedIn && missingKeyProviders.length > 0 ? (
                <ApiKeyRequiredCard providers={missingKeyProviders} compact />
              ) : (
                <WikiComposer
                  question={composerProps.question}
                  onQuestionChange={composerProps.onQuestionChange}
                  onSubmit={composerProps.onSubmit}
                  streaming={composerProps.streaming}
                  repoName={composerProps.repoName}
                  selectedModel={composerProps.selectedModel}
                  onModelSelect={composerProps.onModelSelect}
                  availableKeys={composerProps.availableKeys}
                  placeholder="Ask a question or follow-up..."
                />
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* Right Pane: Multi-file Context & Vertically Stacked Excerpt Panels */}
      <section
        ref={rightPaneRef}
        className="bg-muted/5 flex min-h-0 scrollbar-none flex-col overflow-y-auto p-4 pb-36 md:p-6"
      >
        {citedFiles.length > 0 ? (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-foreground text-[13px] font-semibold">
                Referenced Sources ({citedFiles.length})
              </span>
            </div>

            {/* Vertically stacked full-width panels */}
            {citedFiles.map((f, idx) => {
              const isSelected = activeFile
                ? activeFile.filePath === f.filePath
                : idx === 0;
              return (
                <div
                  key={f.filePath}
                  ref={(el) => {
                    if (el) sourcePanelRefs.current[f.filePath] = el;
                  }}
                >
                  <CodeViewer
                    projectId={projectId}
                    branch={activeBranch}
                    file={{
                      filePath: f.filePath,
                      startLine: isSelected
                        ? (activeFile?.startLine ?? f.startLine)
                        : f.startLine,
                      endLine: isSelected
                        ? (activeFile?.endLine ?? f.endLine)
                        : f.endLine,
                    }}
                    collapsible
                    defaultExpanded={isSelected}
                    className="w-full"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="border-border/50 bg-background/60 w-full max-w-md rounded-xl border p-6 text-center shadow-xs">
              <FileCode2 className="text-muted-foreground/50 mx-auto mb-2.5 size-7" />
              <div className="text-foreground text-[13px] font-semibold">
                No Referenced Source Files
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {streaming
                  ? "Scanning codebase for citations..."
                  : "No specific source lines were cited for this answer."}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
