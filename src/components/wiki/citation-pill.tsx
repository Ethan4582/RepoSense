'use client';

import * as React from 'react';
import { Github } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { CitationTarget } from './markdown';

export function CitationPill({
  target,
  githubUrl,
  onCitation,
  className,
}: {
  target: CitationTarget;
  githubUrl?: string;
  onCitation?: (target: CitationTarget) => void;
  className?: string;
}) {
  const lineLabel = target.startLine === target.endLine
    ? String(target.startLine)
    : `${target.startLine}-${target.endLine}`;
  const fileName = target.filePath.split('/').filter(Boolean).pop() ?? target.filePath;

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    const openGithub = event.metaKey || event.ctrlKey;
    if (!openGithub || !githubUrl) {
      event.preventDefault();
      onCitation?.(target);
      return;
    }
    window.open(githubUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      title={`${target.filePath}:${lineLabel}`}
      onClick={open}
      className={cn(
        'mx-0.5 inline-flex max-w-full translate-y-[-1px] items-stretch overflow-hidden rounded-md border border-border/60 bg-muted/70 p-0 align-baseline font-mono text-[11px] leading-5 text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted',
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 px-2 py-0.5">
        <Github className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{fileName}</span>
      </span>
      <span className="shrink-0 border-l border-border/60 bg-background/45 px-2 py-0.5 text-muted-foreground">
        {lineLabel}
      </span>
    </button>
  );
}
