'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Send,
  Sparkles,
  Code2,
  Copy,
  Check,
  AtSign,
  Layers,
  MessageSquare,
  FileCode,
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
import { PROVIDER_METADATA, getDefaultChatModel, type ProviderId } from '~/lib/providers';
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

export interface ChatViewProps {
  projectId: string;
  projectName?: string;
  chatProvider?: ProviderId;
  chatModel?: string;
  defaultProvider?: ProviderId;
  defaultModel?: string;
  initialQuestions?: any[];
  initialThreadId?: string | null;
  activeThreadId?: string | null;
}

export function ChatView({
  projectId,
  projectName = 'Repository',
  chatProvider,
  chatModel,
  defaultProvider = 'OPENAI',
  defaultModel = 'gpt-4o',
  initialQuestions = [],
  initialThreadId,
  activeThreadId,
}: ChatViewProps) {
  const { project } = useProject();
  const utils = api.useUtils();
  const effectiveThreadId = activeThreadId ?? initialThreadId;

  const [currentThreadId, setCurrentThreadId] = React.useState<string | null>(effectiveThreadId ?? null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const parseThreadMessages = (q: any): ChatMessage[] => {
    if (!q) return [];
    if (q.fileReference && typeof q.fileReference === 'object' && Array.isArray(q.fileReference.turns) && q.fileReference.turns.length > 0) {
      return q.fileReference.turns.map((turn: any, idx: number) => ({
        id: `${turn.role}-${q.id}-${idx}`,
        dbQuestionId: q.id,
        role: turn.role,
        content: turn.content,
        createdAt: turn.createdAt ? new Date(turn.createdAt) : new Date(q.createdAt),
        fileReferences: turn.fileReferences ?? [],
      }));
    }

    return [
      {
        id: `u-${q.id}`,
        role: 'user',
        content: q.question,
        createdAt: new Date(q.createdAt),
      },
      {
        id: `a-${q.id}`,
        dbQuestionId: q.id,
        role: 'assistant',
        content: q.answers,
        createdAt: new Date(q.createdAt),
        isBookmarked: q.isBookmarked ?? false,
        fileReferences: Array.isArray(q.fileReference) ? q.fileReference : [],
      },
    ];
  };

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (initialQuestions && initialQuestions.length > 0 && effectiveThreadId) {
      const matched = initialQuestions.find((q: any) => q.id === effectiveThreadId);
      if (matched) {
        return parseThreadMessages(matched);
      }
    }
    return [];
  });

  // Keep currentThreadId in sync when prop changes externally (e.g. sidebar navigation)
  React.useEffect(() => {
    setCurrentThreadId(effectiveThreadId ?? null);
    if (!effectiveThreadId) {
      setMessages([]);
    }
  }, [effectiveThreadId]);

  // Sync thread when currentThreadId or initialQuestions change
  React.useEffect(() => {
    if (currentThreadId && initialQuestions && initialQuestions.length > 0) {
      const matched = initialQuestions.find((q: any) => q.id === currentThreadId);
      if (matched) {
        setMessages(parseThreadMessages(matched));
      }
    }
  }, [currentThreadId, initialQuestions]);

  // Fallback load thread from API if not yet in initialQuestions
  React.useEffect(() => {
    if (!currentThreadId) return;

    const loadThread = async () => {
      try {
        const res = await client.projects[':id'].questions.$get({
          param: { id: projectId },
        });

        if (res.ok) {
          const data = await res.json();
          if ('questions' in data && Array.isArray(data.questions)) {
            const match = data.questions.find((q: any) => q.id === currentThreadId);
            if (match) {
              setMessages(parseThreadMessages(match));
            }
          }
        }
      } catch (e) {
        console.error('Failed to load thread:', e);
      }
    };

    void loadThread();
  }, [currentThreadId, projectId]);

  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  // Default to pure conversational General Chat Mode on fresh chat, or RAG mode on existing thread
  const [chatMode, setChatMode] = React.useState<'rag' | 'simple'>(() => {
    return effectiveThreadId ? 'rag' : 'simple';
  });
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(
    chatProvider ?? defaultProvider
  );
  const [selectedModel, setSelectedModel] = React.useState<string>(
    chatModel ?? defaultModel
  );
  const [validProviders, setValidProviders] = React.useState<ProviderId[]>([
    'OPENAI',
    'GEMINI',
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

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load configured keys to update valid providers
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
                const nextProv = configured[0]!;
                setSelectedProvider(nextProv);
                try {
                  setSelectedModel(getDefaultChatModel(nextProv));
                } catch {
                  setSelectedModel(nextProv === 'OPENAI' ? 'gpt-4o' : 'gemini-2.5-flash');
                }
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

  const handleCopy = (content: string, id: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

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
      const res = await (client.projects[':id'] as any).chat.$post({
        param: { id: projectId },
        json: {
          query,
          chatProvider: selectedProvider,
          chatModel: selectedModel,
          mode: chatMode,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
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
        const fullAnswer = data.answer as string;
        const fileRefs = (data.fileReferences as ChatMessage['fileReferences']) ?? [];
        const assistantMsgId = `a-${Date.now()}`;

        // Initialize empty assistant message for natural streaming effect
        const baseAssistantMsg: ChatMessage = {
          id: assistantMsgId,
          dbQuestionId: currentThreadId ?? undefined,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          provider: selectedProvider,
          modelId: selectedModel,
          mode: chatMode,
          isBookmarked: false,
          fileReferences: fileRefs,
        };

        setMessages((prev) => [...prev, baseAssistantMsg]);
        setIsLoading(false);

        // Stream text at a natural reading pace (chunks of 4-8 chars every 16-25ms)
        await new Promise<void>((resolve) => {
          let streamedIndex = 0;
          const chunkSize = Math.max(3, Math.floor(fullAnswer.length / 100));
          const interval = setInterval(() => {
            streamedIndex += chunkSize;
            if (streamedIndex >= fullAnswer.length) {
              streamedIndex = fullAnswer.length;
              clearInterval(interval);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: fullAnswer } : msg
                )
              );
              resolve();
            } else {
              const currentSlice = fullAnswer.slice(0, streamedIndex);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: currentSlice } : msg
                )
              );
            }
          }, 18);
        });

        // Save turns to DB maintaining invariant threadId across turns
        const currentTurns = [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
            fileReferences: m.fileReferences ?? [],
            createdAt: m.createdAt.toISOString(),
          })),
          {
            role: 'user' as const,
            content: query,
            createdAt: userMsg.createdAt.toISOString(),
          },
          {
            role: 'assistant' as const,
            content: fullAnswer,
            fileReferences: fileRefs,
            createdAt: new Date().toISOString(),
          },
        ];

        try {
          const saveRes = await (client.projects[':id'].questions as any).$post({
            param: { id: projectId },
            json: {
              threadId: currentThreadId ?? undefined,
              question: messages[0]?.role === 'user' ? messages[0].content : query,
              answers: fullAnswer,
              fileReference: fileRefs,
              turns: currentTurns,
            },
          });

          if (saveRes.ok) {
            const savedData = await saveRes.json();
            if ('question' in savedData && savedData.question) {
              const savedId = savedData.question.id;
              if (!currentThreadId) {
                setCurrentThreadId(savedId);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('threadId', savedId);
                  url.searchParams.delete('new');
                  window.history.replaceState(null, '', url.toString());
                }
              }
              void utils.project.getQuestions.invalidate();
            }
          }
        } catch (e) {
          console.error('Failed to auto-save question turns:', e);
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      toast.error(err?.message || 'Failed to submit query');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Failed to connect to AI server. Please check your network and API keys.',
          createdAt: new Date(),
        },
      ]);
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
    <div className="flex flex-col flex-1 min-h-full w-full relative">
      {/* Messages Canvas - naturally scrolls, aligned with input bar */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 pb-36 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
            <div className="relative size-10 mb-3 opacity-90">
              <Image src="/logo.png" alt="RepoSense" width={40} height={40} className="object-contain" priority />
            </div>
            <h2 className="text-base sm:text-lg font-medium text-foreground tracking-tight">
              {chatMode === 'simple'
                ? 'General AI Chat'
                : `Context-Aware Chat for ${projectName}`}
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mt-1 mb-6">
              {chatMode === 'simple'
                ? 'Pure conversational assistant for general programming, syntax, and concepts. Toggle RAG below to query this repository directly.'
                : 'Full codebase-aware context retrieval grounded in indexed repository files and architecture.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {chatMode === 'simple'
                ? [
                    'How does optimistic UI update work in React?',
                    'Explain difference between WebSocket and SSE.',
                    'Best practices for database connection pooling in Node.',
                    'How do I implement rate limiting with Redis?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-xs text-foreground/80 hover:text-foreground shadow-2xs"
                    >
                      "{suggestion}"
                    </button>
                  ))
                : [
                    'How does authentication work in this repo?',
                    'Where are database queries handled?',
                    'Explain the main background job queue.',
                    'What external APIs does this project depend on?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-xs text-foreground/80 hover:text-foreground shadow-2xs"
                    >
                      "{suggestion}"
                    </button>
                  ))}
            </div>
          </div>
        )}

        {/* Message Thread List - Clean, borderless, aligned */}
        <div className="space-y-6">
          {messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <div key={message.id} className="w-full">
                {isUser ? (
                  /* User message: clean bubble on the right without avatar/name */
                  <div className="flex justify-end w-full">
                    <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm shadow-xs whitespace-pre-wrap max-w-[85%] sm:max-w-[75%] leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  /* Assistant message: borderless, clean markdown on full width with copy button */
                  <div className="flex flex-col items-start w-full space-y-3">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed w-full">
                      <MDEditor.Markdown
                        source={message.content}
                        style={{ backgroundColor: 'transparent', color: 'inherit' }}
                      />
                    </div>

                    {/* File Citation Strip (RAG only) */}
                    {message.mode === 'rag' && message.fileReferences && message.fileReferences.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground mr-0.5">References:</span>
                        {message.fileReferences.slice(0, 4).map((ref, idx) => (
                          <button
                            key={idx}
                            onClick={() => openInspector(message.fileReferences ?? [], idx)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-muted/40 hover:bg-muted text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Code2 className="size-3 text-muted-foreground" />
                            <span className="truncate max-w-[140px]">{ref.fileName}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Simple, clean Copy Button */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(message.content, message.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Copy answer"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="size-3.5 text-emerald-500" />
                            <span className="text-[11px] text-emerald-500 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Docked Floating Chat Input Bar - Matched max-w-3xl for pixel-perfect centering */}
      <div className="sticky bottom-4 left-0 right-0 px-4 z-20 pointer-events-none mt-auto">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-lg transition-all focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 overflow-hidden">
            {/* Auto-expanding Compact Textarea */}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write a message or ask about ${projectName}...`}
              className="min-h-[46px] max-h-[160px] resize-none border-0 bg-transparent px-3.5 py-2.5 text-sm focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/60 leading-snug"
              rows={1}
            />

            {/* Compact Bottom Toolbar Row: Controls & Send Button */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode Pill Toggle: General Chat vs Codebase RAG */}
                <div className="flex items-center rounded-lg border bg-background/80 p-0.5 text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={() => setChatMode('simple')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                      chatMode === 'simple'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="General Chat: Pure conversational AI without repository indexing"
                  >
                    <MessageSquare className="size-2.5" />
                    <span>General Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode('rag')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                      chatMode === 'rag'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="RAG Mode: Full codebase-aware context retrieval grounded in indexed repository files"
                  >
                    <Layers className="size-2.5" />
                    <span>Codebase RAG</span>
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

      {/* Slide-Over Code Inspector */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col h-full bg-card">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2 font-mono truncate">
                <FileCode className="size-4 text-primary shrink-0" />
                <span className="truncate">{activeInspectorFile?.fileName ?? 'File Inspector'}</span>
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Tab Strip */}
          {inspectorFiles.length > 1 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/40 overflow-x-auto text-xs font-mono">
              {inspectorFiles.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                    activeFileIndex === idx
                      ? 'bg-background text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {file.fileName.split('/').pop()}
                </button>
              ))}
            </div>
          )}

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
            {activeInspectorFile ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 font-sans">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    File Summary
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {activeInspectorFile.summary}
                  </p>
                </div>

                <div className="rounded-lg border bg-background overflow-hidden">
                  <div className="bg-muted/50 px-3 py-1.5 border-b text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Source Code</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(activeInspectorFile.sourceCode);
                        toast.success('Source code copied');
                      }}
                      className="hover:text-foreground"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                  <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-foreground">
                    <code>{activeInspectorFile.sourceCode}</code>
                  </pre>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No file selected
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ChatView;
