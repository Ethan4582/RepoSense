'use client'  


import { DialogTitle } from '@radix-ui/react-dialog'
import Image from 'next/image'
import React from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { Dialog, DialogContent, DialogHeader } from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import useProject from '~/hooks/use-project'

const AskQuestionCard = () => {
   const {project} =useProject()

   const [open, setOpen] = React.useState(false);

   const [question, setQuestion] = React.useState("");

   const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     setOpen(true);
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
          <Button type="submit" className="mt-2">
            Ask Reposense 
          </Button>

        </form>
      </CardContent>
    </Card>
    </>
  )
}

export default AskQuestionCard