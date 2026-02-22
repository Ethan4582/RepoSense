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
                      <p className="text-gray-800 font-semibold  line-clamp-1">{q.question}</p>
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
          <SheetContent className="sm:max-w-[55vw] p-0 bg-gradient-to-br from-blue-50 to-white">
            <div className="h-full flex flex-col">
              {/* Header */}
              <SheetHeader className="px-6 py-4 bg-white border-b border-blue-100 shadow-sm">
                <SheetTitle className="text-xl font-bold text-gray-900 text-left">
                  {questionObj.question}
                </SheetTitle>
              </SheetHeader>

              {/* Content Area */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Answer Section - 50% height */}
                <div className="flex-1 min-h-0 bg-white border-b border-blue-100">
                  <div className="h-full flex flex-col">
                    <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                        Answer
                      </h3>
                    </div>
                   <div className="flex-1 overflow-auto px-2 py-2">
                  <div className="prose prose-blue max-w-none rounded-lg shadow-sm border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 ">
                    <MDEditor.Markdown source={questionObj.answers} />
                  </div>
                </div>
                  </div>
                </div>

                {/* Code References Section - 50% height */}
                <div className="flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-blue-50">
                  <div className="h-full flex flex-col">
                    <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                        Code References
                      </h3>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto p-1">
                      <CodeReferences
                        fileReferences={
                          Array.isArray(questionObj.fileReference)
                            ? questionObj.fileReference as { fileName: string; sourceCode: string; summary: string }[]
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        )}

      </Sheet>
   )
}