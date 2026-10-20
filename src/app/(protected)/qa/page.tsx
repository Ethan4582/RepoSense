'use client';

import * as React from 'react';
import {
  MessageSquare,
  Search,
  Calendar,
  FileCode,
  Sparkles,
  ChevronRight,
  Bot,
  ExternalLink,
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import useProject from '~/hooks/use-project';
import { api } from '~/trpc/react';
import CodeReferences from '../dashboard/code-refernces';

export default function QaPage() {
  const { projectId, project } = useProject();
  const [search, setSearch] = React.useState('');
  const [selectedQuestion, setSelectedQuestion] = React.useState<any>(null);

  const { data: questions, isLoading } = api.project.getQuestion.useQuery(
    { projectId: projectId ?? '' },
    { enabled: !!projectId }
  );

  const filteredQuestions = React.useMemo(() => {
    if (!questions) return [];
    if (!search.trim()) return questions;
    const term = search.toLowerCase();
    return questions.filter(
      (q) =>
        q.question.toLowerCase().includes(term) ||
        q.answers.toLowerCase().includes(term)
    );
  }, [questions, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            Q&A History & Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and search all questions asked and answered by AI across{' '}
            <strong className="text-foreground">{project?.name ?? 'this repository'}</strong>.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search saved answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Questions List */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="border-b bg-muted/20 px-6 py-4">
          <CardTitle className="text-base font-semibold">
            Saved Inquiries ({filteredQuestions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading saved questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? 'No matching questions found.' : 'No saved questions yet. Ask questions in the Overview chat to see them recorded here.'}
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                className="group flex items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-xs hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {q.user?.imageUrl ? (
                    <img
                      src={q.user.imageUrl}
                      alt={q.user.firstName ?? 'User'}
                      className="size-8 rounded-full border shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {q.user?.firstName?.[0] ?? 'U'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {q.question}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(q.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {q.answers}
                    </p>

                    {Array.isArray(q.fileReference) && q.fileReference.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
                          <FileCode className="size-2.5" />
                          {q.fileReference.length} References
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Selected Question Detail Side Sheet */}
      <Sheet open={!!selectedQuestion} onOpenChange={(open) => !open && setSelectedQuestion(null)}>
        {selectedQuestion && (
          <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col h-full bg-card">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle className="text-base font-bold text-foreground">
                {selectedQuestion.question}
              </SheetTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <span>Asked on {new Date(selectedQuestion.createdAt).toLocaleString()}</span>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="rounded-xl border bg-muted/20 p-5 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  AI Answer
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                  <MDEditor.Markdown source={selectedQuestion.answers} />
                </div>
              </div>

              {Array.isArray(selectedQuestion.fileReference) && selectedQuestion.fileReference.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="size-3.5 text-primary" />
                    Source References ({selectedQuestion.fileReference.length})
                  </h3>
                  <CodeReferences fileReferences={selectedQuestion.fileReference as any} />
                </div>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
