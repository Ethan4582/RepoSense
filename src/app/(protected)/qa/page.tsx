'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet"
import useProject from "~/hooks/use-project"
import { api } from "~/trpc/react"
import AskQuestionCard from "../dashboard/ask-question-card"
import React, { useState } from "react"

import MDEditor from '@uiw/react-md-editor'
import CodeReferences from "../dashboard/code-refernces"

export default function QaPage(){
   const {projectId} = useProject()
   const {data: questions} = api.project.getQuestion.useQuery(
     { projectId: projectId ?? '' },
     { enabled: !!projectId }
   )

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
                <SheetTitle className="text-lg font-bold text-gray-900 line-clamp-2">
                  {questionObj.question}
                </SheetTitle>
              </SheetHeader>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Answer Section */}
                <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Answer</h3>
                  <div className="prose max-w-none text-gray-800">
                    <MDEditor.Markdown source={questionObj.answers} />
                  </div>
                </div>

                {/* References Section */}
                <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Source References</h3>
                  <CodeReferences fileReferences={(questionObj.fileReference ?? []) as any} />
                </div>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
   )
}
