'use client'  

import MDeditor from '@uiw/react-md-editor'
import { DialogTitle } from '@radix-ui/react-dialog'
import Image from 'next/image'
import React from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { Dialog, DialogContent, DialogHeader } from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import useProject from '~/hooks/use-project'
import { askReposense } from './action'
import { readStreamableValue } from 'ai/rsc'


const AskQuestionCard = () => {
   const {project} =useProject()

   const [loading , setLoading ]= React.useState(false)

   const [open, setOpen] = React.useState(false);

   const [question, setQuestion] = React.useState("");

   const [answer , setAnswer] =React.useState("")

   const [fileReferences, setFileReferences] = React.useState<{ fileName: string; sourceCode: string; summary: string }[]>([]);

   const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      setAnswer("")
      setFileReferences([])
      e.preventDefault();
      if(!project?.id) return 
     setLoading(true)
   

     const {output, fileReferences} = await askReposense(question, project.id);
     setFileReferences(fileReferences)

     /// after i get some output i will set the answer
       setOpen(true);


     for  await (const delta of readStreamableValue(output)){
      if(delta){
         setAnswer(ans=>ans+delta)
      }
     }

     setLoading(false)
   }
   
  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
          <DialogHeader>
         <DialogTitle className="text-lg font-semibold">
          <Image src='/logo.png' alt="Reposense" width={24} height={24} />
         </DialogTitle>
      </DialogHeader>

     <MDeditor.Markdown
        className='max-w-[70vw] !h-full max-h-[40vh] overflow-scroll'
        source={answer}
      />

      <Button type='button' onClick={() =>{setOpen(false)} }>Close</Button>

      {/* <h1>File References</h1>
     { fileReferences.map(file=>{
      return <span key={file.fileName}>{file.fileName}</span>
     })} */}
      </DialogContent>
    </Dialog>



    <Card className='relative col-span-1 sm:col-span-2 lg:col-span-3'>
      <CardTitle className="px-3 text-lg font-semibold">
        Ask a Question
      </CardTitle>
      <CardContent className="text-sm text-muted-foreground">
        <form onSubmit={onSubmit} className="flex flex-col gap-2"> 
         <Textarea
            placeholder="Which file should I edit to change the home page?"
            className="w-full h-24 p-2 border rounded-md"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" disabled={loading} className="mt-2">
            Ask Reposense
          </Button>

        </form>
      </CardContent>
    </Card>
    </>
  )
}

export default AskQuestionCard