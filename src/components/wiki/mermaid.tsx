'use client';

import * as React from 'react';

let mermaidLoaded: Promise<typeof import('mermaid')> | null = null;

function sanitizeMermaidChart(raw: string): string {
  let chart = raw.trim();
  // Strip any wrapping fences if passed
  chart = chart.replace(/^```(?:mermaid)?\n?/i, '').replace(/\n?```$/i, '').trim();

  // If chart is empty, return empty
  if (!chart) return '';

  // Sanitize node labels to ensure labels are wrapped in quotes: id["Label"]
  chart = chart.replace(/([a-zA-Z0-9_-]+)\[([^\]\n]+)\]/g, (_match, id: string, label: string) => {
    let cleanedLabel = label.trim();
    if (cleanedLabel.startsWith('"') && cleanedLabel.endsWith('"')) {
      cleanedLabel = cleanedLabel.slice(1, -1);
    }
    cleanedLabel = cleanedLabel.replace(/"/g, "'");
    return `${id}["${cleanedLabel}"]`;
  });

  return chart;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const cleaned = sanitizeMermaidChart(chart);
        if (!cleaned) {
          if (!cancelled) setSvg('');
          return;
        }

        mermaidLoaded ??= import('mermaid');
        const mermaid = (await mermaidLoaded).default;
        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'var(--font-geist-sans, sans-serif)',
          suppressErrorRendering: true,
        });

        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const { svg: rendered } = await mermaid.render(id, cleaned);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid Mermaid diagram syntax');
          // Clean up any mermaid error elements inserted into body
          const errorSvg = document.getElementById('dmermaid') || document.querySelector('[id^="dmermaid"]');
          errorSvg?.remove();
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
      <div className="my-4 rounded-lg border border-border/40 bg-muted/10 p-3 text-xs text-muted-foreground">
        <div className="font-mono text-[11px] opacity-75">Mermaid syntax error (displaying fallback code block):</div>
        <pre className="mt-1.5 overflow-x-auto rounded bg-muted/30 p-2 font-mono text-[11px] text-foreground/80">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-5 flex justify-center overflow-x-auto rounded-lg border border-border/40 bg-card/60 p-4">
      {svg ? (
        <div className="min-w-0" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-28 w-full animate-pulse rounded bg-muted/30" />
      )}
    </div>
  );
}
