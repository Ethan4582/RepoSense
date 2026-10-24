'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Search,
  Calendar,
  Sparkles,
  ExternalLink,
  Copy,
  Trash2,
  Pin,
  FolderGit2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { WikiMarkdown } from '~/components/wiki/markdown';
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

  // Dropdown accordion state: store expanded question IDs
  const [expandedQuestionIds, setExpandedQuestionIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  return (
    <div className="flex flex-col h-full w-full px-6 py-8 md:px-12 lg:px-16 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#ececec] pb-5">
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
            <SelectTrigger className="h-9 min-w-[200px] text-xs gap-2 rounded-[12px] border border-[#e0e0e0] bg-background transition-colors duration-200 ease-out hover:border-[#d4d4d4]">
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
          className="pl-10 h-11 text-sm bg-muted/20 border border-[#e0e0e0] rounded-[12px] transition-colors duration-200 ease-out hover:border-[#d4d4d4]"
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
          <div className="divide-y divide-[#f0f0f0]">
            {bookmarks.map((b) => {
              const repoUrl = (b as unknown as { project?: { repoUrl?: string } }).project?.repoUrl ?? project?.repoUrl;
              const targetProjectId = b.projectId || projectId;
              const isExpanded = expandedQuestionIds.has(b.id);

              // Parse repoOwner and repoName from project or repoUrl
              let repoOwner = (b as unknown as { project?: { repoOwner?: string } }).project?.repoOwner ?? '';
              let repoName = (b as unknown as { project?: { repoName?: string } }).project?.repoName ?? '';
              if (!repoOwner && repoUrl) {
                const parts = repoUrl.replace(/\.git$/, '').split('/');
                repoName = parts.pop() ?? '';
                repoOwner = parts.pop() ?? '';
              }

              return (
                <div
                  key={b.id}
                  className="py-4 hover:bg-muted/10 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="space-y-1.5 flex-1 min-w-0 cursor-pointer select-none"
                      onClick={(e) => toggleExpand(b.id, e)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(b.id, e)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm"
                          aria-label={isExpanded ? 'Collapse answer' : 'Expand answer'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-foreground/80" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </button>

                        {b.isPinned && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600">
                            <Pin className="size-2.5 fill-amber-500/20" />
                            Pinned
                          </Badge>
                        )}

                        <h3 className="font-semibold text-base text-foreground hover:text-primary transition-colors">
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

                      <div className="flex items-center gap-2 pl-6 text-[11px] text-muted-foreground">
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

                  {/* Collapsible Answer Accordion with Proper GitHub Citation Boxes */}
                  {isExpanded && (
                    <div className="ml-6 rounded-lg border border-border/50 bg-muted/15 p-5 text-sm text-foreground">
                      <WikiMarkdown
                        content={b.answers}
                        githubRepo={repoOwner && repoName ? { owner: repoOwner, repo: repoName } : undefined}
                        branch={b.branch ?? 'main'}
                        className="compact"
                        onCitation={(target) => {
                          if (targetProjectId) {
                            router.push(`/wiki/${targetProjectId}?questionId=${b.id}`);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
