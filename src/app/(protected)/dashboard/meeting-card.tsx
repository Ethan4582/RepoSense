'use client'

import React from 'react'
import { Card } from '~/components/ui/card';
import {CircularProgressbar , buildStyles} from 'react-circular-progressbar'  
import {useDropzone} from 'react-dropzone'
import { uploadFile } from '~/lib/cloudinary';
import { Presentation, Upload } from 'lucide-react';
import { Button } from '~/components/ui/button';

const MeetCard = () => {
 const [isUploading, setIsUploading] = React.useState(false);
   const [progress, setProgress] = React.useState(0);
    const {getRootProps, getInputProps} = useDropzone({
      accept:{
        'audio/*':['.mp3', '.wav' , '.m4a']
      },
      multiple :false,
      maxSize:50_000_000,
      onDrop: async (acceptedFiles)=>{
         setIsUploading(true);
       console.log(acceptedFiles);
       const file = acceptedFiles[0];
       const downloadUrl = await  uploadFile(file as File,  setProgress);
       window.alert(downloadUrl)
       setIsUploading(false);
      }
    });

  return (
    <Card
      className="col-span-4 flex flex-col justify-center items-center py-8 min-h-[270px] max-h-[270px]"
      {...getRootProps()}
    >
      {isUploading ? (
        <>
          <Presentation className='w-10 h-10 -mb-6 text-blue-500' />
          <h3 className='mt-2 text-lg font-semibold text-gray-900'>Uploading Meeting...</h3>
          <p className='-mt-3 text-center text-sm text-gray-500'>
            Please wait while your meeting is being uploaded.<br />
            <span>Powered by AI</span>
          </p>
          <div className="mt-4">
            <Button disabled>
              <Upload className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden="true" /> Uploading Meeting
              <input className='hidden' {...getInputProps()} />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Presentation className='w-10 h-10 -mb-6 text-blue-500' />
          <h3 className='mt-2 text-lg font-semibold text-gray-900'>Create a New Meeting</h3>
          <p className='-mt-3 text-center text-sm text-gray-500'>
            Analyse your meeting with Reposense.<br />
            <span>Powered by AI</span>
          </p>
          <div className="mt-4">
            <Button>
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

