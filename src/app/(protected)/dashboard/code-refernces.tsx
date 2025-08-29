'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, Code2, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';

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
      <div className="flex items-center justify-center h-full bg-white rounded-lg border border-blue-200 shadow-sm">
        <div className="text-center space-y-3">
          <div className="p-3 bg-blue-50 rounded-full">
            <Code2 className="mx-auto h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-700">Loading Code References</h3>
            <p className="text-gray-500 text-xs mt-1">Fetching relevant files...</p>
          </div>
        </div>
      </div>
    );
  }

  if (fileReferences.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border border-blue-200 shadow-sm">
        <div className="text-center space-y-3">
          <div className="p-3 bg-gray-100 rounded-full">
            <FileText className="mx-auto h-6 w-6 text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-700">No Code References</h3>
            <p className="text-gray-500 text-xs mt-1">No relevant files found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-blue-200 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Compact Tab List */}
        <div className="border-b bg-blue-50/50 flex-shrink-0">
          <TabsList className="w-full justify-start h-auto p-1 bg-transparent">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {fileReferences.map((file) => {
                const extension = getFileExtension(file.fileName);
                return (
                  <TabsTrigger
                    key={file.fileName}
                    value={file.fileName}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/70"
                  >
                    <div className="flex items-center gap-1.5">
                      {getFileIcon(extension)}
                      <span className="truncate max-w-[120px]" title={file.fileName}>
                        {file.fileName.split('/').pop()}
                      </span>
                    </div>
                   
                  </TabsTrigger>
                );
              })}
            </div>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0">
          {fileReferences.map((file) => (
            <TabsContent
              key={file.fileName}
              value={file.fileName}
              className="h-full flex flex-col mt-0"
            >
              {/* Compact File Header */}
              <div className="border-b bg-gradient-to-r from-blue-50 to-white px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded shadow-sm">
                      {getFileIcon(getFileExtension(file.fileName))}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-gray-800 truncate">
                          {file.fileName.split('/').pop()}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {file.sourceCode.split('\n').length} lines
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(file.sourceCode, file.fileName)}
                    className="text-gray-600 hover:text-gray-800 hover:bg-white px-2 py-1 h-7 text-xs"
                  >
                    {copiedFile === file.fileName ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Collapsible File Summary */}
                {file.summary && (
                  <div className="bg-white rounded border shadow-sm">
                    <button
                      onClick={() => toggleSummary(file.fileName)}
                      className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-xs">Summary</span>
                      </div>
                      <div className={`transition-transform duration-200 ${expandedSummaries.has(file.fileName) ? 'rotate-90' : ''}`}>
                        <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                    
                    {expandedSummaries.has(file.fileName) && (
                      <div className="px-2 pb-2 border-t border-gray-100">
                        <p className="text-xs text-gray-600 leading-relaxed pt-2">
                          {file.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Code Content */}
              <div className="flex-1 min-h-0 overflow-auto">
                <SyntaxHighlighter
                  language={getLanguageFromExtension(getFileExtension(file.fileName))}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: '1.4',
                    padding: '16px',
                    height: '100%',
                  }}
                  showLineNumbers={true}
                  lineNumberStyle={{
                    minWidth: '2.5em',
                    paddingRight: '1em',
                    color: '#6b7280',
                    fontSize: '10px',
                    userSelect: 'none',
                  }}
                  wrapLines={true}
                  wrapLongLines={true}
                >
                  {file.sourceCode}
                </SyntaxHighlighter>
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};

export default CodeReferences;