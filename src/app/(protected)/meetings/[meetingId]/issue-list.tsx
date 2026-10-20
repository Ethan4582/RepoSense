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
  const githubRepoBase = project?.repoUrl?.replace(/\.git$/, '') ?? '';

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
                {meeting.issues.length} {meeting.issues.length === 1 ? 'Actionable Issue' : 'Actionable Issues'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notion Callout: Executive Summary */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
          <Lightbulb className="size-4" />
          <span>Executive Summary</span>
        </div>
        <p className="text-foreground leading-relaxed">
          {meeting.issues.length > 0
            ? `Discussion focused on ${meeting.issues.map((i) => i.gist).slice(0, 3).join(', ')}. Action items and architectural tasks were identified and isolated below with direct GitHub issue export.`
            : 'Audio processing completed. No critical blockers were identified during transcription.'}
        </p>
      </div>

      {/* Embedded Audio Playback Strip */}
      {meeting.meetingUrl && (
        <div className="rounded-xl border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="secondary"
              onClick={toggleAudio}
              className="size-8 rounded-full shrink-0 shadow-xs"
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
            </Button>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Volume2 className="size-3 text-primary" />
                Audio Recording Playback
              </span>
              <p className="text-[11px] text-muted-foreground font-mono">
                Speed: {playbackRate}x
              </p>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={meeting.meetingUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center gap-1 self-end sm:self-center">
            {[1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  playbackRate === speed
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Issues (Notion Inline Toggles ▸ / ▾ — No Modal Popups!) */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span>Actionable Issues ({meeting.issues.length})</span>
        </h2>

        {meeting.issues.length === 0 ? (
          <div className="rounded-xl border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
            No issues extracted from this meeting.
          </div>
        ) : (
          <div className="space-y-2">
            {meeting.issues.map((issue, index) => {
              const isExpanded = !!expandedIssueIds[issue.id];
              return (
                <div
                  key={issue.id}
                  className="rounded-xl border bg-card overflow-hidden shadow-xs transition-all"
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleExpand(issue.id)}
                  >
                    {/* Toggle Header: ▸ / ▾ Issue #X: Gist [start - end] [Create GitHub Issue ↗] */}
                    <div className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors gap-3">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-foreground" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </span>
                          <span className="font-semibold text-xs text-foreground truncate">
                            Issue #{index + 1}: {issue.gist}
                          </span>
                          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground shrink-0">
                            {issue.start} – {issue.end}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2 shrink-0">
                        {githubRepoBase && (
                          <Link
                            href={getGithubIssueUrl(issue)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 gap-1.5 font-medium"
                            >
                              <span>Create GitHub Issue</span>
                              <ExternalLink className="size-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Inline Expanded Content (Notion Document Body) */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t bg-muted/10 text-xs">
                        {/* Headline */}
                        <div className="pt-2">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            Topic Headline
                          </span>
                          <p className="font-medium text-foreground">
                            {issue.headline}
                          </p>
                        </div>

                        {/* Summary Callout */}
                        <div className="rounded-lg border bg-background p-3 space-y-1">
                          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                            Summary & Technical Context
                          </span>
                          <p className="text-foreground leading-relaxed">
                            {issue.summary}
                          </p>
                        </div>

                        {/* Transcript Chunk Block */}
                        <div className="rounded-lg border-l-2 border-primary bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
                          <span className="text-[10px] font-bold text-foreground block mb-1">
                            Transcript Chunk ({issue.start} – {issue.end})
                          </span>
                          &ldquo;{issue.summary}&rdquo;
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
