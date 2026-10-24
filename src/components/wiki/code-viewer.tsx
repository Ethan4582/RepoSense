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
  highlightRange,
  initialScrollLine,
  onClose,
  collapsible = false,
  defaultExpanded = true,
  className,
}: {
  projectId: string;
  branch?: string;
  file: ActiveFile;
  highlightRange?: [number, number];
  initialScrollLine?: number;
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

  const startLine = highlightRange ? highlightRange[0] : file.startLine;
  const endLine = highlightRange ? highlightRange[1] : (file.endLine ?? file.startLine);
  const scrollToLine = initialScrollLine ?? startLine;

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
    if (!content || !scrollToLine || !isExpanded) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [content, scrollToLine, isExpanded]);

  const lines = React.useMemo(() => (content ?? '').split('\n'), [content]);

  const copyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(file.filePath);
    setCopied(true);
    toast.success('File path copied');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-[#ececec] bg-background text-foreground shadow-xs transition-all dark:border-[#27272a] dark:bg-[#0d1117] dark:text-neutral-200', className)}>
      <div
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        className={cn(
          'flex select-none items-center justify-between gap-2 border-b border-[#ececec] bg-muted/30 px-3 py-2 dark:border-[#27272a] dark:bg-neutral-900/80',
          collapsible && 'cursor-pointer hover:bg-muted/50 dark:hover:bg-neutral-900'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {collapsible ? (
            isExpanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <FileCode2 className="size-3.5 shrink-0 text-primary" />
          <span className="truncate font-mono text-xs font-semibold text-foreground dark:text-neutral-200">{file.filePath}</span>
          {startLine ? (
            <span className="shrink-0 rounded bg-muted border border-[#ececec] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-300">
              L{startLine}-{endLine ?? startLine}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800" onClick={copyPath} title="Copy path">
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </Button>
          {onClose ? (
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              <X className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <div className="max-h-[380px] overflow-auto bg-card dark:bg-[#0d1117]">
          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Loading source file...
            </div>
          ) : content === null ? (
            <div className="p-5 text-xs text-muted-foreground">
              Full file content is not available for this path.
            </div>
          ) : (
            <pre className="min-w-max p-3 font-mono text-[12px] leading-5">
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const highlighted =
                  startLine !== undefined &&
                  lineNumber >= startLine &&
                  lineNumber <= (endLine ?? startLine);

                return (
                  <div
                    key={lineNumber}
                    ref={highlighted && lineNumber === scrollToLine ? highlightRef : undefined}
                    className={cn(
                      'flex transition-colors',
                      highlighted
                        ? 'bg-[#1d4ed8]/20 border-l-[3px] border-[#2563eb] dark:bg-primary/30 dark:border-primary'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <span className={cn('w-11 shrink-0 select-none pr-3 text-right', highlighted ? 'text-[#1d4ed8] font-semibold dark:text-primary' : 'text-muted-foreground/60')}>
                      {lineNumber}
                    </span>
                    <span className="whitespace-pre text-foreground/90 dark:text-neutral-200">
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
