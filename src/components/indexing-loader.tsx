'use client';

import * as React from 'react';

type IndexingStep = 'LOADING_REPO' | 'CHUNKING_AND_EMBEDDING' | 'PLANNING_WIKI' | 'GENERATING_PAGES' | 'FINALIZING' | 'DONE';

const STAGE_LABELS: Record<IndexingStep, string> = {
  LOADING_REPO: 'Connecting to repository',
  CHUNKING_AND_EMBEDDING: 'Scanning files',
  PLANNING_WIKI: 'Analyzing code',
  GENERATING_PAGES: 'Generating wiki',
  FINALIZING: 'Finalizing wiki',
  DONE: 'Wiki generated',
};

export function IndexingLoader({ step }: { step?: string | null }) {
  const label = STAGE_LABELS[(step as IndexingStep) ?? 'LOADING_REPO'] ?? 'Processing repository';
  const cubes = React.useMemo(
    () => Array.from({ length: 25 }, (_, index) => ({
      index,
      x: index % 5,
      y: Math.floor(index / 5),
      height: 1 + ((index * 7 + Math.floor(index / 5)) % 3),
      delay: `${(index % 5) * 0.18 + Math.floor(index / 5) * 0.08}s`,
    })),
    []
  );

  return (
    <div className="flex min-h-[18rem] w-full flex-col items-center justify-center bg-background px-6 py-12">
      <div className="indexing-cube-scene" aria-hidden="true">
        <div className="indexing-cube-grid">
          {cubes.map((cube) => (
            <div
              key={cube.index}
              className="indexing-cube-column"
              style={{
                '--cube-x': cube.x,
                '--cube-y': cube.y,
                '--cube-height': cube.height,
                '--cube-delay': cube.delay,
              } as React.CSSProperties}
            >
              {Array.from({ length: cube.height }, (_, level) => (
                <span key={level} className="indexing-cube" style={{ '--cube-level': level } as React.CSSProperties}>
                  <i /><b /><em />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-8 text-sm font-medium text-muted-foreground" aria-live="polite">{label}…</p>
    </div>
  );
}
