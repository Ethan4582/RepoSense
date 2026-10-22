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
  const effectiveEnd = target.startLine === target.endLine
    ? target.startLine + 1
    : target.endLine;
  const lineLabel = `${target.startLine}-${effectiveEnd}`;

  // If githubUrl has #L{start}, ensure anchor matches the line range
  const finalGithubUrl = React.useMemo(() => {
    if (!githubUrl) return undefined;
    return githubUrl.replace(/#L\d+(?:-L?\d+)?$/, `#L${target.startLine}-L${effectiveEnd}`);
  }, [githubUrl, target.startLine, effectiveEnd]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.altKey && onCitation) {
      event.preventDefault();
      onCitation({ ...target, endLine: effectiveEnd });
      return;
    }
    if (finalGithubUrl) {
      return;
    }
    if (onCitation) {
      event.preventDefault();
      onCitation({ ...target, endLine: effectiveEnd });
    }
  };

  return (
    <a
      href={finalGithubUrl || '#'}
      target={finalGithubUrl ? '_blank' : undefined}
      rel={finalGithubUrl ? 'noopener noreferrer' : undefined}
      title={finalGithubUrl ? `Open ${target.filePath}:${lineLabel} on GitHub` : `${target.filePath}:${lineLabel}`}
      onClick={handleClick}
      className={cn(
        'group mx-1 inline-flex max-w-full items-stretch overflow-hidden rounded-[6px] border align-baseline text-[13px] font-normal no-underline shadow-2xs transition-colors',
        'border-neutral-300/80 bg-neutral-100 text-neutral-800 hover:border-neutral-400',
        'dark:border-neutral-700/80 dark:bg-[#16181d] dark:text-neutral-200 dark:hover:border-neutral-600',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 px-2 py-0.5 font-mono text-[13px] text-neutral-700 group-hover:underline dark:text-neutral-300">
        <Github className="size-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />
        <span className="truncate">{target.filePath}</span>
      </span>
      <span className="flex items-center border-l border-neutral-300/80 bg-neutral-200/90 px-1.5 py-0.5 font-mono text-[11px] font-normal text-neutral-600 dark:border-neutral-700/80 dark:bg-neutral-800/90 dark:text-neutral-300">
        {lineLabel}
      </span>
    </a>
  );
}
