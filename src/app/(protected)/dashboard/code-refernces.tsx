'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, Code2, Copy, Check } from 'lucide-react';
import { Button } from '~/components/ui/button';

type Props = {
  fileReferences?: { fileName: string; sourceCode: string; summary: string }[];
};

const CodeReferences = ({ fileReferences }: Props) => {
  const [activeTab, setActiveTab] = React.useState(fileReferences?.[0]?.fileName ?? '');
  const [copiedFile, setCopiedFile] = React.useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = React.useState<Set<string>>(new Set());

  const copyToClipboard = async (code: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedFile(fileName);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const toggleSummary = (fileName: string) => {
    const newExpandedSummaries = new Set(expandedSummaries);
    if (newExpandedSummaries.has(fileName)) {
      newExpandedSummaries.delete(fileName);
    } else {
      newExpandedSummaries.add(fileName);
    }
    setExpandedSummaries(newExpandedSummaries);
  };

  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || 'text';
  };

  const getLanguageFromExtension = (extension: string) => {
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
    };
    return languageMap[extension] || 'text';
  };

  const getFileIcon = (extension: string) => {
    return <FileText className="h-3 w-3" />;
  };

  if (!fileReferences) {
    return (
      <motion.div 
        className="flex items-center justify-center h-full bg-white rounded-lg border border-gray-200 shadow-sm"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center space-y-4">
          <motion.div 
            className="p-4 bg-blue-50 rounded-xl"
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 1, 0] 
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Code2 className="mx-auto h-8 w-8 text-blue-500" />
          </motion.div>
          <div>
            <h3 className="text-base font-semibold text-gray-700">Loading Code References</h3>
            <p className="text-gray-500 text-sm mt-1">Fetching relevant files...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (fileReferences.length === 0) {
    return (
      <motion.div 
        className="flex items-center justify-center h-full bg-white rounded-lg border border-gray-200 shadow-sm"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center space-y-4">
          <div className="p-4 bg-gray-100 rounded-xl">
            <FileText className="mx-auto h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-700">No Code References</h3>
            <p className="text-gray-500 text-sm mt-1">No relevant files found</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Tab List */}
        <motion.div 
          className="border-b border-gray-200 bg-gray-50 flex-shrink-0"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <TabsList className="w-full justify-start h-auto p-2 bg-transparent">
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
              {fileReferences.map((file, index) => {
                const extension = getFileExtension(file.fileName);
                return (
                  <motion.div
                    key={file.fileName}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <TabsTrigger
                      value={file.fileName}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-gray-200 text-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        {getFileIcon(extension)}
                        <span className="truncate max-w-[140px]" title={file.fileName}>
                          {file.fileName.split('/').pop()}
                        </span>
                      </div>
                    </TabsTrigger>
                  </motion.div>
                );
              })}
            </div>
          </TabsList>
        </motion.div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {fileReferences.map((file) => (
              <TabsContent
                key={file.fileName}
                value={file.fileName}
                className="h-full flex flex-col mt-0"
              >
                <motion.div
                  className="h-full flex flex-col"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {/* File Header */}
                  <div className="border-b border-gray-200 bg-white px-4 py-3 flex-shrink-0">
                   
                    
                    {/* Collapsible Summary */}
                    {file.summary && (
                      <motion.div 
                        className="bg-blue-50 rounded-lg border -mt-3 border-blue-200 overflow-hidden"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        <motion.button
                          onClick={() => toggleSummary(file.fileName)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100 transition-colors group"
                          whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h- w-4 text-blue-600 flex-shrink-0" />
                            <span className="font-medium text-gray-700 text-sm">Summary</span>
                          </div>
                          <motion.div 
                            animate={{ 
                              rotate: expandedSummaries.has(file.fileName) ? 90 : 0 
                            }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="group-hover:text-blue-600 transition-colors"
                          >
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </motion.div>
                        </motion.button>
                        
                        <AnimatePresence>
                          {expandedSummaries.has(file.fileName) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 border-t border-blue-200">
                                <p className="text-sm text-gray-600 leading-relaxed pt-3">
                                  {file.summary}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </div>

                  {/* Code Content */}
                 <motion.div 
 className="flex-1 min-h-0 overflow-auto"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.3, duration: 0.3 }}
>
 <SyntaxHighlighter
   language={getLanguageFromExtension(getFileExtension(file.fileName))}
   style={oneDark}
   customStyle={{
     margin: 0,
     fontSize: '14px',
     lineHeight: '1.6',
     padding: '20px',
     height: '100%',
     background: '#2d3748',
     backgroundColor: '#2d3748',
     borderRadius: '0',
   }}
   showLineNumbers={true}
   lineNumberStyle={{
     minWidth: '2.5em',
     paddingRight: '1.5em',
     color: '#718096',
     fontSize: '13px',
     userSelect: 'none',
     textAlign: 'right',
   }}
   wrapLines={true}
   wrapLongLines={true}
 >
   {file.sourceCode}
 </SyntaxHighlighter>
</motion.div>
                </motion.div>
              </TabsContent>
            ))}
          </AnimatePresence>
        </div>
      </Tabs>
    </motion.div>
  );
};

export default CodeReferences;