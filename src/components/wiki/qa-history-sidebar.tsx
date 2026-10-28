'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { getApiBaseUrl } from '~/lib/api-client';

export interface QaHistoryItem {
  id: string;
  question: string;
  createdAt: string;
  answers?: string;
}

interface QaHistorySidebarProps {
  projectId: string;
  projectName: string;
  activeQuestionId?: string | null;
  open: boolean;
  onClose: () => void;
  onSelectQuestion: (questionId: string) => void;
}

export function QaHistorySidebar({
  projectId,
  projectName,
  activeQuestionId,
  open,
  onClose,
  onSelectQuestion,
}: QaHistorySidebarProps) {
  const [questions, setQuestions] = React.useState<QaHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let res = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/questions`, {
          credentials: 'include',
        });
        if (!res.ok) {
          res = await fetch(`${getApiBaseUrl()}/api/public/projects/${projectId}/questions`);
        }
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { questions?: QaHistoryItem[] };
          setQuestions(data.questions ?? []);
        }
      } catch {
        // network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  if (!open) return null;

  const filtered = questions.filter((q) =>
    q.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="animate-in slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-background shadow-xl duration-200">
      {/* Top Header matching AppSideBar */}
      <div className="flex flex-col gap-3 border-b border-border/70 p-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" priority />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              Repo<span className="text-primary">Sense</span>
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label="Close history sidebar"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        {/* Global Command palette search trigger */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="flex h-9 w-full items-center justify-between rounded-lg border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Search anything (Ctrl+K)"
        >
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span>Search...</span>
          </div>
          <kbd className="pointer-events-none rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl K
          </kbd>
        </button>

        {/* New Repository Button */}
        <Link href="/create" className="block">
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2 rounded-lg text-xs font-semibold"
            title="New Repository Wiki"
          >
            <Plus className="size-4 shrink-0 text-primary" />
            <span>New Repository Wiki</span>
          </Button>
        </Link>
      </div>

      {/* History Threads List Header & Local Filter */}
      <div className="flex flex-col gap-2 border-b border-border/70 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Question History
          </span>
          <span className="text-[10px] text-muted-foreground">
            {questions.length} {questions.length === 1 ? 'thread' : 'threads'}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter questions..."
            className="h-8 w-full rounded-md border border-border/60 bg-muted/30 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Threads Scroll List */}
      <div className="scrollbar-none flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading history...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-muted-foreground">
            {search ? 'No matching questions found.' : 'No questions recorded yet.'}
          </div>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = activeQuestionId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectQuestion(item.id);
                  onClose();
                }}
                className={cn(
                  'w-full text-left rounded-lg p-2.5 transition-colors cursor-pointer group flex flex-col gap-1',
                  isSelected
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-muted/50 text-foreground/80 hover:text-foreground'
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={cn('size-3.5 mt-0.5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-xs font-medium line-clamp-2 leading-snug">
                    {item.question}
                  </span>
                </div>
                {item.createdAt ? (
                  <div className="flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
                    <Calendar className="size-2.5" />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
