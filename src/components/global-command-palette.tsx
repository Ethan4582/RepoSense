'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Globe2,
  Bookmark,
  History,
  GitPullRequest,
  Video,
  KeyRound,
  FolderGit2,
  ArrowRight,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import useProject from '~/hooks/use-project';

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { projects, setProjectId } = useProject();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleOpen = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener('open-command-palette', handleOpen);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('open-command-palette', handleOpen);
    };
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const visibleProjects = (projects ?? []).filter((p) => !p.deletedAt);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search repositories, wiki, QA, or pages (Ctrl+K)..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {visibleProjects.length > 0 && (
          <CommandGroup heading="Repositories">
            {visibleProjects.map((project) => (
              <CommandItem
                key={project.id}
                value={`${project.name} ${project.repoOwner ?? ''} ${project.repoName ?? ''}`}
                onSelect={() =>
                  handleSelect(() => {
                    setProjectId(project.id);
                    router.push(`/wiki/${project.id}`);
                  })
                }
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderGit2 className="size-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{project.name}</span>
                  {project.repoOwner && project.repoName && (
                    <span className="text-xs text-muted-foreground">
                      ({project.repoOwner}/{project.repoName})
                    </span>
                  )}
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground opacity-60" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Workspace Navigation">
          <CommandItem
            value="Dashboard"
            onSelect={() => handleSelect(() => router.push('/dashboard'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Compass className="size-4 text-muted-foreground" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            value="Public Wikis Explore"
            onSelect={() => handleSelect(() => router.push('/explore'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Globe2 className="size-4 text-muted-foreground" />
            <span>Public Wikis</span>
          </CommandItem>
          <CommandItem
            value="QA Questions Saved Bookmarks"
            onSelect={() => handleSelect(() => router.push('/qa'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Bookmark className="size-4 text-muted-foreground" />
            <span>QA (Questions & Answers)</span>
          </CommandItem>
          <CommandItem
            value="History Question History Search"
            onSelect={() => handleSelect(() => router.push('/history'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <History className="size-4 text-muted-foreground" />
            <span>History (All Asked Questions)</span>
          </CommandItem>
          <CommandItem
            value="Pull Requests Code Review"
            onSelect={() => handleSelect(() => router.push('/pulls'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <GitPullRequest className="size-4 text-muted-foreground" />
            <span>Pull Requests</span>
          </CommandItem>
          <CommandItem
            value="Meetings Transcripts"
            onSelect={() => handleSelect(() => router.push('/meetings'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Video className="size-4 text-muted-foreground" />
            <span>Meetings</span>
          </CommandItem>
          <CommandItem
            value="API Keys Settings Credentials"
            onSelect={() => handleSelect(() => router.push('/settings'))}
            className="flex items-center gap-2 cursor-pointer"
          >
            <KeyRound className="size-4 text-muted-foreground" />
            <span>API Keys & Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
