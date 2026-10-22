'use client';

import * as React from 'react';

let mermaidLoaded: Promise<typeof import('mermaid')> | null = null;

export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        mermaidLoaded ??= import('mermaid');
        const mermaid = (await mermaidLoaded).default;
        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'var(--font-geist-sans)',
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to render diagram');
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Diagram could not be rendered: {error}
      </div>
    );
  }

  return (
    <div className="my-5 flex justify-center overflow-x-auto rounded-lg border bg-card p-4">
      {svg ? (
        <div className="min-w-0" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-32 w-full animate-pulse rounded bg-muted/50" />
      )}
    </div>
  );
}
