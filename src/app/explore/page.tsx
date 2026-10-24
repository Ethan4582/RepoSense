'use client';

import * as React from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  Globe2,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

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
  if (!value) return 'recently';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function cleanSummary(summary: string | null) {
  if (!summary) return 'No summary available yet.';
  return summary
    .replace(/[#*_`>[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 190);
}

export default function ExplorePage() {
  const { isSignedIn } = useUser();
  const [query, setQuery] = React.useState('');
  const [projects, setProjects] = React.useState<ExploreProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());

      fetch(`/api/public/explore?${params.toString()}`, { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Unable to load public wikis.');
          return (await res.json()) as { projects: ExploreProject[] };
        })
        .then((data) => {
          if (!cancelled) {
            setProjects(data.projects);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load public wikis.');
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-[#ececec] bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between px-6 sm:px-[64px]">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="RepoSense" className="size-6 rounded-md object-contain" />
            <span className="font-serif text-[22px] font-medium tracking-tight text-[#0b0b0d]">RepoSense</span>
          </Link>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] mr-2"
              >
                <span className="relative z-10 flex h-[38px] px-4 items-center justify-center gap-1.5 bg-[#0b0b0d] border border-[#0b0b0d] text-[14px] font-medium text-white rounded-none">
                  <span>Dashboard</span>
                  <span aria-hidden="true">&#x2197;</span>
                </span>
                <span
                  className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                  style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                />
                <span
                  className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                  style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                />
              </Link>
            ) : (
              <>
                <a
                  href="https://github.com/Ethan4582/RepoSense"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#47474e] hover:text-[#0b0b0d] transition-colors p-1"
                  title="GitHub Repository"
                >
                  <svg
                    className="size-5 fill-current"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </a>
                {/* 3D Extruded Button matching hero section */}
                <Link
                  href="/sign-up"
                  className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] mr-2"
                >
                  <span className="relative z-10 flex h-[38px] px-4 items-center justify-center gap-1.5 bg-[#0b0b0d] border border-[#0b0b0d] text-[14px] font-medium text-white rounded-none">
                    <span>Get started</span>
                    <span aria-hidden="true">&#x2197;</span>
                  </span>
                  <span
                    className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                  />
                  <span
                    className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                  />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container framed by the same max-w-[1440px] and side lines */}
      <div className="relative w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col min-h-[calc(100vh-64px)]">
        <main className="relative border-x border-[#d4d4d4] px-6 sm:px-[64px] pb-20 pt-12 flex-1">
          <section className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4 gap-1.5 border border-[#d4d4d8] bg-primary/5 text-[11px] text-primary">
              <Globe2 className="size-3" /> Community wikis
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-[#0b0b0d]">
              Explore living code wikis
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Browse public repositories documented by RepoSense. Every page is generated from the
              source and links to exact file lines.
            </p>

            <div className="mx-auto mt-7 flex max-w-xl items-center gap-2 rounded-[12px] border border-[#d4d4d8] bg-card px-3.5 py-2.5 transition-colors focus-within:border-black/50">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by repository, owner, or name..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> : null}
            </div>
          </section>

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4 text-primary" />
              {query.trim() ? 'Search results' : 'Recently indexed'}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {projects.length} {projects.length === 1 ? 'wiki' : 'wikis'}
            </span>
          </div>

          {error ? (
            <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : loading && projects.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-[12px] border border-[#ececec] bg-muted/30" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[#ececec] px-6 py-16 text-center">
              <Globe2 className="mx-auto mb-3 size-9 text-muted-foreground/40" />
              <h3 className="text-sm font-semibold">
                {query.trim() ? 'No public wikis match your search' : 'No public wikis yet'}
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                {query.trim()
                  ? 'Try a different repository name or owner.'
                  : 'Index a repository and make its wiki public to share it here.'}
              </p>
              {isSignedIn ? (
                <Link href="/create">
                  <Button size="sm" className="mt-5 gap-1.5">
                    <Sparkles className="size-3.5" /> Create a wiki
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up">
                  <Button size="sm" className="mt-5">Create a wiki</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-70')}>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/wiki/${project.id}`}
                  className="group flex flex-col rounded-[12px] border border-[#d4d4d8] bg-card p-4 transition-colors duration-200 ease-out hover:border-black/50"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[#d4d4d8] bg-muted/40">
                      <GitBranch className="size-4 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[10px] rounded-[999px] border border-[#d4d4d8]">
                      {project.pageCount} pages
                    </Badge>
                  </div>
                  <div className="mt-1 min-w-0">
                    <h3 className="truncate text-sm font-semibold tracking-tight">{project.name}</h3>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {project.repoOwner}/{project.repoName}
                    </p>
                  </div>
                  <p className="mt-2.5 line-clamp-3 flex-1 text-xs leading-5 text-muted-foreground">
                    {cleanSummary(project.summary)}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-[#ececec] pt-3 text-[10px] text-muted-foreground">
                    <span>Updated {timeAgo(project.lastIndexedAt)}</span>
                    <span className="flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Open wiki <ArrowRight className="size-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        </main>
      </div>
    </div>
  );
}
