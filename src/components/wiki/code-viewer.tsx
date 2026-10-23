'use client';

import * as React from 'react';
import { Check, ChevronDown, ChevronRight, Copy, FileCode2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { getApiBaseUrl } from '~/lib/api-client';

export interface ActiveFile {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

async function fetchFile(
  projectId: string,
  filePath: string,
  branch?: string
): Promise<string | null> {
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';
  const publicRes = await fetch(
    `${getApiBaseUrl()}/api/public/projects/${projectId}/file?path=${encodeURIComponent(filePath)}${branchQuery}`,
    { cache: 'no-store' }
  );
  if (publicRes.ok) {
    const data = (await publicRes.json()) as { content: string };
    return data.content;
  }

  const privateRes = await fetch(
    `${getApiBaseUrl()}/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}${branchQuery}`,
    { cache: 'no-store' }
  );
  if (privateRes.ok) {
    const data = (await privateRes.json()) as { content: string };
    return data.content;
  }

  return null;
}

export function CodeViewer({
  projectId,
  branch,
  file,
  onClose,
  collapsible = false,
  defaultExpanded = true,
  className,
}: {
  projectId: string;
  branch?: string;
  file: ActiveFile;
  onClose?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const highlightRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setContent(null);

    void fetchFile(projectId, file.filePath, branch)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, branch, file.filePath]);

  React.useEffect(() => {
    if (!content || !file.startLine || !isExpanded) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [content, file.startLine, isExpanded]);

  const lines = React.useMemo(() => (content ?? '').split('\n'), [content]);

  const copyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(file.filePath);
    setCopied(true);
    toast.success('File path copied');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-border/50 bg-[#0d1117] text-neutral-200 shadow-sm transition-all', className)}>
      <div
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        className={cn(
          'flex select-none items-center justify-between gap-2 border-b border-border/40 bg-neutral-900/80 px-3 py-2',
          collapsible && 'cursor-pointer hover:bg-neutral-900'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {collapsible ? (
            isExpanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <FileCode2 className="size-3.5 shrink-0 text-neutral-400" />
          <span className="truncate font-mono text-xs font-medium text-neutral-200">{file.filePath}</span>
          {file.startLine ? (
            <span className="shrink-0 rounded bg-neutral-800 border border-neutral-700/60 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
              L{file.startLine}-{file.endLine ?? file.startLine}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-6 text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={copyPath} title="Copy path">
            {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          </Button>
          {onClose ? (
            <Button variant="ghost" size="icon" className="size-6 text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              <X className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <div className="max-h-[380px] overflow-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-xs text-neutral-400">
              <Loader2 className="size-4 animate-spin text-neutral-400" />
              Loading source file...
            </div>
          ) : content === null ? (
            <div className="p-5 text-xs text-neutral-400">
              Full file content is not available for this path.
            </div>
          ) : (
            <pre className="min-w-max p-3 font-mono text-[12px] leading-5">
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const highlighted =
                  file.startLine !== undefined &&
                  lineNumber >= file.startLine &&
                  lineNumber <= (file.endLine ?? file.startLine);

                return (
                  <div
                    key={lineNumber}
                    ref={highlighted && lineNumber === file.startLine ? highlightRef : undefined}
                    className={cn(
                      'flex transition-colors',
                      highlighted && 'bg-[#1f293d] border-l-2 border-[#3b82f6]'
                    )}
                  >
                    <span className="w-11 shrink-0 select-none pr-3 text-right text-neutral-500">
                      {lineNumber}
                    </span>
                    <span className={cn('whitespace-pre', highlighted ? 'text-neutral-100 font-medium' : 'text-neutral-300')}>
                      {line || ' '}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
