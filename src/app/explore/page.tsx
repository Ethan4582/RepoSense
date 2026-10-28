"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  Globe2,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { AccountMenu } from "~/components/account-menu";
import { NotificationCenter } from "~/components/notification-center";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

interface ExploreProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  lastIndexedAt: string | null;
  lastIndexedCommitSha: string | null;
  pageCount: number;
  summary: string | null;
}

function timeAgo(value: string | null) {
  if (!value) return "recently";
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function cleanSummary(summary: string | null) {
  if (!summary) return "No summary available yet.";
  return summary
    .replace(/[#*_`>[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 190);
}

export default function ExplorePage() {
  const { isSignedIn } = useUser();
  const [query, setQuery] = React.useState("");
  const [projects, setProjects] = React.useState<ExploreProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());

      fetch(`/api/public/explore?${params.toString()}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Unable to load public wikis.");
          return (await res.json()) as { projects: ExploreProject[] };
        })
        .then((data) => {
          if (!cancelled) {
            setProjects(data.projects);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled)
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load public wikis.",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border/50 bg-background/90 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="RepoSense"
              className="size-6 rounded-md object-contain"
            />
            <span className="text-foreground text-lg font-semibold tracking-tight">
              RepoSense
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <NotificationCenter />
                <AccountMenu />
              </>
            ) : (
              <>
                <a
                  href="https://github.com/Ethan4582/RepoSense"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-[#47474e] transition-colors hover:text-[#0b0b0d]"
                  title="GitHub Repository"
                >
                  <svg
                    className="size-5 fill-current"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </a>
                {/* 3D Extruded Button matching hero section */}
                <Link
                  href="/sign-up"
                  className="group relative mr-2 inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px]"
                >
                  <span className="relative z-10 flex h-[38px] items-center justify-center rounded-none border border-[#0b0b0d] bg-[#0b0b0d] px-5 text-[14px] font-medium text-white">
                    <span>Get started</span>
                  </span>
                  <span
                    className="absolute top-0 left-full h-full w-[5px] border-t border-r border-b border-[#0b0b0d] bg-[#1423b8] transition-all duration-150 ease-out group-hover:w-[6px]"
                    style={{
                      transform: "skewY(45deg)",
                      transformOrigin: "top left",
                    }}
                  />
                  <span
                    className="absolute top-full left-0 h-[5px] w-full border-r border-b border-l border-[#0b0b0d] bg-[#2337ff] transition-all duration-150 ease-out group-hover:h-[6px]"
                    style={{
                      transform: "skewX(45deg)",
                      transformOrigin: "top left",
                    }}
                  />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container framed by the same max-w-[1440px] and side lines */}
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col px-4 sm:px-6">
        <main className="relative flex-1 pt-10 pb-16">
          <section className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary mb-4 gap-1.5 text-[11px]"
            >
              <Globe2 className="size-3" /> Community wikis
            </Badge>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
              Explore living code wikis
            </h1>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6">
              Browse public repositories documented by RepoSense. Every page is
              generated from the source and links to exact file lines.
            </p>

            <Card className="mx-auto mt-7 max-w-xl gap-0 py-0 shadow-none">
              <CardContent className="flex items-center gap-2 p-1.5">
                <Search className="text-muted-foreground ml-2 size-4 shrink-0" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by repository, owner, or name..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                {loading ? (
                  <Loader2 className="text-primary mr-2 animate-spin" />
                ) : null}
              </CardContent>
            </Card>
          </section>

          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="text-primary size-4" />
                {query.trim() ? "Search results" : "Recently indexed"}
              </h2>
              <span className="text-muted-foreground text-[11px]">
                {projects.length} {projects.length === 1 ? "wiki" : "wikis"}
              </span>
            </div>

            {error ? (
              <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-[12px] border p-6 text-sm">
                {error}
              </div>
            ) : loading && projects.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 h-44 animate-pulse rounded-[12px] border border-[#ececec]"
                  />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#ececec] px-6 py-16 text-center">
                <Globe2 className="text-muted-foreground/40 mx-auto mb-3 size-9" />
                <h3 className="text-sm font-semibold">
                  {query.trim()
                    ? "No public wikis match your search"
                    : "No public wikis yet"}
                </h3>
                <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-xs leading-5">
                  {query.trim()
                    ? "Try a different repository name or owner."
                    : "Index a repository and make its wiki public to share it here."}
                </p>
                {isSignedIn ? (
                  <Link href="/create">
                    <Button size="sm" className="mt-5 gap-1.5">
                      <Sparkles className="size-3.5" /> Create a wiki
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up">
                    <Button size="sm" className="mt-5">
                      Create a wiki
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
                  loading && "opacity-70",
                )}
              >
                {projects.map((project) => (
                  <Card
                    key={project.id}
                    className="group hover:bg-muted/20 gap-0 p-0 transition-colors"
                  >
                    <Link
                      href={`/wiki/${project.id}`}
                      className="flex h-full flex-col p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="border-border/50 bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                          <GitBranch className="text-primary size-4" />
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px]"
                        >
                          {project.pageCount} pages
                        </Badge>
                      </div>
                      <div className="mt-1 min-w-0">
                        <h3 className="truncate text-sm font-semibold tracking-tight">
                          {project.name}
                        </h3>
                        <p className="text-muted-foreground truncate font-mono text-[10px]">
                          {project.repoOwner}/{project.repoName}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-2.5 line-clamp-3 flex-1 text-xs leading-5">
                        {cleanSummary(project.summary)}
                      </p>
                      <div className="border-border/50 text-muted-foreground mt-4 flex items-center justify-between border-t pt-3 text-[10px]">
                        <span>Updated {timeAgo(project.lastIndexedAt)}</span>
                        <span className="text-primary flex items-center gap-1 font-medium opacity-0 transition-opacity group-hover:opacity-100">
                          Open wiki <ArrowRight className="size-3" />
                        </span>
                      </div>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
