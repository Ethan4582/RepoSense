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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
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

function getCitationFiles(reference: unknown): CitationFile[] {
  if (Array.isArray(reference)) return reference as CitationFile[];
  if (
    reference &&
    typeof reference === 'object' &&
    Array.isArray((reference as { citations?: unknown }).citations)
  ) {
    return (reference as { citations: CitationFile[] }).citations;
  }
  return [];
}

export default function QaBookmarksPage() {
  const router = useRouter();
  const { projectId, project, projects, setProjectId } = useProject();
  const [selectedProjectFilter, setSelectedProjectFilter] = React.useState<string>(projectId ?? 'all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (projectId && selectedProjectFilter === 'all') {
      setSelectedProjectFilter(projectId);
    }
  }, [projectId]);

  const queryProjectId = selectedProjectFilter === 'all' ? undefined : selectedProjectFilter;

  // Inspector state
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorFiles, setInspectorFiles] = React.useState<CitationFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = React.useState(0);
  const [activeRepoUrl, setActiveRepoUrl] = React.useState<string | undefined>(undefined);

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = api.project.getBookmarkedQuestions.useQuery(
    { projectId: queryProjectId, query: search },
    { refetchInterval: 5000 }
  );

  const toggleBookmarkMutation = api.project.toggleBookmarkQuestion.useMutation({
    onSuccess: () => {
      void refetch();
      toast.success('Bookmark removed');
    },
    onError: () => toast.error('Failed to remove bookmark'),
  });

  const openInspector = (refs: CitationFile[], index = 0, repoUrl?: string) => {
    if (!refs || refs.length === 0) return;
    setInspectorFiles(refs);
    setActiveFileIndex(index);
    setActiveRepoUrl(repoUrl ?? project?.repoUrl);
    setInspectorOpen(true);
  };

  const activeInspectorFile = inspectorFiles[activeFileIndex] ?? null;

  return (
    <div className="flex flex-col h-full w-full px-6 py-8 md:px-12 lg:px-16 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bookmark className="size-6 text-primary fill-primary/20" />
            QA Bookmarks Vault
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Searchable knowledge base of saved inquiries and code citations
            {project && selectedProjectFilter !== 'all' ? (
              <>
                {' for '}
                <strong className="text-foreground">{project.name}</strong>
              </>
            ) : (
              ' across all linked repositories'
            )}.
          </p>
        </div>

        {/* Repository Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Repository:</span>
          <Select
            value={selectedProjectFilter}
            onValueChange={(val) => {
              setSelectedProjectFilter(val);
              if (val !== 'all') {
                setProjectId(val);
              }
            }}
          >
            <SelectTrigger className="h-9 min-w-[200px] text-xs gap-2 border-border/80 bg-background">
              <FolderGit2 className="size-3.5 text-primary shrink-0" />
              <SelectValue placeholder="All Repositories" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all" className="text-xs font-medium">
                All Repositories
              </SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  <span className="font-medium truncate">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prominent Wide Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search saved answers, code citations, and questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 text-sm bg-muted/20 border-border/70 rounded-lg shadow-xs"
        />
      </div>

      {/* Saved Inquiries Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
        <span>Saved Inquiries ({bookmarks?.length ?? 0})</span>
      </div>

      {/* Bookmarks List */}
      <div className="w-full">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Sparkles className="size-5 text-primary animate-spin" />
            <span>Searching bookmarked questions...</span>
          </div>
        ) : !bookmarks || bookmarks.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted-foreground space-y-3">
            <Bookmark className="size-8 mx-auto text-muted-foreground/30" />
            <p className="font-medium text-foreground text-sm">
              {search ? 'No matching bookmarks found.' : 'No bookmarked Q&As yet.'}
            </p>
            <p className="text-xs max-w-sm mx-auto leading-relaxed">
              When chatting with the AI assistant in Chat & Discussions, click &quot;Save to QA History&quot; on any answer to bookmark key inquiries and code citations here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {bookmarks.map((b) => {
              const fileRefs = getCitationFiles(b.fileReference);
              const repoUrl = (b as unknown as { project?: { repoUrl?: string } }).project?.repoUrl ?? project?.repoUrl;
              const targetProjectId = b.projectId || projectId;

              return (
                <div
                  key={b.id}
                  className="py-5 hover:bg-muted/15 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="space-y-1 flex-1 min-w-0 cursor-pointer group"
                      onClick={() => {
                        if (targetProjectId) {
                          router.push(`/wiki/${targetProjectId}?questionId=${b.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {b.isPinned && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600">
                            <Pin className="size-2.5 fill-amber-500/20" />
                            Pinned
                          </Badge>
                        )}
                        <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                          {b.question}
                        </h3>

                        {/* Project Badge if in All Repositories view */}
                        {selectedProjectFilter === 'all' && (b as unknown as { project?: { name?: string } }).project?.name && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                            <FolderGit2 className="size-2.5 text-primary" />
                            {(b as unknown as { project?: { name?: string } }).project?.name}
                          </Badge>
                        )}
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
                            <span>Asked by {b.user.firstName ?? 'Anonymous'}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (targetProjectId) {
                            router.push(`/wiki/${targetProjectId}?questionId=${b.id}`);
                          }
                        }}
                        className="h-8 text-xs px-3 gap-1"
                      >
                        <span>Open Instance</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
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
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Remove Bookmark"
                        onClick={() => toggleBookmarkMutation.mutate({ questionId: b.id })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Answer Preview */}
                  <div
                    className="rounded-lg border border-border/50 bg-muted/15 p-4 text-xs text-foreground prose prose-sm dark:prose-invert max-w-none cursor-pointer"
                    onClick={() => {
                      if (targetProjectId) {
                        router.push(`/wiki/${targetProjectId}?questionId=${b.id}`);
                      }
                    }}
                  >
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
                          onClick={() => openInspector(fileRefs, idx, repoUrl)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border/60 bg-background hover:bg-muted text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Code2 className="size-2.5" />
                          <span className="truncate max-w-[200px]">{ref.fileName}</span>
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

              {activeRepoUrl && activeInspectorFile && (
                <Link
                  href={`${activeRepoUrl.replace(/\.git$/, '')}/blob/main/${activeInspectorFile.fileName}`}
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
