'use client';

import React from 'react';
import { Card } from '~/components/ui/card';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '~/lib/cloudinary';
import { Presentation, Upload } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import useProject from '~/hooks/use-project';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const MeetCard = () => {
  const { projectId } = useProject();
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const router = useRouter();
  const uploadMeeeting = api.project.uploadMeeting.useMutation();

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
      if (!projectId) {
        toast.error("Please select a project first");
        return;
      }
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;

      const downloadUrl = (await uploadFile(file, setProgress));
      uploadMeeeting.mutate(
        {
          projectId,
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
              projectId,
            });
          },
          onError: () => {
            toast.error("Failed to upload meeting");
          },
        }
      );
      setIsUploading(false);
    },
  });

  return (
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
  );
};

export default MeetCard;
