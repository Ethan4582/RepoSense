'use client'

import MDEditor from '@uiw/react-md-editor'
import { DialogTitle } from '@radix-ui/react-dialog'
import Image from 'next/image'
import React from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { Dialog, DialogContent, DialogHeader } from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { Separator } from '~/components/ui/separator'
import { Bot, MessageSquare, Loader2, Sparkles, FileText, Code2 } from 'lucide-react'
import useProject from '~/hooks/use-project'
import { askReposense } from './action'
import { readStreamableValue } from 'ai/rsc'

const AskQuestionCard = () => {
  const {project} = useProject()
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [question, setQuestion] = React.useState("")
  const [answer, setAnswer] = React.useState("")
  const [activeFileTab, setActiveFileTab] = React.useState(0)
  const [fileReferences, setFileReferences] = React.useState<{ 
    fileName: string; 
    sourceCode: string; 
    summary: string 
  }[]>([])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!project?.id || !question.trim()) return
    
    setLoading(true)
    setAnswer("")
    setFileReferences([])
    setActiveFileTab(0)
    setOpen(true)

    try {
      const {output, fileReferences} = await askReposense(question, project.id)
      setFileReferences(fileReferences)

      // Process the stream
      for await (const delta of readStreamableValue(output)) {
        if (typeof delta === 'string') {
          setAnswer(prev => prev + delta)
        }
      }
    } catch (error) {
      console.error("Error:", error)
      setAnswer("Sorry, there was an error processing your question. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[85vw] max-h-[80vh] w-full flex flex-col p-0">
          {/* Simple Header */}
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Image src='/logo.png' alt="Reposense" width={24} height={24} />
              <span className="text-lg font-medium">Reposense AI</span>
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable container for entire content */}
          <div className="flex-1 overflow-auto">
            {/* Answer Section - Expands to content size */}
            <div className="px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    <p className="text-sm text-gray-600">Analyzing your question...</p>
                  </div>
                </div>
              ) : answer ? (
                <div className="prose max-w-none" data-color-mode="light">
                  <MDEditor.Markdown 
                    source={answer} 
                    style={{ 
                      whiteSpace: 'pre-wrap',
                      backgroundColor: 'transparent',
                      padding: 0,
                      fontSize: '15px',
                      lineHeight: '1.6'
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No response generated</p>
                </div>
              )}
            </div>

            {/* File References Section with Tabs - Now part of scrollable content */}
            {fileReferences.length > 0 && (
              <div className="border-t bg-gray-50">
                {/* File Tabs - Similar to image */}
                <div className="flex overflow-x-auto border-b bg-white">
                  {fileReferences.map((file, index) => (
                    <button
                      key={`tab-${file.fileName}-${index}`}
                      onClick={() => setActiveFileTab(index)}
                      className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeFileTab === index
                          ? 'text-blue-600 border-blue-600 bg-blue-50'
                          : 'text-gray-600 border-transparent hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {file.fileName.split('/').pop()}
                    </button>
                  ))}
                </div>

                {/* File Content - Dark theme like in image */}
                {fileReferences[activeFileTab] && (
                  <div className="bg-gray-900 text-gray-100">
                    <div className="p-4">
                      <pre className="text-sm font-mono whitespace-pre-wrap">
                        <code>{fileReferences[activeFileTab].sourceCode}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Simple Footer */}
          <div className="border-t p-4 flex justify-end bg-white">
            <Button 
              variant="outline"
              onClick={() => setOpen(false)}
              size="sm"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compact Input Card */}
      <Card className='relative col-span-1 sm:col-span-2 lg:col-span-3 shadow-sm hover:shadow-md transition-shadow border border-blue-100'>
        <CardTitle className="px-4 py-1 text-lg font-semibold border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Ask a Question
            <div className="ml-auto text-xs font-normal text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </div>
          </div>
        </CardTitle>
        
        <CardContent className="">
          <form onSubmit={onSubmit} > 
            <div >
              <label className="text-sm font-medium text-gray-700">
                What would you like to know about your codebase?
              </label>
              <Textarea
                placeholder="e.g., Which file should I edit to change the home page? How does user authentication work?"
                className="w-full h-20 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
              />
            </div>
            <Separator className="my-2" />
            <Button 
              type="submit" 
              disabled={loading || !question.trim()} 
              className="w-full flex items-center justify-center gap-2 h-10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Question...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Ask Reposense AI
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            Powered by AI • Searches your entire codebase for relevant answers
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default AskQuestionCard