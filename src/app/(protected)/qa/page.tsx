
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet"
import useProject from "~/hooks/use-project"
import { api } from "~/trpc/react"
import AskQuestionCard from "../dashboard/ask-question-card"
import React, { useState } from "react"
import Image from "next/image"
import MDEditor from '@uiw/react-md-editor'


export default function QaPage(){
   const  {projectId} =useProject()
   const {data: questions }=api.project.getQuestion.useQuery({ projectId })

    const [questionIndex, setquestionIndex] = useState(0)
    const question = questions?.[questionIndex]?.question || ""

   return (
      <Sheet>
        <AskQuestionCard />
        <div className="h-4"></div>
        <h1 className="text-xl font-semibold "> Saved Questions</h1>
        <div className="h-2"></div>
        <div className="flex flex-col gap-2">
          {questions.map((q , index) => {
            return <React.Fragment key={q.id}>
              <SheetTrigger onClick={() => setquestionIndex(index)}>
                <div className="flex items-center gap-4  bg-white rounded-lg p-4 shadow border ">
                  <img className="rounded-full" height={30} width={30} src={q.user.imageUrl ?? ""}></img>
                  <div className="text-left flex">
                     <div className="flex items-center gap-2" >
                        <p className="text-gray-700 line-clamp-1 text-lg font-medium"
                        >{q.question}</p>
                        <span className="text-sm text-gray-400 whitespace-nowrap">{q.createdAt.toLocaleString()}</span>
                     </div>

                     <p className="text-sm text-gray-500 line-clamp-2">
                        {q.answers}
                     </p>
                  </div>
                </div>
              </SheetTrigger>
            </React.Fragment>
          })}
        </div>

        {questions && (
         <SheetContent className="sm:max-w[80vw]">
           <SheetHeader>
             <SheetTitle>{question.question}</SheetTitle>
           </SheetHeader>
           <MDEditor.Markdown source={question.answer} />
         </SheetContent>
        )}

      </Sheet>
   )
}