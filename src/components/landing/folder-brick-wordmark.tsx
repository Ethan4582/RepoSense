'use client';

import * as React from 'react';

// Letter matrices (7 rows tall: rows 0-4 for normal lowercase, rows 0-6 for descender 'p')
// 1 = folder brick, 0 = empty space
const LETTERS: Record<string, number[][]> = {
  r: [
    [0, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  e: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  p: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
  ],
  o: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  s: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  n: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
};

const WORD = ['r', 'e', 'p', 'o', 's', 'e', 'n', 's', 'e'];

export function FolderBrickIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? "size-full"}
    >
      <defs>
        <linearGradient id="folderTabGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="folderBodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="35%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#126dfb" />
        </linearGradient>
        <linearGradient id="folderShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Folder Back Tab */}
      <path
        d="M2 4C2 2.89543 2.89543 2 4 2H8.5C9.32843 2 10.0898 2.50734 10.4074 3.27365L10.8 4.2C11.0118 4.71087 11.5193 5.04918 12.0717 5.04918H20C21.1046 5.04918 22 5.94461 22 7.04918V8H2V4Z"
        fill="url(#folderTabGrad)"
      />
      {/* Folder Front Body with 3D Bevel */}
      <rect
        x="1.5"
        y="5.5"
        width="21"
        height="13"
        rx="2.5"
        fill="url(#folderBodyGrad)"
      />
      {/* Top Gloss Highlight */}
      <path
        d="M2 7.5C2 6.39543 2.89543 5.5 4 5.5H20C21.1046 5.5 22 6.39543 22 7.5V11H2V7.5Z"
        fill="url(#folderShine)"
      />
      {/* Subtle Bottom Rim */}
      <line
        x1="3"
        y1="17.5"
        x2="21"
        y2="17.5"
        stroke="#0e58cc"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface BrickData {
  id: string;
  row: number;
  col: number;
}

export function FolderBrickWordmark() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);

  // Build grid bricks
  const { bricks, totalCols, totalRows } = React.useMemo(() => {
    const list: BrickData[] = [];
    let currentCol = 0;
    const numRows = 7;

    WORD.forEach((char, letterIdx) => {
      const grid = LETTERS[char];
      if (!grid) return;
      const letterWidth = grid[0]?.length ?? 4;

      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < letterWidth; c++) {
          if (grid[r]?.[c] === 1) {
            list.push({
              id: `${letterIdx}-${r}-${c}`,
              row: r,
              col: currentCol + c,
            });
          }
        }
      }

      currentCol += letterWidth + 1; // 1 column spacer between letters
    });

    return {
      bricks: list,
      totalCols: currentCol - 1,
      totalRows: numRows,
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div className="relative w-full overflow-hidden select-none py-8">
      <div className="mx-auto max-w-[1180px] px-4 flex items-center justify-between gap-4">
        {/* Left Desktop Trash / Archive Icon using public/dustbin.png */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="relative size-12 sm:size-14 flex items-center justify-center transition-transform hover:scale-105">
            <img
              src="/dustbin.png"
              alt="Trash"
              className="size-full object-contain"
            />
          </div>
          <span className="text-[11px] font-medium text-[#64748b]">Trash</span>
        </div>

        {/* Center Giant Wordmark Grid */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative flex-1 py-4 flex items-center justify-center cursor-crosshair overflow-x-auto"
        >
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
              width: '100%',
              maxWidth: '920px',
              aspectRatio: `${totalCols} / ${totalRows}`,
              gap: '3px',
            }}
          >
            {bricks.map((brick) => {
              // Calculate interactive displacement
              let transformStyle = '';
              if (mousePos && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const brickWidth = rect.width / totalCols;
                const brickHeight = rect.height / totalRows;
                const brickCenterX = (brick.col + 0.5) * brickWidth;
                const brickCenterY = (brick.row + 0.5) * brickHeight;

                const dx = brickCenterX - mousePos.x;
                const dy = brickCenterY - mousePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const radius = 90;

                if (dist < radius && dist > 0) {
                  const factor = (1 - dist / radius);
                  const push = factor * 22;
                  const angle = Math.atan2(dy, dx);
                  const tx = Math.cos(angle) * push;
                  const ty = Math.sin(angle) * push;
                  const rot = (tx * 1.6);
                  const sc = 1 + factor * 0.25;
                  transformStyle = `translate3d(${tx}px, ${ty}px, 0px) rotate(${rot}deg) scale(${sc})`;
                }
              }

              return (
                <div
                  key={brick.id}
                  style={{
                    gridColumnStart: brick.col + 1,
                    gridRowStart: brick.row + 1,
                    transform: transformStyle || undefined,
                    transition: transformStyle ? 'transform 0.08s ease-out' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="size-full flex items-center justify-center drop-shadow-[0_2px_4px_rgba(18,109,251,0.18)]"
                >
                  <FolderBrickIcon className="w-full h-full object-contain" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Standalone 3D Blue Folder Desktop Icon */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 group cursor-pointer">
          <div className="relative size-16 sm:size-20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 drop-shadow-[0_12px_24px_rgba(18,109,251,0.25)]">
            <FolderBrickIcon className="size-full" />
          </div>
          <span className="text-[11px] font-medium text-[#64748b] group-hover:text-[#126dfb] transition-colors">
            RepoSense
          </span>
        </div>
      </div>
    </div>
  );
}
