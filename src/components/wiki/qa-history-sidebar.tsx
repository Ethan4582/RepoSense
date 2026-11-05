"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { getApiBaseUrl } from "~/lib/api-client";

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
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!open || !projectId) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let res = await fetch(
          `${getApiBaseUrl()}/api/projects/${projectId}/questions`,
          {
            credentials: "include",
          },
        );
        if (!res.ok) {
          res = await fetch(
            `${getApiBaseUrl()}/api/public/projects/${projectId}/questions`,
          );
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
    q.question.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="animate-in slide-in-from-left border-border/50 bg-background fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r shadow-xl duration-200">
      {/* Top Header matching AppSideBar */}
      <div className="border-border/50 flex flex-col gap-3 border-b p-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative size-7 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="RepoSense"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="text-foreground text-base font-bold tracking-tight">
              Repo<span className="text-primary">Sense</span>
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground size-7"
            aria-label="Close history sidebar"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        {/* Global Command palette search trigger */}
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("open-command-palette"))
          }
          className="bg-background text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-full items-center justify-between rounded-lg border px-3 text-xs transition-colors"
          title="Search anything (Ctrl+K)"
        >
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <span>Search...</span>
          </div>
          <kbd className="border-border/80 bg-muted/60 text-muted-foreground pointer-events-none rounded border px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>

        {/* New Repository Button */}
        <Link href="/create" className="block">
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2 rounded-lg text-xs font-semibold"
            title="New Wiki"
          >
            <Plus className="text-primary size-4 shrink-0" />
            <span>New Wiki</span>
          </Button>
        </Link>
      </div>

      {/* History Threads List Header & Local Filter */}
      <div className="border-border/50 flex flex-col gap-2 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Question History
          </span>
          <span className="text-muted-foreground text-[10px]">
            {questions.length} {questions.length === 1 ? "thread" : "threads"}
          </span>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter questions..."
            className="border-border/60 bg-muted/30 text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-8 w-full rounded-md border pr-2.5 pl-8 text-xs outline-none"
          />
        </div>
      </div>

      {/* Threads Scroll List */}
      <div className="flex flex-1 scrollbar-none flex-col gap-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-xs">
            <Loader2 className="text-primary size-4 animate-spin" />
            <span>Loading history...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground px-4 py-12 text-center text-xs">
            {search
              ? "No matching questions found."
              : "No questions recorded yet."}
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
                  "group flex w-full cursor-pointer flex-col gap-1 rounded-lg p-2.5 text-left transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary border-primary/20 border"
                    : "hover:bg-muted/50 text-foreground/80 hover:text-foreground",
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      isSelected ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="line-clamp-2 text-xs leading-snug font-medium">
                    {item.question}
                  </span>
                </div>
                {item.createdAt ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 pl-5 text-[10px]">
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
