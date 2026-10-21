'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '~/components/ui/card';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '~/lib/cloudinary';
import { Presentation, Upload, FolderGit2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import useProject from '~/hooks/use-project';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

type MeetCardProps = {
  overrideProjectId?: string;
};

const MeetCard = ({ overrideProjectId }: MeetCardProps = {}) => {
  const { projectId: hookProjectId, projects } = useProject();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    overrideProjectId ?? hookProjectId ?? (projects?.[0]?.id ?? null)
  );

  React.useEffect(() => {
    if (overrideProjectId) {
      setSelectedProjectId(overrideProjectId);
    } else if (!selectedProjectId && (hookProjectId || projects?.[0]?.id)) {
      setSelectedProjectId(hookProjectId || projects?.[0]?.id || null);
    }
  }, [overrideProjectId, hookProjectId, projects, selectedProjectId]);

  const activeProjectId = selectedProjectId || hookProjectId || projects?.[0]?.id || null;

  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const router = useRouter();
  const uploadMeeting = api.project.uploadMeeting.useMutation();

  const processMeeting = useMutation({
    mutationFn: async (data: {
      meetingUrl: string;
      meetingId: string;
      projectId: string;
    }) => {
      const { meetingUrl, meetingId, projectId } = data;
      const response = await axios.post('/api/process-meeting', {
        meetingUrl,
        meetingId,
        projectId,
      });
      return response.data;
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a'],
    },
    multiple: false,
    maxSize: 50_000_000,
    onDrop: async (acceptedFiles) => {
      if (!activeProjectId) {
        toast.error("Please link a repository before uploading audio recordings.");
        return;
      }
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const downloadUrl = await uploadFile(file, setProgress);
        uploadMeeting.mutate(
          {
            projectId: activeProjectId,
            meetingUrl: downloadUrl,
            name: file.name,
          },
          {
            onSuccess: (meeting) => {
              toast.success("Meeting uploaded successfully");
              router.push('/meetings');
              processMeeting.mutateAsync({
                meetingUrl: downloadUrl,
                meetingId: meeting.id,
                projectId: activeProjectId,
              });
            },
            onError: () => {
              toast.error("Failed to upload meeting");
            },
          }
        );
      } catch (err) {
        toast.error("Failed to upload audio file");
      } finally {
        setIsUploading(false);
      }
    },
  });

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 rounded-xl border border-dashed bg-card">
        <FolderGit2 className="size-8 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No Repository Linked</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Link a repository first to associate meeting transcripts and issue extraction with your project.
          </p>
        </div>
        <Link href="/create">
          <Button size="sm" className="text-xs gap-1.5 shadow-xs">
            <FolderGit2 className="size-3.5" />
            <span>Link Repository</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.length > 1 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-muted-foreground font-medium">Attach to repository:</span>
          <Select
            value={activeProjectId ?? ''}
            onValueChange={(val) => setSelectedProjectId(val)}
          >
            <SelectTrigger className="h-7 text-xs w-48 bg-background">
              <SelectValue placeholder="Select repository" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card
        className={`flex flex-col justify-center items-center py-8 px-4 border border-dashed rounded-xl transition-all cursor-pointer ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border/80 hover:border-primary/50 bg-card'
        }`}
        {...getRootProps()}
      >
        {isUploading ? (
          <div className="w-full h-full py-4 flex flex-col justify-center items-center">
            <CircularProgressbar
              value={progress}
              text={`${progress}%`}
              className="size-20"
              styles={buildStyles({
                pathColor: 'hsl(var(--primary))',
                textColor: 'hsl(var(--foreground))',
                trailColor: 'hsl(var(--muted))',
              })}
            />
            <p className="mt-3 text-xs text-muted-foreground animate-pulse font-medium">
              Uploading & processing recording...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Presentation className="size-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Upload Audio Recording</h3>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Drag and drop an MP3, WAV, or M4A file here, or click to browse.
              <br />
              <span className="text-[11px] opacity-75">Transcribed & summarized with AssemblyAI</span>
            </p>
            <div className="pt-2">
              <Button size="sm" type="button" className="text-xs gap-1.5 shadow-xs">
                <Upload className="size-3.5" />
                <span>Choose Audio File</span>
                <input className="hidden" {...getInputProps()} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MeetCard;
