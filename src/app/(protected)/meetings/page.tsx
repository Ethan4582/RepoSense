'use client';

import * as React from 'react';
import Link from 'next/link';
import { Video, Calendar, Clock, AlertCircle, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import useProject from '~/hooks/use-project';
import { api } from '~/trpc/react';
import MeetCard from '../dashboard/meeting-card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import useRefetch from '~/hooks/use-refetch';

const MeetingsPage = () => {
  const { projectId, project } = useProject();

  const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
    { projectId: projectId ?? '' },
    { refetchInterval: 5000, enabled: !!projectId }
  );
  const deleteMeeting = api.project.deleteMeeting.useMutation();
  const refetch = useRefetch();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Video className="size-6 text-primary" />
          Meetings & Issue Extraction
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload audio or video recordings from team meetings to automatically transcribe and extract actionable issues for{' '}
          <strong className="text-foreground">{project?.name ?? 'your project'}</strong>.
        </p>
      </div>

      {/* Upload Meeting Card */}
      <MeetCard />

      {/* Meetings List */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="border-b bg-muted/20 px-6 py-4">
          <CardTitle className="text-base font-semibold">
            Processed Meetings ({meetings?.length ?? 0})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading meetings...
            </div>
          ) : !meetings || meetings.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No meetings found. Upload an audio recording above to extract issues.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {meetings.map((meeting: any) => (
                <li
                  key={meeting.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-muted/40 transition-colors gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {meeting.name}
                      </Link>
                      {meeting.status === 'PROCESSING' ? (
                        <Badge variant="outline" className="text-[10px] border-amber-500/20 bg-amber-500/10 text-amber-600 animate-pulse">
                          Processing Audio...
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                          Ready
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground gap-3">
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
                        {meeting.issues?.length ?? 0} issues identified
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/meetings/${meeting.id}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        View Issues
                      </Button>
                    </Link>
                    <Button
                      disabled={deleteMeeting.isPending}
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        deleteMeeting.mutate(
                          { meetingId: meeting.id },
                          {
                            onSuccess: () => {
                              toast.success('Meeting deleted successfully');
                              refetch();
                            },
                          }
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MeetingsPage;
