'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  VideoIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Lightbulb,
  Play,
  Pause,
  Volume2,
  Calendar,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { api, type RouterOutputs } from '~/trpc/react';
import useProject from '~/hooks/use-project';

type Props = {
  meetingId: string;
};

type IssueType = NonNullable<RouterOutputs['project']['getMeetingById']>['issues'][number];

export default function IssuesList({ meetingId }: Props) {
  const { project } = useProject();
  const { data: meeting, isLoading } = api.project.getMeetingById.useQuery(
    { meetingId },
    { refetchInterval: 4000 }
  );

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState<number>(1);
  const [expandedIssueIds, setExpandedIssueIds] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIssueIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  if (isLoading || !meeting) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-xs text-muted-foreground gap-2">
        <Sparkles className="size-4 animate-spin text-primary" />
        <span>Loading meeting document...</span>
      </div>
    );
  }

  // Extract owner & repo for GitHub issue creation link
  const githubRepoBase = ((meeting as any)?.project?.repoUrl ?? project?.repoUrl)?.replace(/\.git$/, '') ?? '';

  const getGithubIssueUrl = (issue: IssueType) => {
    if (!githubRepoBase) return '#';
    const title = encodeURIComponent(`[Meeting Task] ${issue.gist}`);
    const body = encodeURIComponent(
      `### Issue Summary\n${issue.summary}\n\n### Context & Timing\n- Headline: ${issue.headline}\n- Timestamp: ${issue.start} - ${issue.end}\n- Extracted from meeting: "${meeting.name}"\n\n*Created via RepoSense Notion Meeting Notes*`
    );
    return `${githubRepoBase}/issues/new?title=${title}&body=${body}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Notion Breadcrumb Header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-4">
        <Link
          href="/meetings"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          <span>Meetings</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground truncate">{meeting.name}</span>
      </div>

      {/* Meeting Title & Meta */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <VideoIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {meeting.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(meeting.createdAt).toLocaleDateString([], {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span>•</span>
              <span className="font-medium text-foreground">
                {meeting.issues?.length ?? 0} actionable items extracted
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Player Card */}
      {meeting.meetingUrl && (
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium flex items-center gap-1.5 text-foreground">
              <Volume2 className="size-4 text-primary" />
              Recording Audio Player
            </span>
            <div className="flex items-center gap-1">
              {[1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                    playbackRate === speed
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={toggleAudio}
              className="size-9 rounded-full shrink-0 shadow-2xs"
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
            </Button>
            <audio
              ref={audioRef}
              src={meeting.meetingUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-8"
              controls
            />
          </div>
        </div>
      )}

      {/* Issues / Notion Document View */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            Extracted Tasks & GitHub Issues ({meeting.issues?.length ?? 0})
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Click an item to expand details & create GitHub issue
          </span>
        </div>

        {meeting.issues?.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl space-y-1">
            <p className="font-medium text-foreground">No issues identified in this recording.</p>
            <p>Our pipeline analyzes audio for decisions, action items, and bug discussions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meeting.issues.map((issue, index) => {
              const isExpanded = !!expandedIssueIds[issue.id];

              return (
                <Collapsible
                  key={issue.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpand(issue.id)}
                  className="border rounded-xl bg-card overflow-hidden transition-all shadow-xs"
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                            {issue.gist}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {issue.headline}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                          {issue.start} - {issue.end}
                        </Badge>
                        <div className="p-1 rounded text-muted-foreground hover:text-foreground">
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-5 pb-5 pt-2 border-t bg-muted/10 space-y-4 text-xs leading-relaxed">
                      <div>
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Full Summary & Action Item
                        </h4>
                        <p className="text-foreground whitespace-pre-wrap rounded-lg bg-background border p-3">
                          {issue.summary}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-[11px] text-muted-foreground">
                          Context window: {issue.start} to {issue.end}
                        </span>

                        {githubRepoBase ? (
                          <Link
                            href={getGithubIssueUrl(issue)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" className="h-7 text-xs gap-1.5 shadow-xs">
                              <span>Create GitHub Issue</span>
                              <ExternalLink className="size-3" />
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            No GitHub repository linked to this meeting
                          </span>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
