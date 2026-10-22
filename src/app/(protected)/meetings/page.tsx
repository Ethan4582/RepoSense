'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Video,
  Calendar,
  Trash2,
  Plus,
  FileText,
  Sparkles,
  ChevronRight,
  MoreVertical,
  FolderGit2,
} from 'lucide-react';
import { toast } from 'sonner';
import useProject from '~/hooks/use-project';
import useRefetch from '~/hooks/use-refetch';
import { api } from '~/trpc/react';
import MeetCard from '../dashboard/meeting-card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export default function MeetingsPage() {
  const { projectId, project, projects, setProjectId } = useProject();
  const [selectedProjectFilter, setSelectedProjectFilter] = React.useState<string>(projectId ?? 'all');
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (projectId && selectedProjectFilter === 'all') {
      setSelectedProjectFilter(projectId);
    }
  }, [projectId]);

  const queryProjectId = selectedProjectFilter === 'all' ? undefined : selectedProjectFilter;

  const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
    { projectId: queryProjectId },
    { refetchInterval: 5000 }
  );
  const deleteMeeting = api.project.deleteMeeting.useMutation();
  const refetch = useRefetch();

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Video className="size-6 text-primary" />
            Meetings & Issues
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Audio transcripts and Notion-style issue extraction
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Repository Filter */}
          <div className="flex items-center gap-1.5">
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
              <SelectTrigger className="h-8 min-w-[180px] max-w-[260px] text-xs gap-2 border-border/80 bg-background">
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

          <Button
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>+ Upload Meeting Audio</span>
          </Button>
        </div>
      </div>

      {/* Notion-Style Document List */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        <div className="border-b bg-muted/20 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Processed Recordings ({meetings?.length ?? 0})</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Sparkles className="size-5 text-primary animate-spin" />
            <span>Loading meeting documents...</span>
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-3">
            <FileText className="size-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-foreground">No meetings recorded yet.</p>
            <p className="text-[11px] max-w-sm mx-auto leading-relaxed">
              Upload audio recordings from your design sprints or standups to automatically transcribe and extract actionable GitHub issues.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
                className="h-7 text-xs"
              >
                Upload First Recording
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {meetings.map((meeting) => {
              const isProcessing = meeting.status === 'PROCESSING';
              const issuesCount = meeting.issues?.length ?? 0;

              return (
                <li
                  key={meeting.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/40 transition-colors gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="size-4" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {meeting.name}
                        </Link>

                        {/* Project Badge if viewing All Repositories */}
                        {selectedProjectFilter === 'all' && (meeting as unknown as { project?: { name?: string } }).project?.name && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                            <FolderGit2 className="size-2.5 text-primary" />
                            {(meeting as unknown as { project?: { name?: string } }).project?.name}
                          </Badge>
                        )}

                        {isProcessing ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/20 bg-amber-500/10 text-amber-600 animate-pulse">
                            Processing Audio...
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                            Ready
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center text-xs text-muted-foreground gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(meeting.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-foreground">
                          {issuesCount} {issuesCount === 1 ? 'issue' : 'issues'} identified
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Link href={`/meetings/${meeting.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1">
                        <span>Open Document</span>
                        <ChevronRight className="size-3" />
                      </Button>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={deleteMeeting.isPending}
                          onClick={() =>
                            deleteMeeting.mutate(
                              { meetingId: meeting.id },
                              {
                                onSuccess: () => {
                                  toast.success('Meeting deleted successfully');
                                  void refetch();
                                },
                                onError: () => toast.error('Failed to delete meeting'),
                              }
                            )
                          }
                          className="text-destructive focus:text-destructive cursor-pointer text-xs gap-2"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete Document</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Upload Audio Dialog Modal */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Video className="size-4 text-primary" />
              Upload Meeting Recording
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an audio file (mp3, wav, m4a) to upload. Our AI pipeline will transcribe the audio and extract actionable issues into Notion document format.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <MeetCard overrideProjectId={selectedProjectFilter !== 'all' ? selectedProjectFilter : undefined} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
