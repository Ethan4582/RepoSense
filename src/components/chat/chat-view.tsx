'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Send,
  Sparkles,
  FileCode,
  ExternalLink,
  ChevronRight,
  Code2,
  Copy,
  Bookmark,
  Bot,
  User as UserIcon,
  AtSign,
  Layers,
  MessageSquare,
  ArrowRight,
  FolderGit2,
} from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { ModelSelector } from '~/components/chat/model-selector';
import { PROVIDER_METADATA, type ProviderId } from '~/lib/providers';
import { client } from '~/lib/api-client';
import { api } from '~/trpc/react';
import useProject from '~/hooks/use-project';

export interface ChatMessage {
  id: string;
  dbQuestionId?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  provider?: ProviderId;
  modelId?: string;
  mode?: 'rag' | 'simple';
  isBookmarked?: boolean;
  fileReferences?: Array<{
    fileName: string;
    sourceCode: string;
    summary: string;
    similarity?: number;
  }>;
}

interface ChatViewProps {
  projectId: string;
  projectName: string;
  chatProvider?: ProviderId;
  chatModel?: string;
  initialQuestions?: Array<{
    id: string;
    question: string;
    answers: string;
    fileReference: unknown;
    isPinned?: boolean;
    isBookmarked?: boolean;
    createdAt: Date | string;
  }>;
  activeThreadId?: string | null;
}

export function ChatView({
  projectId,
  projectName,
  chatProvider = 'GEMINI',
  chatModel = 'gemini-2.5-flash',
  initialQuestions = [],
  activeThreadId,
}: ChatViewProps) {
  const router = useRouter();
  const { project } = useProject();

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (activeThreadId && initialQuestions && initialQuestions.length > 0) {
      const matched = initialQuestions.find((q) => q.id === activeThreadId);
      if (matched) {
        return [
          {
            id: `u-${matched.id}`,
            role: 'user',
            content: matched.question,
            createdAt: new Date(matched.createdAt),
          },
          {
            id: `a-${matched.id}`,
            dbQuestionId: matched.id,
            role: 'assistant',
            content: matched.answers,
            createdAt: new Date(matched.createdAt),
            isBookmarked: matched.isBookmarked ?? false,
            fileReferences: Array.isArray(matched.fileReference)
              ? (matched.fileReference as ChatMessage['fileReferences'])
              : [],
          },
        ];
      }
    }
    return [];
  });

  React.useEffect(() => {
    if (activeThreadId && initialQuestions.length > 0) {
      const matched = initialQuestions.find((q) => q.id === activeThreadId);
      if (matched) {
        setMessages([
          {
            id: `u-${matched.id}`,
            role: 'user',
            content: matched.question,
            createdAt: new Date(matched.createdAt),
          },
          {
            id: `a-${matched.id}`,
            dbQuestionId: matched.id,
            role: 'assistant',
            content: matched.answers,
            createdAt: new Date(matched.createdAt),
            isBookmarked: matched.isBookmarked ?? false,
            fileReferences: Array.isArray(matched.fileReference)
              ? (matched.fileReference as ChatMessage['fileReferences'])
              : [],
          },
        ]);
        return;
      }
    }
    // Clean canvas when starting a new chat or no thread selected
    setMessages([]);
  }, [activeThreadId, initialQuestions]);

  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [chatMode, setChatMode] = React.useState<'rag' | 'simple'>('rag');
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(chatProvider);
  const [selectedModel, setSelectedModel] = React.useState<string>(chatModel);
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>(['GEMINI']);

  // File Reference Inspector Slide-over State
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorFiles, setInspectorFiles] = React.useState<
    Array<{ fileName: string; sourceCode: string; summary: string }>
  >([]);
  const [activeFileIndex, setActiveFileIndex] = React.useState(0);

  // Load configured keys to pass to selector
  React.useEffect(() => {
    async function loadKeys() {
      try {
        const res = await client.keys.$get();
        if (res.ok) {
          const data = await res.json();
          if ('keys' in data && Array.isArray(data.keys)) {
            const configured = data.keys
              .filter((k: any) => k.status === 'VALID' || k.status === 'UNVERIFIED')
              .map((k: any) => k.provider as ProviderId);
            if (configured.length > 0) {
              setValidProviders(configured);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user keys:', err);
      }
    }
    void loadKeys();
  }, []);

  const toggleBookmarkMutation = api.project.toggleBookmarkQuestion.useMutation({
    onSuccess: (_, variables) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.dbQuestionId === variables.questionId
            ? { ...m, isBookmarked: !m.isBookmarked }
            : m
        )
      );
      toast.success('Bookmark updated');
    },
    onError: () => toast.error('Failed to update bookmark'),
  });

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await client.projects[':id'].chat.$post({
        param: { id: projectId },
        json: {
          query: userText,
          chatProvider: selectedProvider,
          chatModel: selectedModel,
          mode: chatMode,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMessage = (err as any)?.error || 'Failed to generate response';
        toast.error(errorMessage);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Error:** ${errorMessage}`,
            createdAt: new Date(),
          },
        ]);
        return;
      }

      const data = await res.json();
      if ('answer' in data) {
        const fileRefs = (data.fileReferences as ChatMessage['fileReferences']) ?? [];

        let savedQuestionId: string | undefined = undefined;
        try {
          const saveRes = await client.projects[':id'].questions.$post({
            param: { id: projectId },
            json: {
              question: userText,
              answers: data.answer,
              fileReference: fileRefs,
            },
          });
          if (saveRes.ok) {
            const savedData = await saveRes.json();
            if ('question' in savedData && savedData.question) {
              savedQuestionId = savedData.question.id;
            }
          }
        } catch (e) {
          console.error('Failed to auto-save question:', e);
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          dbQuestionId: savedQuestionId,
          role: 'assistant',
          content: data.answer,
          createdAt: new Date(),
          provider: selectedProvider,
          modelId: selectedModel,
          mode: chatMode,
          isBookmarked: false,
          fileReferences: fileRefs,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // If this was a new chat without an activeThreadId, update route to the saved thread
        if (!activeThreadId && savedQuestionId) {
          router.push(`/dashboard?threadId=${savedQuestionId}`);
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const openInspector = (refs: Array<{ fileName: string; sourceCode: string; summary: string }>, startIndex = 0) => {
    setInspectorFiles(refs);
    setActiveFileIndex(startIndex);
    setInspectorOpen(true);
  };

  const activeInspectorFile = inspectorFiles[activeFileIndex] ?? null;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 relative select-none">
      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 max-w-4xl w-full mx-auto pb-28">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 max-w-xl mx-auto space-y-6 pt-4">
            <div>
              <div className="relative size-10 mb-3 mx-auto opacity-90">
                <Image src="/logo.png" alt="RepoSense" fill className="object-contain" priority />
              </div>
              <h2 className="text-base sm:text-lg font-medium text-foreground tracking-tight">
                How can I help with {projectName}?
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Ask architectural questions, request code analysis, or link a new repository URL to RepoSense.
              </p>
            </div>

            {/* Quick Prompt Suggestions & Link New Repository Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              <button
                type="button"
                onClick={() => {
                  setInput('Provide an architectural overview of this repository.');
                }}
                className="p-3 rounded-xl border bg-card/60 hover:bg-card hover:border-primary/40 text-xs transition-all shadow-xs group"
              >
                <div className="font-medium text-foreground flex items-center justify-between">
                  <span>Architecture Overview</span>
                  <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Summarize key components, patterns, and entry points.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInput('Explain how authentication and authorization work in this codebase.');
                }}
                className="p-3 rounded-xl border bg-card/60 hover:bg-card hover:border-primary/40 text-xs transition-all shadow-xs group"
              >
                <div className="font-medium text-foreground flex items-center justify-between">
                  <span>Authentication Flow</span>
                  <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Trace auth lifecycle, middleware, and user context.
                </p>
              </button>

              <Link
                href="/pull-requests"
                className="p-3 rounded-xl border bg-card/60 hover:bg-card hover:border-primary/40 text-xs transition-all shadow-xs group block"
              >
                <div className="font-medium text-foreground flex items-center justify-between">
                  <span>Inspect Pull Requests</span>
                  <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Review open PRs, commit velocity, and change summaries.
                </p>
              </Link>

              <Link
                href="/create"
                className="p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-xs transition-all shadow-xs group block"
              >
                <div className="font-medium text-foreground flex items-center justify-between">
                  <span className="text-primary font-semibold flex items-center gap-1.5">
                    <FolderGit2 className="size-3.5" />
                    Link Another Repository
                  </span>
                  <ArrowRight className="size-3 text-primary group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Connect a new GitHub repository URL to your RepoSense workspace.
                </p>
              </Link>
            </div>
          </div>
        )}

        {/* Message Thread List */}
        <div className="space-y-6">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const provMeta = message.provider ? PROVIDER_METADATA[message.provider] : null;

            return (
              <div
                key={message.id}
                className={`flex gap-3 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="size-7 rounded-lg bg-muted border flex items-center justify-center shrink-0 mt-0.5">
                    {provMeta ? (
                      <div className="relative size-4">
                        <Image
                          src={provMeta.logoAsset}
                          alt={provMeta.displayName}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <Bot className="size-4 text-primary" />
                    )}
                  </div>
                )}

                <div className={`space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start flex-1'}`}>
                  {/* Header info */}
                  <div className={`flex items-center gap-2 text-[11px] text-muted-foreground ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-medium text-foreground">
                      {isUser ? 'You' : `${provMeta?.displayName ?? 'AI'} (${message.modelId ?? selectedModel})`}
                    </span>
                    <span>•</span>
                    <span>{message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Body Canvas */}
                  {isUser ? (
                    <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm shadow-xs whitespace-pre-wrap inline-block">
                      {message.content}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-card p-4 text-foreground shadow-xs space-y-4">
                      {/* Markdown Answer */}
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                        <MDEditor.Markdown source={message.content} />
                      </div>

                      {/* File Citation Strip */}
                      {message.fileReferences && message.fileReferences.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <FileCode className="size-3.5 text-primary" />
                            <span>Grounded Context Citations ({message.fileReferences.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {message.fileReferences.map((ref, idx) => (
                              <button
                                key={`${ref.fileName}-${idx}`}
                                type="button"
                                onClick={() => openInspector(message.fileReferences!, idx)}
                                className="group flex items-center gap-1.5 rounded-lg border bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs font-mono transition-colors border-border/70"
                              >
                                <Code2 className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="text-foreground font-medium truncate max-w-[200px]">
                                  {ref.fileName}
                                </span>
                                {ref.similarity && (
                                  <span className="text-[10px] text-muted-foreground/80 bg-background/80 px-1 rounded">
                                    {(ref.similarity * 100).toFixed(0)}%
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Utilities */}
                      <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              void navigator.clipboard.writeText(message.content);
                              toast.success('Answer copied to clipboard');
                            }}
                          >
                            <Copy className="size-3" />
                            <span>Copy Answer</span>
                          </Button>

                          {project?.repoUrl && (
                            <Link href={project.repoUrl} target="_blank" rel="noreferrer">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="size-3" />
                                <span>View on GitHub</span>
                              </Button>
                            </Link>
                          )}
                        </div>

                        {message.dbQuestionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (message.dbQuestionId) {
                                toggleBookmarkMutation.mutate({ questionId: message.dbQuestionId });
                              }
                            }}
                            className={`h-7 px-2 text-xs gap-1 ${
                              message.isBookmarked
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Bookmark className={`size-3 ${message.isBookmarked ? 'fill-primary' : ''}`} />
                            <span>{message.isBookmarked ? 'Bookmarked' : 'Save to QA History'}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="size-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking / Streaming Shimmer */}
          {isLoading && (
            <div className="flex gap-3 text-sm justify-start">
              <div className="size-7 rounded-lg bg-muted border flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="size-4 text-primary animate-spin" />
              </div>
              <div className="rounded-xl border bg-card p-3 shadow-xs text-xs text-muted-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-ping" />
                <span className="animate-pulse">Retrieving grounded vector context & reasoning...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Docked Floating Chat Input Bar (Claude-style) */}
      <div className="absolute bottom-3 left-0 right-0 px-4 md:px-8 z-10 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 overflow-hidden">
            {/* Auto-expanding Compact Textarea */}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write a message or ask about ${projectName}...`}
              className="min-h-[42px] max-h-[160px] resize-none border-0 bg-transparent px-3.5 py-2.5 text-sm focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/60 leading-snug"
              rows={1}
            />

            {/* Compact Bottom Toolbar Row: Controls & Send Button */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Compact Mode Pill */}
                <div className="flex items-center rounded-lg border bg-background/80 p-0.5 text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={() => setChatMode('rag')}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                      chatMode === 'rag'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Retrieve repository files for grounding"
                  >
                    <Layers className="size-2.5" />
                    <span>RAG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode('simple')}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                      chatMode === 'simple'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Direct model chat without vector retrieval"
                  >
                    <MessageSquare className="size-2.5" />
                    <span>Direct</span>
                  </button>
                </div>

                {/* Compact Model Selector */}
                <ModelSelector
                  selectedProvider={selectedProvider}
                  selectedModel={selectedModel}
                  userValidProviders={validProviders}
                  onSelect={(prov, model) => {
                    setSelectedProvider(prov);
                    setSelectedModel(model);
                  }}
                  disabled={isLoading}
                />

                {/* File Mention Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      title="Mention a file"
                    >
                      <AtSign className="size-3" />
                      <span className="hidden sm:inline">File</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2 text-xs space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      Mention Repo File
                    </p>
                    <div className="space-y-1 font-mono text-[11px]">
                      {['src/server/auth.ts', 'src/lib/providers.ts', 'prisma/schema.prisma', 'src/app/api/trpc/[trpc]/route.ts'].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setInput((prev) => `${prev} @${f} `)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-muted truncate block text-foreground"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="size-7 rounded-full shadow-xs shrink-0"
              >
                {isLoading ? (
                  <Sparkles className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over File Reference Inspector (Gemini Reference UI) */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6 space-y-5 select-none">
          {activeInspectorFile && (
            <>
              <SheetHeader className="space-y-2 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <FileCode className="size-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground truncate max-w-sm">
                      {activeInspectorFile.fileName}
                    </span>
                  </div>
                  {project?.repoUrl && (
                    <Link
                      href={`${project.repoUrl}/blob/main/${activeInspectorFile.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
                <SheetTitle className="text-sm font-semibold text-foreground">
                  File Context & Grounded Excerpt
                </SheetTitle>
              </SheetHeader>

              {/* File Multi-tabs if multiple files attached */}
              {inspectorFiles.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-border/40">
                  {inspectorFiles.map((f, idx) => (
                    <button
                      key={`${f.fileName}-${idx}`}
                      type="button"
                      onClick={() => setActiveFileIndex(idx)}
                      className={`text-xs font-mono px-2 py-1 rounded-md transition-colors truncate max-w-[160px] ${
                        idx === activeFileIndex
                          ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {f.fileName.split('/').pop()}
                    </button>
                  ))}
                </div>
              )}

              {/* AI Summary of File */}
              {activeInspectorFile.summary && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block">
                    File Summary
                  </span>
                  <p className="leading-relaxed">{activeInspectorFile.summary}</p>
                </div>
              )}

              {/* Source Code Viewer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Indexed Code Content</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={() => {
                      void navigator.clipboard.writeText(activeInspectorFile.sourceCode);
                      toast.success('Source code copied to clipboard');
                    }}
                  >
                    <Copy className="size-3" />
                    <span>Copy</span>
                  </Button>
                </div>
                <pre className="rounded-lg border bg-muted/60 p-3 text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed text-foreground select-text">
                  <code>{activeInspectorFile.sourceCode}</code>
                </pre>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ChatView;
