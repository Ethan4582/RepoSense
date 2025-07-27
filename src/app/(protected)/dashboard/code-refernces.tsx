'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, Code2, Copy, Check } from 'lucide-react';
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

  if (!fileReferences) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <div className="text-center">
          <Code2 className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading code references...</p>
        </div>
      </div>
    );
  }

  if (fileReferences.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <div className="text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">No code references available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Code References</h3>
          <Badge variant="secondary" className="ml-2">
            {fileReferences.length} {fileReferences.length === 1 ? 'file' : 'files'}
          </Badge>
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab List */}
        <div className="border-b border-gray-200 bg-white rounded-t-lg">
          <TabsList className="w-full justify-start h-auto p-1 bg-transparent">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300">
              {fileReferences.map((file) => (
                <TabsTrigger
                  key={file.fileName}
                  value={file.fileName}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all whitespace-nowrap data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[150px]" title={file.fileName}>
                    {file.fileName}
                  </span>
                </TabsTrigger>
              ))}
            </div>
          </TabsList>
        </div>

        {/* Tab Content */}
        {fileReferences.map((file) => (
          <TabsContent
            key={file.fileName}
            value={file.fileName}
            className="mt-0 border border-t-0 rounded-b-lg bg-white"
          >
            {/* File Info Header */}
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="font-mono text-sm text-gray-700">{file.fileName}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getFileExtension(file.fileName).toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(file.sourceCode, file.fileName)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {copiedFile === file.fileName ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              
              {/* File Summary */}
              {file.summary && (
                <div className="mt-2 text-sm text-gray-600 bg-white rounded px-3 py-2 border">
                  <span className="font-medium text-gray-700">Summary: </span>
                  {file.summary}
                </div>
              )}
            </div>

            {/* Code Content */}
            <div className="relative">
              <div className="max-h-[50vh] overflow-auto">
                <SyntaxHighlighter
                  language={getLanguageFromExtension(getFileExtension(file.fileName))}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0 0 8px 8px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}
                  showLineNumbers={true}
                  lineNumberStyle={{
                    minWidth: '3em',
                    paddingRight: '1em',
                    color: '#6b7280',
                    fontSize: '12px',
                  }}
                >
                  {file.sourceCode}
                </SyntaxHighlighter>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default CodeReferences;