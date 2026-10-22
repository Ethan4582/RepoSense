'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidDiagram } from './mermaid';
import { cn } from '~/lib/utils';

export interface CitationTarget {
  filePath: string;
  startLine: number;
  endLine: number;
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  );
}

function nodeToText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

function renderCitations(markdown: string): string {
  return markdown.replace(/\[\[([^:\]]+):(\d+)-(\d+)\]\]/g, (_match: string, path: string, start: string, end: string) => {
    const label = `${path}:${start}-${end}`;
    return `[${label}](citation:${encodeURIComponent(path)}:${start}:${end})`;
  });
}

function useIsDark() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function WikiMarkdown({
  content,
  onCitation,
  className,
}: {
  content: string;
  onCitation?: (target: CitationTarget) => void;
  className?: string;
}) {
  const isDark = useIsDark();
  const prepared = React.useMemo(() => renderCitations(content), [content]);
  const headingCounts = new Map<string, number>();
  const headingId = (text: string) => {
    const base = slugify(text);
    const count = headingCounts.get(base) ?? 0;
    headingCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };

  return (
    <div className={cn('wiki-prose max-w-none text-sm leading-7 text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-2 mb-5 text-2xl font-bold tracking-tight text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const text = nodeToText(children);
            return (
              <h2 id={headingId(text)} className="mt-9 mb-3 text-xl font-semibold tracking-tight text-foreground">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const text = nodeToText(children);
            return (
              <h3 id={headingId(text)} className="mt-7 mb-2 text-base font-semibold text-foreground">
                {children}
              </h3>
            );
          },
          p: ({ children }) => <p className="my-3 text-foreground/90">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b px-3 py-2 text-left font-semibold text-foreground">{children}</th>
          ),
          td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          a: ({ href, children }) => {
            if (href?.startsWith('citation:')) {
              const raw = href.slice('citation:'.length);
              const lastColon = raw.lastIndexOf(':');
              const secondColon = raw.lastIndexOf(':', lastColon - 1);
              const path = decodeURIComponent(raw.slice(0, secondColon));
              const startLine = Number(raw.slice(secondColon + 1, lastColon));
              const endLine = Number(raw.slice(lastColon + 1));

              return (
                <button
                  type="button"
                  onClick={() => onCitation?.({ filePath: path, startLine, endLine })}
                  className="mx-0.5 inline-flex items-center rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {children}
                </button>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          code: ({ className: codeClassName, children, ...props }) => {
            const language = /language-(\w+)/.exec(codeClassName ?? '')?.[1];
            const raw = nodeToText(children).replace(/\n$/, '');

            if (language === 'mermaid') {
              return <MermaidDiagram chart={raw} />;
            }

            if (language) {
              return (
                <div className="my-4 overflow-hidden rounded-lg border">
                  <SyntaxHighlighter
                    language={language}
                    style={isDark ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      background: 'var(--muted)',
                    }}
                    codeTagProps={{ style: { fontFamily: 'var(--font-mono, monospace)' } }}
                    wrapLongLines
                  >
                    {raw}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
