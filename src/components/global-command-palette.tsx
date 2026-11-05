"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import useProject from "~/hooks/use-project";

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { projects, setProjectId } = useProject();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleOpen = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener("open-command-palette", handleOpen);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-command-palette", handleOpen);
    };
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const visibleProjects = (projects ?? []).filter((p) => !p.deletedAt);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-xl">
      <CommandInput placeholder="Search repositories, wiki, QA, or pages (Ctrl+K)..." />
      <CommandList className="mt-2 max-h-80 scrollbar-none">
        <CommandEmpty>No results found.</CommandEmpty>

        {visibleProjects.length > 0 && (
          <CommandGroup heading="Repositories">
            {visibleProjects.map((project) => (
              <CommandItem
                key={project.id}
                value={`${project.name} ${project.repoOwner ?? ""} ${project.repoName ?? ""}`}
                onSelect={() =>
                  handleSelect(() => {
                    setProjectId(project.id);
                    router.push(`/wiki/${project.id}`);
                  })
                }
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FolderGit2 className="text-primary size-4 shrink-0" />
                  <span className="text-foreground font-medium">
                    {project.name}
                  </span>
                  {project.repoOwner && project.repoName && (
                    <span className="text-muted-foreground text-xs">
                      ({project.repoOwner}/{project.repoName})
                    </span>
                  )}
                </div>
                <ArrowRight className="text-muted-foreground size-3.5 opacity-60" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Workspace Navigation">
          <CommandItem
            value="Dashboard"
            onSelect={() => handleSelect(() => router.push("/dashboard"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <Compass className="text-muted-foreground size-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            value="Public Wikis Explore"
            onSelect={() => handleSelect(() => router.push("/explore"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <Globe2 className="text-muted-foreground size-4" />
            <span>Public Wikis</span>
          </CommandItem>
          <CommandItem
            value="QA Questions Saved Bookmarks"
            onSelect={() => handleSelect(() => router.push("/qa"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <Bookmark className="text-muted-foreground size-4" />
            <span>QA (Questions & Answers)</span>
          </CommandItem>
          <CommandItem
            value="History Question History Search"
            onSelect={() => handleSelect(() => router.push("/history"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <History className="text-muted-foreground size-4" />
            <span>History (All Asked Questions)</span>
          </CommandItem>
          <CommandItem
            value="Pull Requests Code Review"
            onSelect={() => handleSelect(() => router.push("/pulls"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <GitPullRequest className="text-muted-foreground size-4" />
            <span>Pull Requests</span>
          </CommandItem>
          <CommandItem
            value="Meetings Transcripts"
            onSelect={() => handleSelect(() => router.push("/meetings"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <Video className="text-muted-foreground size-4" />
            <span>Meetings</span>
          </CommandItem>
          <CommandItem
            value="API Keys Settings Credentials"
            onSelect={() => handleSelect(() => router.push("/settings"))}
            className="flex cursor-pointer items-center gap-2"
          >
            <KeyRound className="text-muted-foreground size-4" />
            <span>API Keys & Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
