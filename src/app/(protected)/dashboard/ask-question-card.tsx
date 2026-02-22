'use client'

import { motion, AnimatePresence } from 'framer-motion';
import { DialogTitle } from '@radix-ui/react-dialog'
import Image from 'next/image'
import React, { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardTitle } from '~/components/ui/card'
import { Dialog, DialogContent, DialogHeader } from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import { Separator } from '~/components/ui/separator'
import { Bot, MessageSquare, Loader2, Sparkles, FileText, Code2, ChevronDown, PlusCircle } from 'lucide-react'
import useProject from '~/hooks/use-project'
import { askReposense, askFollowUp } from './action' // Updated import
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import useRefetch from '~/hooks/use-refetch';

// Helper function to generate cache key
const getCacheKey = (projectId: string, question: string) => {
  return `reposense-${projectId}-${question.trim().toLowerCase()}`;
};

const formatAnswer = (text: string) => {
  // Format headings
  let formatted = text.replace(/^# (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-800">$1</h2>');
  formatted = formatted.replace(/^## (.*$)/gm, '<h3 class="text-lg font-semibold mt-5 mb-2 text-gray-800">$1</h3>');
  
  // Format lists
  formatted = formatted.replace(/^\* (.*$)/gm, '<li class="ml-4 list-disc">$1</li>');
  formatted = formatted.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>');
  
  // Format code blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, 
    '<div class="bg-gray-100 p-3 rounded-md overflow-x-auto my-3 border border-gray-200"><code class="font-mono text-sm">$1</code></div>');
  
  // Format inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');
  
  // Format bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
  // Format italic text
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  
  // Format links
  formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, 
    '<a href="$2" class="text-blue-600 hover:underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Convert line breaks to paragraphs
  formatted = formatted.split('\n\n').map(para => 
    para.trim() ? `<p class="mb-4 last:mb-0">${para}</p>` : ''
  ).join('');
  
  return formatted;
};


const AskQuestionCard = () => {
  const { project } = useProject();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [activeFileTab, setActiveFileTab] = useState(0);
  const [fileReferences, setFileReferences] = useState<{ 
    fileName: string; 
    sourceCode: string; 
    summary: string 
  }[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [isFollowUp, setIsFollowUp] = useState(false);
   const saveAnswer = api.project.saveAnswer.useMutation();

 
  const getCachedResponse = (projectId: string, question: string) => {
    if (typeof window === 'undefined') return null;
    const cacheKey = getCacheKey(projectId, question);
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  };

  const cacheResponse = (projectId: string, question: string, answer: string, files: any[]) => {
    if (typeof window === 'undefined') return;
    const cacheKey = getCacheKey(projectId, question);
    localStorage.setItem(cacheKey, JSON.stringify({ answer, files }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id || !question.trim()) return;

    const cached = getCachedResponse(project.id, question);
    if (cached && !isFollowUp) {
      setAnswer(cached.answer);
      setFileReferences(cached.files);
      setOpen(true);
      return;
    }

    setLoading(true);
    setOpen(true);

    try {
      let result;
      if (isFollowUp) {
        result = await askFollowUp(question, answer); // Only use previous answer for context
      } else {
        result = await askReposense(question, project.id);
        cacheResponse(project.id, question, result.answer, result.fileReferences);
      }

      setAnswer(result.answer);
      if (!isFollowUp) {
        setFileReferences(result.fileReferences);
      }
    } catch (error) {
      console.error("AI error:", error);
      setAnswer("Sorry, there was an error processing your question. Please try again.");
    } finally {
      setLoading(false);
      setIsFollowUp(false);
    }
  };

  const handleFollowUp = () => {
    setIsFollowUp(true);
    setQuestion("");
    setOpen(false);
  };

  const handleNewQuestion = () => {
    setQuestion("");
    setAnswer("");
    setFileReferences([]);
    setIsFollowUp(false);
    setOpen(false);
  };

  const refetch = useRefetch();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[85vw] max-h-[80vh] w-full flex flex-col p-0 rounded-lg overflow-hidden border border-gray-200 shadow-xl">
          <DialogHeader className="p-4 border-b border-gray-200 bg-white">
            <div className="flex justify-between items-center gap-2 ">
              <DialogTitle className="flex items-center gap-1">
                <Image src='/logo.png' alt="Reposense" width={24} height={24} />
                <span className="text-lg font-medium text-gray-800">Reposense AI</span>
                 <Button
                variant={'outline'}
                disabled={saveAnswer.isPending}
                 onClick={() => saveAnswer.mutate({ 
                  projectId: project!.id, 
                  question, 
                  answers: answer, 
                    fileReference: fileReferences }, {
                  onSuccess:()=>{
                    toast.success("Answer saved successfully")
                    refetch();
                  },
                  onError:()=>{
                    toast.error("Failed to save answer")
                  }
                 })}

                >
                 Save Answer 
                </Button>
              </DialogTitle>
              {answer && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFollowUp}
                    className="flex items-center gap-1"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Follow-up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewQuestion}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="w-4 h-4" />
                    New Question
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

         
          <div className="flex-1 overflow-auto">
          
            <div className="px-6 py-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    <p className="text-sm text-gray-600">Analyzing your question...</p>
                  </div>
                </div>
              ) : answer ? (
                <div className="prose prose-sm sm:prose-base max-w-none">
                  <div 
                    className="text-gray-700"
                    dangerouslySetInnerHTML={{ __html: formatAnswer(answer) }}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No response generated</p>
                </div>
              )}
            </div>

         
            {fileReferences.length > 0 && (
              <div className="border-t border-gray-200">
            
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Referenced Files</h3>
                  
                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                      {fileReferences.length} {fileReferences.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </div>

              
                
           
                <div className="flex overflow-x-auto bg-white border-b border-gray-200">
                  {fileReferences.map((file, index) => (
                    <button
                      key={`tab-${file.fileName}-${index}`}
                      onClick={() => setActiveFileTab(index)}
                      className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeFileTab === index
                          ? 'text-blue-900 border-blue-600 bg-blue-50'
                          : 'text-gray-600 border-transparent hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="truncate max-w-[180px]">{file.fileName.split('/').pop()}</span>
                    </button>
                  ))}
                </div>

              
              {fileReferences[activeFileTab] && (
                <motion.div
                  className="flex-1 min-h-0 overflow-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <div className="bg-gray-50 text-gray-900 rounded-b-lg">
                    <div className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-mono text-gray-700">
                          {fileReferences[activeFileTab].fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                          onClick={() => {
                            if (fileReferences[activeFileTab]?.sourceCode) {
                              navigator.clipboard.writeText(fileReferences[activeFileTab].sourceCode);
                            }
                          }}
                        >
                          Copy
                        </button>
                        <button
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
                          onClick={() => setShowSummary(!showSummary)}
                        >
                          <span>Summary</span>
                          <motion.span
                            animate={{ rotate: showSummary ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </motion.span>
                        </button>
                      </div>
                    </div>

                    {showSummary && fileReferences[activeFileTab].summary && (
                      <div className="px-4 py-2 bg-white text-sm text-gray-700 border-b border-gray-200">
                        <div className="font-medium text-blue-600 mb-1">Summary:</div>
                        <div>{fileReferences[activeFileTab].summary}</div>
                      </div>
                    )}
                    
                    <div className="bg-gray-800 text-gray-300 p-4 max-h-[300px] overflow-auto rounded-b-lg">
                      <pre className="text-sm font-mono leading-6">
                        <code className="text-gray-300">{fileReferences[activeFileTab].sourceCode}</code>
                      </pre>
                    </div>
                  </div>
                </motion.div>
)}



              </div>
            )}
          </div>

     
          <div className="border-t p-4 flex justify-between items-center bg-gray-50">
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Powered by GenAI Stack
            </div>
            <Button 
              variant="outline"
              onClick={() => setOpen(false)}
              size="sm"
              className="border-gray-300 hover:bg-gray-100"
            >
              Close
            </Button>
          </div>
         
        </DialogContent>
      </Dialog>

      <Card className='relative col-span-1 sm:col-span-2 lg:col-span-3 shadow-sm hover:shadow-md transition-shadow border border-blue-100'>
        <CardTitle className="px-4 py-1 text-lg font-semibold border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {isFollowUp ? 'Ask a Follow-up' : 'Ask a Question'}
            <div className="ml-auto text-xs font-normal text-gray-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </div>
          </div>
        </CardTitle>
        
        
        <CardContent className="">
          <form onSubmit={onSubmit}>
             <label className="text-sm   font-medium text-gray-700">
                {isFollowUp ? 'What would you like to know more about?' : 'What would you like to know about your codebase?'}
              </label>
            <div>
             
              <Textarea
                placeholder={
                  isFollowUp 
                    ? "e.g., Can you explain that in more detail?" 
                    : "e.g., Which file should I edit to change the home page?"
                }
                className="w-full h-20 p-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  Processing...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  {isFollowUp ? 'Ask Follow-up' : 'Ask Reposense AI'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export default AskQuestionCard;



