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

  const copyToClipboard = async (code: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedFile(fileName);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
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
    // You can add more specific icons based on file types
    return <FileText className="h-4 w-4" />;
  };

  if (!fileReferences) {
    return (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-center space-y-4">
          <div className="p-4 bg-white rounded-full shadow-sm">
            <Code2 className="mx-auto h-8 w-8 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Loading Code References</h3>
            <p className="text-gray-500 text-sm">Fetching relevant files from your codebase...</p>
          </div>
        </div>
      </div>
    );
  }

  if (fileReferences.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="text-center space-y-4">
          <div className="p-4 bg-white rounded-full shadow-sm">
            <FileText className="mx-auto h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No Code References</h3>
            <p className="text-gray-500 text-sm">No relevant files were found for this question</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Code2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Code References</h3>
            <p className="text-sm text-gray-600 mt-1">
              Files analyzed to answer your question
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
            {fileReferences.length} {fileReferences.length === 1 ? 'file' : 'files'}
          </Badge>
        </div>
      </div>

      {/* Enhanced Tabs Container */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Enhanced Tab List */}
          <div className="border-b bg-gray-50">
            <TabsList className="w-full justify-start h-auto p-2 bg-transparent">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
                {fileReferences.map((file) => {
                  const extension = getFileExtension(file.fileName);
                  return (
                    <TabsTrigger
                      key={file.fileName}
                      value={file.fileName}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-blue-200 hover:bg-white/70"
                    >
                      <div className="flex items-center gap-2">
                        {getFileIcon(extension)}
                        <span className="truncate max-w-[200px]" title={file.fileName}>
                          {file.fileName.split('/').pop()}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-gray-100">
                        {extension.toUpperCase()}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </div>
            </TabsList>
          </div>

          {/* Enhanced Tab Content */}
          {fileReferences.map((file) => (
            <TabsContent
              key={file.fileName}
              value={file.fileName}
              className="mt-0"
            >
              {/* Enhanced File Header */}
              <div className="border-b bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getFileIcon(getFileExtension(file.fileName))}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-800">
                          {file.fileName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getFileExtension(file.fileName).toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {file.sourceCode.split('\n').length} lines
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(file.sourceCode, file.fileName)}
                      className="text-gray-600 hover:text-gray-800 hover:bg-white"
                    >
                      {copiedFile === file.fileName ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* File Summary */}
                {file.summary && (
                  <div className="bg-white rounded-lg p-4 border shadow-sm">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-700 text-sm">File Summary:</span>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          {file.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Code Content */}
              <div className="relative">
                <div className="max-h-[60vh] overflow-auto">
                  <SyntaxHighlighter
                    language={getLanguageFromExtension(getFileExtension(file.fileName))}
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      fontSize: '14px',
                      lineHeight: '1.6',
                      padding: '24px',
                    }}
                    showLineNumbers={true}
                    lineNumberStyle={{
                      minWidth: '3.5em',
                      paddingRight: '1.5em',
                      color: '#6b7280',
                      fontSize: '12px',
                      userSelect: 'none',
                    }}
                    wrapLines={true}
                    wrapLongLines={true}
                  >
                    {file.sourceCode}
                  </SyntaxHighlighter>
                </div>
                
                {/* Fade overlay for long content */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default CodeReferences;