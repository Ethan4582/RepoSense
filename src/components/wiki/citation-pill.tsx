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
        'mx-1 inline-flex max-w-full items-center gap-1.5 rounded-[5px] border px-1.5 py-[2px] align-baseline font-mono text-[11px] leading-tight no-underline transition-colors shadow-2xs',
        // Light mode: subtle gray background and borders; Dark mode: sleek dark background
        'border-neutral-300 bg-neutral-100 text-neutral-800 hover:border-neutral-400 hover:bg-neutral-200',
        'dark:border-neutral-700/80 dark:bg-[#16181d] dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-[#1f2229]',
        className,
      )}
    >
      <Github className="size-3 shrink-0 text-neutral-500 dark:text-neutral-400" />
      <span className="truncate font-medium">{target.filePath}</span>
      <span className="shrink-0 rounded-[3px] border border-neutral-300 bg-neutral-200/80 px-1 py-[0.5px] text-[10px] text-neutral-600 dark:border-neutral-700/60 dark:bg-neutral-800/80 dark:text-neutral-400">
        {lineLabel}
      </span>
    </a>
  );
}
