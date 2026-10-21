'use client';

import * as React from 'react';
import { Check, Copy, FileCode2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

export interface ActiveFile {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

async function fetchFile(projectId: string, filePath: string): Promise<string | null> {
  const publicRes = await fetch(
    `/api/public/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`,
    { cache: 'no-store' }
  );
  if (publicRes.ok) {
    const data = (await publicRes.json()) as { content: string };
    return data.content;
  }

  const privateRes = await fetch(
    `/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`,
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
  file,
  onClose,
  className,
}: {
  projectId: string;
  file: ActiveFile;
  onClose?: () => void;
  className?: string;
}) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const highlightRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setContent(null);

    void fetchFile(projectId, file.filePath)
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
  }, [projectId, file.filePath]);

  React.useEffect(() => {
    if (!content || !file.startLine) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [content, file.startLine]);

  const lines = React.useMemo(() => (content ?? '').split('\n'), [content]);

  const copyPath = async () => {
    await navigator.clipboard.writeText(file.filePath);
    setCopied(true);
    toast.success('File path copied');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="size-4 shrink-0 text-primary" />
          <span className="truncate font-mono text-xs text-foreground">{file.filePath}</span>
          {file.startLine ? (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              L{file.startLine}-{file.endLine ?? file.startLine}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={copyPath} title="Copy path">
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </Button>
          {onClose ? (
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--code-background,transparent)]">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading source file...
          </div>
        ) : content === null ? (
          <div className="p-6 text-xs text-muted-foreground">
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
                    'flex',
                    highlighted && 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/20'
                  )}
                >
                  <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/60">
                    {lineNumber}
                  </span>
                  <span className="whitespace-pre text-foreground/90">{line || ' '}</span>
                </div>
              );
            })}
          </pre>
        )}
      </div>
    </div>
  );
}
