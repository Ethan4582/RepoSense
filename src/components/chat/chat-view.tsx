'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Send,
  Sparkles,
  FileCode,
  ExternalLink,
  ChevronRight,
  Code2,
  Copy,
  Check,
  Bookmark,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
  Bubble,
  BubbleContent,
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from '~/components/ui/chat';
import { ModelSelector } from '~/components/chat/model-selector';
import { PROVIDER_METADATA, type ProviderId } from '~/lib/providers';
import { client } from '~/lib/api-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  provider?: ProviderId;
  modelId?: string;
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
    fileReference: any;
    createdAt: Date | string;
  }>;
}

export function ChatView({
  projectId,
  projectName,
  chatProvider = 'GEMINI',
  chatModel = 'gemini-2.5-flash',
  initialQuestions = [],
}: ChatViewProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      // Map existing questions to chat history
      const list: ChatMessage[] = [];
      initialQuestions.forEach((q) => {
        list.push({
          id: `u-${q.id}`,
          role: 'user',
          content: q.question,
          createdAt: new Date(q.createdAt),
        });
        list.push({
          id: `a-${q.id}`,
          role: 'assistant',
          content: q.answers,
          createdAt: new Date(q.createdAt),
          fileReferences: Array.isArray(q.fileReference) ? q.fileReference : [],
        });
      });
      return list;
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Hi! I'm your AI codebase assistant for **${projectName}**.\n\nYou can ask me anything about the architecture, implementation details, dependencies, or specific files in this repository.`,
        createdAt: new Date(),
      },
    ];
  });

  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
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

  // Selected file reference for the side sheet
  const [selectedRef, setSelectedRef] = React.useState<{
    fileName: string;
    sourceCode: string;
    summary: string;
  } | null>(null);

  // Load configured keys to know valid providers
  React.useEffect(() => {
    async function loadKeys() {
      try {
        const res = await client.keys.$get();
        if (res.ok) {
          const data = await res.json();
          if (data && 'keys' in data && Array.isArray(data.keys)) {
            const configured = data.keys
              .filter((k: any) => k.status === 'VALID' || k.status === 'UNVERIFIED')
              .map((k: any) => k.provider as ProviderId);
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
    loadKeys();
  }, []);

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
        },
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMessage =
          typeof err === 'object' && err && 'error' in err
            ? (err as any).error
            : 'Failed to generate answer';
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
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          createdAt: new Date(),
          provider: selectedProvider,
          modelId: selectedModel,
          fileReferences: (data.fileReferences as any) ?? [],
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Auto save question to Q&A in background
        client.projects[':id'].questions.$post({
          param: { id: projectId },
          json: {
            question: query,
            answers: data.answer,
            fileReference: data.fileReferences,
          },
        }).catch(console.error);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] w-full flex-col rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Messages Thread Container */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const provMeta = message.provider ? PROVIDER_METADATA[message.provider] : null;

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={isUser ? 'end' : 'start'}>
                      <MessageAvatar className={isUser ? 'bg-primary text-primary-foreground' : 'bg-muted border'}>
                        {isUser ? (
                          <UserIcon className="size-4" />
                        ) : provMeta ? (
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
                      </MessageAvatar>

                      <MessageContent className={isUser ? 'items-end' : 'items-start'}>
                        <MessageHeader>
                          {isUser ? 'You' : `${provMeta?.displayName ?? 'AI'} (${message.modelId ?? selectedModel})`}
                        </MessageHeader>

                        <Bubble
                          variant={isUser ? 'default' : 'outline'}
                          align={isUser ? 'end' : 'start'}
                          className={isUser ? '' : 'bg-background/80 backdrop-blur-xs'}
                        >
                          <BubbleContent>
                            {isUser ? (
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            ) : (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <MDEditor.Markdown source={message.content} />
                              </div>
                            )}
                          </BubbleContent>
                        </Bubble>

                        {/* File References Cluster (Assistant Only) */}
                        {!isUser && message.fileReferences && message.fileReferences.length > 0 && (
                          <div className="mt-2 w-full space-y-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <FileCode className="size-3" />
                              {message.fileReferences.length} Source References
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {message.fileReferences.map((ref, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedRef(ref)}
                                  className="group flex items-center gap-1.5 rounded-md border bg-muted/40 hover:bg-muted px-2 py-1 text-[11px] text-foreground transition-colors"
                                >
                                  <Code2 className="size-3 text-primary group-hover:scale-110 transition-transform" />
                                  <span className="font-mono truncate max-w-[200px]">
                                    {ref.fileName}
                                  </span>
                                  <ChevronRight className="size-3 text-muted-foreground opacity-60" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <MessageFooter>
                          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {/* Streaming / Generating Shimmer indicator */}
              {isLoading && (
                <MessageScrollerItem messageId="loading-indicator">
                  <Message align="start">
                    <MessageAvatar className="bg-muted border animate-pulse">
                      <Sparkles className="size-4 text-primary animate-spin" />
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader>AI Assistant</MessageHeader>
                      <Bubble variant="outline" align="start" className="bg-background/80">
                        <BubbleContent>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-block size-2 rounded-full bg-primary animate-ping" />
                            <span className="font-medium animate-pulse">Searching code vectors and generating response...</span>
                          </div>
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Bottom Chat Bar with Model Selector */}
      <div className="border-t bg-background/95 p-3 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="relative rounded-xl border bg-muted/20 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this codebase... (Press Enter to send, Shift+Enter for newline)"
              className="min-h-[64px] max-h-[160px] resize-none border-0 bg-transparent p-3 text-sm focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/70"
            />

            <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 bg-background/40 rounded-b-xl">
              {/* T3-Style Model Selector Chip */}
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

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-8 gap-1.5 px-3 rounded-lg font-medium shadow-xs"
              >
                <span>Ask</span>
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Side Sheet for Code References */}
      <Sheet open={!!selectedRef} onOpenChange={(open) => !open && setSelectedRef(null)}>
        {selectedRef && (
          <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col h-full bg-card">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle className="text-base font-semibold flex items-center gap-2 font-mono">
                <FileCode className="size-4 text-primary" />
                {selectedRef.fileName}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  File Summary
                </h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedRef.summary}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Source Code
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedRef.sourceCode);
                      toast.success('Code copied to clipboard');
                    }}
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre">
                  <code>{selectedRef.sourceCode}</code>
                </pre>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
