'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  const { project } = useProject();

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      const list: ChatMessage[] = [];
      const questionsToLoad = activeThreadId
        ? initialQuestions.filter((q) => q.id === activeThreadId)
        : initialQuestions;

      questionsToLoad.forEach((q) => {
        list.push({
          id: `u-${q.id}`,
          role: 'user',
          content: q.question,
          createdAt: new Date(q.createdAt),
        });
        list.push({
          id: `a-${q.id}`,
          dbQuestionId: q.id,
          role: 'assistant',
          content: q.answers,
          createdAt: new Date(q.createdAt),
          isBookmarked: q.isBookmarked ?? false,
          fileReferences: Array.isArray(q.fileReference)
            ? (q.fileReference as ChatMessage['fileReferences'])
            : [],
        });
      });
      return list;
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
      }
    } else if (!activeThreadId && initialQuestions.length === 0) {
      setMessages([]);
    }
  }, [activeThreadId, initialQuestions]);

  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [chatMode, setChatMode] = React.useState<'rag' | 'simple'>('rag');
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(chatProvider);
  const [selectedModel, setSelectedModel] = React.useState<string>(chatModel);
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>([
    'GEMINI',
    'OPENAI',
    'ANTHROPIC',
    'META',
    'DEEPSEEK',
    'XAI',
    'GROQ',
  ]);

  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorFiles, setInspectorFiles] = React.useState<Array<{
    fileName: string;
    sourceCode: string;
    summary: string;
  }>>([]);
  const [activeFileIndex, setActiveFileIndex] = React.useState(0);

  const toggleBookmarkMutation = api.project.toggleBookmarkQuestion.useMutation({
    onSuccess: (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.dbQuestionId === data.id ? { ...m, isBookmarked: data.isBookmarked } : m
        )
      );
      toast.success(data.isBookmarked ? 'Saved to QA Bookmarks' : 'Removed from QA Bookmarks');
    },
    onError: () => toast.error('Failed to update bookmark'),
  });

  React.useEffect(() => {
    async function loadKeys() {
      try {
        const res = await client.keys.$get();
        if (res.ok) {
          const data = await res.json();
          if (data && 'keys' in data && Array.isArray(data.keys)) {
            const configured = (data.keys as Array<{ status?: string; provider?: string }>)
              .filter((k) => k.status === 'VALID' || k.status === 'UNVERIFIED')
              .map((k) => k.provider as ProviderId)
              .filter(Boolean);
            if (configured.length > 0) {
              setValidProviders(configured);
              if (!configured.includes(selectedProvider)) {
                setSelectedProvider(configured[0]!);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user keys:', err);
      }
    }
    void loadKeys();
  }, [selectedProvider]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await client.projects[':id'].questions.ask.$post({
        param: { id: projectId },
        json: {
          question: query,
          provider: selectedProvider,
          modelId: selectedModel,
          mode: chatMode,
        },
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string } | null;
        const errorMessage = err?.error ?? 'Failed to generate answer';
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
              question: query,
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
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <div className="relative size-10 mb-3 opacity-90">
              <Image src="/logo.png" alt="RepoSense" fill className="object-contain" priority />
            </div>
            <h2 className="text-base sm:text-lg font-medium text-foreground tracking-tight">
              How can I help with {projectName}?
            </h2>
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
                            <span>Context ({message.fileReferences.slice(0, 5).length} files)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {message.fileReferences.slice(0, 5).map((ref, idx) => (
                              <button
                                key={idx}
                                onClick={() => openInspector(message.fileReferences ?? [], idx)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-muted/30 hover:bg-muted text-xs font-mono text-foreground hover:text-primary transition-colors group cursor-pointer"
                              >
                                <Code2 className="size-3 text-muted-foreground group-hover:text-primary" />
                                <span className="truncate max-w-[180px]">{ref.fileName}</span>
                                <ChevronRight className="size-3 text-muted-foreground opacity-60" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Answer Action Bar */}
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

      {/* Slide-Over Code Inspector (Sheet with File Switcher Tabs) */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col h-full bg-card">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2 font-mono truncate">
                <FileCode className="size-4 text-primary shrink-0" />
                <span className="truncate">{activeInspectorFile?.fileName ?? 'File Inspector'}</span>
              </SheetTitle>

              {project?.repoUrl && activeInspectorFile && (
                <Link
                  href={`${project.repoUrl}/blob/main/${activeInspectorFile.fileName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </div>

            {/* File Switcher Tabs for cited files */}
            {inspectorFiles.length > 1 && (
              <div className="flex items-center gap-1 pt-2 overflow-x-auto pb-1 scrollbar-none">
                {inspectorFiles.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono truncate max-w-[150px] transition-colors ${
                      idx === activeFileIndex
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {f.fileName.split('/').pop()}
                  </button>
                ))}
              </div>
            )}
          </SheetHeader>

          {activeInspectorFile && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* AI Summary Callout */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  AI File Summary
                </h4>
                <p className="text-xs text-foreground leading-relaxed">
                  {activeInspectorFile.summary}
                </p>
              </div>

              {/* Source Code Viewer */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Source Code
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      void navigator.clipboard.writeText(activeInspectorFile.sourceCode);
                      toast.success('Code copied to clipboard');
                    }}
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre">
                  <code>{activeInspectorFile.sourceCode}</code>
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ChatView;
