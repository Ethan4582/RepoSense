'use client'

import React from 'react'
import { Card } from '~/components/ui/card';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import { useDropzone } from 'react-dropzone'
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
  const project = useProject()
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const router = useRouter();
  const uploadMeeeting = api.project.uploadMeeting.useMutation();

  const processMeeting = useMutation({
    mutationFn: async (data: {
      meetingUrl: string, meetingId: string, projectId: string
    }) => {
      const { meetingUrl, meetingId, projectId } = data;
      const response = await axios.post('/api/process-meeting', {
        meetingUrl, meetingId, projectId
      });
      return response.data;
    },
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a']
    },
    multiple: false,
    maxSize: 50_000_000,
    onDrop: async acceptedFiles => {
      if (!project.projectId) return;
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;

      const downloadUrl = await uploadFile(file as File, setProgress) as string;
      uploadMeeeting.mutate({
        projectId: project.projectId,
        meetingUrl: downloadUrl,
        name: file.name
      }, {
        onSuccess: (meeting) => {
          toast.success("Meeting uploaded successfully");
          router.push('/meetings');
          processMeeting.mutateAsync({
            meetingUrl: downloadUrl,
            meetingId: meeting.id,
            projectId: project.projectId
          });
        },
        onError: () => {
          toast.error("Failed to upload meeting");
        }
      });
      setIsUploading(false);
    }
  });

  return (
    <Card
      className="col-span-4 flex flex-col justify-center items-center py-8 min-h-[270px] max-h-[270px] overflow-hidden"
      {...getRootProps()}
    >
      {isUploading ? (
        <div className="w-full h-full flex flex-col justify-center items-center">
          <CircularProgressbar
            value={progress}
            text={`${progress}%`}
            className='size-20'
            styles={buildStyles({
              pathColor: '#2563eb',
              textColor: '#2563eb',
            })}
          />
        </div>
      ) : (
        <>
          <Presentation className='w-10 h-10 -mb-6 text-blue-500' />
          <h3 className='mt-2 text-lg font-semibold text-gray-900'>Create a New Meeting</h3>
          <p className='-mt-3 text-center text-sm text-gray-500'>
            Analyse your meeting related to a project with Reposense.<br />
            <span>Powered by AssemblyAI</span>
          </p>
          <div className="mt-4">
            <Button className="px-6 py-3">
              <Upload className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden="true" /> Upload Meeting
              <input className='hidden' {...getInputProps()} />
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

export default MeetCard

