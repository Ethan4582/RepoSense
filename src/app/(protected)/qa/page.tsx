'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Search,
  Calendar,
  FileCode,
  Sparkles,
  ExternalLink,
  Copy,
  Trash2,
  Pin,
  Code2,
  FolderGit2,
} from 'lucide-react';
import { toast } from 'sonner';
import MDEditor from '@uiw/react-md-editor';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import useProject from '~/hooks/use-project';
import { api } from '~/trpc/react';

type CitationFile = {
  fileName: string;
  sourceCode: string;
  summary: string;
};

export default function QaBookmarksPage() {
  const router = useRouter();
  const { projectId, project } = useProject();
  const [search, setSearch] = React.useState('');

  // Inspector state
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorFiles, setInspectorFiles] = React.useState<CitationFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = React.useState(0);

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = api.project.getBookmarkedQuestions.useQuery(
    { projectId: projectId ?? '', query: search },
    { enabled: !!projectId }
  );

  const toggleBookmarkMutation = api.project.toggleBookmarkQuestion.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success('Bookmark removed');
    },
    onError: () => toast.error('Failed to remove bookmark'),
  });

  const openInspector = (refs: CitationFile[], index = 0) => {
    if (!refs || refs.length === 0) return;
    setInspectorFiles(refs);
    setActiveFileIndex(index);
    setInspectorOpen(true);
  };

  const activeInspectorFile = inspectorFiles[activeFileIndex] ?? null;

  if (!project) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-primary/10 p-4 text-primary mb-4">
          <FolderGit2 className="size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No Project Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a project from the sidebar to view bookmarked questions and answers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bookmark className="size-6 text-primary fill-primary/20" />
            QA Bookmarks Vault
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Searchable knowledge base of bookmarked inquiries and code citations for{' '}
            <strong className="text-foreground">{project.name}</strong>.
          </p>
        </div>

        {/* Real-time search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search saved answers & files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/20"
          />
        </div>
      </div>

      {/* Bookmarks Document List */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        <div className="border-b bg-muted/20 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Saved Inquiries ({bookmarks?.length ?? 0})</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Sparkles className="size-5 text-primary animate-spin" />
            <span>Searching bookmarked questions...</span>
          </div>
        ) : !bookmarks || bookmarks.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <Bookmark className="size-8 mx-auto text-muted-foreground/30" />
            <p className="font-medium text-foreground">
              {search ? 'No matching bookmarks found.' : 'No bookmarked Q&As yet.'}
            </p>
            <p className="text-[11px]">
              When chatting with the AI assistant in Chat & Discussions, click &quot;Save to QA History&quot; on any answer to bookmark it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookmarks.map((b) => {
              const fileRefs = (Array.isArray(b.fileReference) ? b.fileReference : []) as unknown as CitationFile[];

              return (
                <div
                  key={b.id}
                  className="p-5 hover:bg-muted/30 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {b.isPinned && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600">
                            <Pin className="size-2.5 fill-amber-500/20" />
                            Pinned
                          </Badge>
                        )}
                        <h3 className="font-semibold text-sm text-foreground">
                          {b.question}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(b.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {b.user && (
                          <>
                            <span>•</span>
                            <span>Asked by {b.user.firstName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard?threadId=${b.id}`)}
                        className="h-7 text-xs px-2.5"
                      >
                        Jump to Chat
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Copy Answer"
                        onClick={() => {
                          void navigator.clipboard.writeText(b.answers);
                          toast.success('Answer copied to clipboard');
                        }}
                      >
                        <Copy className="size-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        title="Remove Bookmark"
                        onClick={() => toggleBookmarkMutation.mutate({ questionId: b.id })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Answer Preview */}
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-foreground prose prose-sm dark:prose-invert max-w-none">
                    <MDEditor.Markdown source={b.answers} />
                  </div>

                  {/* 5-File Citation Strip */}
                  {fileRefs.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
                        <FileCode className="size-3 text-primary" />
                        Cited Files:
                      </span>
                      {fileRefs.slice(0, 5).map((ref, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openInspector(fileRefs, idx)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-background hover:bg-muted text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Code2 className="size-2.5" />
                          <span className="truncate max-w-[150px]">{ref.fileName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
              <div className="rounded-lg border bg-muted/40 p-4 space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  AI File Summary
                </h4>
                <p className="text-xs text-foreground leading-relaxed">
                  {activeInspectorFile.summary}
                </p>
              </div>

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
