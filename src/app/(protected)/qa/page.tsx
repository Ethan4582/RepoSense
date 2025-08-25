'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet"
import useProject from "~/hooks/use-project"
import { api } from "~/trpc/react"
import AskQuestionCard from "../dashboard/ask-question-card"
import React, { useState } from "react"

import MDEditor from '@uiw/react-md-editor'
import CodeReferences from "../dashboard/code-refernces"


export default function QaPage(){
   const  {projectId} =useProject()
   const {data: questions }=api.project.getQuestion.useQuery({ projectId })

    const [questionIndex, setquestionIndex] = useState(0)
    const questionObj = questions?.[questionIndex]; 
    const questionText = questionObj?.question || ""

   return (
      <Sheet>
        <AskQuestionCard />
        <div className="h-4"></div>
        <h1 className="text-xl font-semibold "> Saved Questions</h1>
        <div className="h-2"></div>
        <div className="flex flex-col gap-2">
          {(questions ?? []).map((q , index) => (
            <React.Fragment key={q.id}>
              <SheetTrigger onClick={() => setquestionIndex(index)}>
                <div className="flex items-center gap-4 bg-white rounded-lg p-4 shadow border hover:bg-blue-50 transition">
                  <img className="rounded-full border border-gray-200" height={36} width={36} src={q.user.imageUrl ?? ""} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-800 font-semibold text-base line-clamp-1">{q.question}</p>
                      <span className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">{q.answers}</p>
                  </div>
                </div>
              </SheetTrigger>
            </React.Fragment>
          ))}
        </div>

        {questionObj && (
          <SheetContent className="sm:max-w-[40vw] sm:max-h-[40vh]">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold">{questionObj.question}</SheetTitle>
            </SheetHeader>
            <div className="mb-4">
              <MDEditor.Markdown source={questionObj.answers} />
            </div>
            <CodeReferences
              fileReferences={
                Array.isArray(questionObj.fileReference)
                  ? questionObj.fileReference as { fileName: string; sourceCode: string; summary: string }[]
                  : undefined
              }
            />
          </SheetContent>
        )}

      </Sheet>
   )
}