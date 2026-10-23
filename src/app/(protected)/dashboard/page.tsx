'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  BookOpen,
  Compass,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Globe2,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import useProject from '~/hooks/use-project';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';

interface EnrichedProject {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  isPrivateRepo: boolean;
  isPublicWiki: boolean;
  defaultBranch?: string | null;
  lastIndexedBranch?: string | null;
  lastIndexedAt?: string | Date | null;
  description?: string | null;
  stars?: number;
  language?: string | null;
  _count?: { wikiPages: number };
}

function formatStars(count?: number | null): string {
  if (!count) return '0';
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'm';
  if (count >= 1_000) return (count / 1_000).toFixed(1) + 'k';
  return String(count);
}

function getLanguageColor(language?: string | null): string {
  if (!language) return '#8b949e';
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Rust: '#dea584',
    Go: '#00ADD8',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Vue: '#41b883',
    Svelte: '#ff3e00',
    Dart: '#00b4ab',
  };
  return colors[language] ?? '#6366f1';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { projects: rawProjects, isLoading, refetchProjects } = useProject();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [localVisibility, setLocalVisibility] = React.useState<Record<string, boolean>>({});

  const projects = (rawProjects as unknown as EnrichedProject[] | undefined) ?? [];

  // Routing & Onboarding Flow:
  // When an authenticated user has zero repositories, automatically redirect them to /create
  React.useEffect(() => {
    if (!isLoading && (!rawProjects || rawProjects.length === 0)) {
      router.replace('/create');
    }
  }, [isLoading, rawProjects, router]);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  };

  const copyShareLink = async (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const url = `${window.location.origin}/wiki/${projectId}`;
      await navigator.clipboard.writeText(url);
      toast.success('Wiki link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const copyDashboardShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Dashboard link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleToggleVisibility = async (project: EnrichedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.isPrivateRepo) {
      toast.error('Private repositories cannot have public wikis');
      return;
    }

    const currentPublic = localVisibility[project.id] ?? project.isPublicWiki;
    const nextPublic = !currentPublic;

    setLocalVisibility((prev) => ({ ...prev, [project.id]: nextPublic }));
    setTogglingId(project.id);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublicWiki: nextPublic }),
      });
      if (!res.ok) {
        throw new Error('Failed to update visibility');
      }
      toast.success(nextPublic ? 'Wiki is now Public' : 'Wiki is now Private');
      await refetchProjects();
    } catch (err) {
      setLocalVisibility((prev) => ({ ...prev, [project.id]: currentPublic }));
      toast.error(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (trimmed.includes('github.com/') || trimmed.startsWith('http')) {
      router.push(`/create?repo=${encodeURIComponent(trimmed)}`);
    }
  };

  const isLink = searchQuery.trim().includes('github.com/') || searchQuery.trim().startsWith('http');

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || isLink) return projects;
    return projects.filter((p) => {
      const fullName = `${p.repoOwner}/${p.repoName}`.toLowerCase();
      const name = (p.name ?? '').toLowerCase();
      const desc = (p.description ?? '').toLowerCase();
      const lang = (p.language ?? '').toLowerCase();
      return (
        fullName.includes(q) ||
        name.includes(q) ||
        desc.includes(q) ||
        lang.includes(q)
      );
    });
  }, [projects, searchQuery, isLink]);

  if (isLoading || (!rawProjects || rawProjects.length === 0)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-xs text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span>Loading repositories...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Controls */}
      <div className="flex h-14 items-center justify-end px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            title="Toggle theme"
            onClick={toggleTheme}
          >
            <Moon className="size-4 hidden dark:block" />
            <Sun className="size-4 block dark:hidden" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full ring-2 ring-border/50 transition-all hover:ring-primary/60 outline-none"
              >
                <Avatar className="size-7">
                  <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user?.firstName?.[0] ?? 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <div className="px-2 py-1.5 border-b border-border/50">
                <p className="font-semibold text-foreground truncate">{user?.fullName ?? 'Developer'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <DropdownMenuItem onClick={() => openUserProfile()} className="gap-2 cursor-pointer">
                <UserIcon className="size-3.5" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { await signOut(); window.location.href = '/sign-in'; }}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 py-12 md:py-16 max-w-6xl w-full mx-auto">
        {/* Header & Quick Search Matching Reference Screen */}
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
            Which repo would you like to understand?
          </h1>

          <form onSubmit={handleSearchSubmit} className="mt-8 relative">
            <div className="relative flex items-center rounded-xl border border-border/80 bg-card/60 shadow-xs focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <Search className="size-4 shrink-0 text-muted-foreground ml-3.5" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for repositories (or paste a link)"
                className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {isLink && (
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 text-xs mr-2 gap-1 bg-primary text-primary-foreground"
                >
                  <Sparkles className="size-3" />
                  Index
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* Repository Grid */}
        <section className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Dedicated "+ Add repo" card */}
            <Link
              href="/create"
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-300/40 bg-gradient-to-br from-slate-200/50 via-slate-100/40 to-slate-200/30 p-5 shadow-xs transition-all hover:border-slate-400/50 hover:shadow-md dark:border-slate-800 dark:from-slate-900/80 dark:via-slate-900/40 dark:to-slate-950/60 min-h-[170px]"
            >
              <div className="flex items-center gap-2 text-foreground">
                <Plus className="size-5" />
                <span className="font-medium text-base">Add repo</span>
              </div>
              <div className="flex items-center justify-end mt-8">
                <div className="flex size-9 items-center justify-center rounded-full bg-slate-300/40 dark:bg-slate-800/80 text-foreground transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>

            {/* Repository Cards */}
            {filteredProjects.map((project) => {
              const isPublic = localVisibility[project.id] ?? project.isPublicWiki;
              const isBusy = togglingId === project.id;
              const primaryLang = project.language || 'Documentation';
              const langColor = getLanguageColor(project.language);

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/wiki/${project.id}`)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm cursor-pointer min-h-[170px]"
                >
                  {/* Top: Repo name & Visibility / Share controls */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium text-[15px] text-foreground tracking-tight truncate flex-1" title={`${project.repoOwner}/${project.repoName}`}>
                        {project.repoOwner} / {project.repoName}
                      </h2>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Visibility Tag & Quick Toggle */}
                        <div
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors"
                          title={project.isPrivateRepo ? 'Private repository' : `Toggle visibility (currently ${isPublic ? 'Public' : 'Private'})`}
                        >
                          {isPublic ? (
                            <Globe2 className="size-2.5 text-emerald-500" />
                          ) : (
                            <Lock className="size-2.5 text-muted-foreground" />
                          )}
                          <span className="font-normal">{isPublic ? 'Public' : 'Private'}</span>
                          {!project.isPrivateRepo && (
                            <Switch
                              checked={isPublic}
                              disabled={isBusy}
                              onClick={(e) => handleToggleVisibility(project, e)}
                              className="scale-75 origin-center data-[state=checked]:bg-emerald-500"
                            />
                          )}
                        </div>

                        {/* Edit wiki button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/wiki/${project.id}?mode=edit`);
                          }}
                          title="Edit wiki"
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>

                        {/* Share link button */}
                        <button
                          type="button"
                          onClick={(e) => copyShareLink(project.id, e)}
                          title="Share wiki link"
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <LinkIcon className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Description */}
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2 min-h-[34px]">
                      {project.description || `${project.name} living architecture and code wiki.`}
                    </p>
                  </div>

                  {/* Bottom: Stars, Language, and Open arrow */}
                  <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3">
                    <div className="flex items-center gap-3">
                      {/* Star count */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{formatStars(project.stars)}</span>
                      </div>

                      {/* Primary language badge */}
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: langColor }}
                        />
                        <span>{primaryLang}</span>
                      </div>
                    </div>

                    {/* Open arrow */}
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:translate-x-0.5">
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProjects.length === 0 && (
            <div className="mt-12 text-center py-12 rounded-2xl border border-dashed border-border/60">
              <BookOpen className="size-8 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-medium text-foreground">No repositories match your search</h3>
              <p className="text-xs text-muted-foreground mt-1">Try another keyword or paste a GitHub link.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
