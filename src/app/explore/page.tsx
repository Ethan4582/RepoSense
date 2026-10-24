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
      <header className="sticky top-0 z-20 border-b border-[#ececec] bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="RepoSense" className="size-7 rounded-md" />
            <span className="text-sm font-semibold tracking-tight">RepoSense</span>
          </Link>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  Dashboard <ArrowRight className="size-3" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">Sign in</Button>
                </Link>
                <Link href="/sign-up">
                  <Button size="sm" className="h-8 text-xs">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12">
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 gap-1.5 border border-[#ececec] bg-primary/5 text-[11px] text-primary">
            <Globe2 className="size-3" /> Community wikis
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Explore living code wikis
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Browse public repositories documented by RepoSense. Every page is generated from the
            source and links to exact file lines.
          </p>

          <div className="mx-auto mt-7 flex max-w-xl items-center gap-2 rounded-[12px] border border-[#ececec] bg-card px-3 py-2.5 focus-within:border-primary/40">
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
                  className="group flex flex-col rounded-[12px] border border-[#ececec] bg-card p-4 transition-colors duration-200 ease-out hover:border-[#d4d4d4]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[#ececec] bg-muted/50">
                      <GitBranch className="size-4 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[10px] rounded-[999px] border border-[#ececec]">
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
                  <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f0] pt-3 text-[10px] text-muted-foreground">
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
  );
}
