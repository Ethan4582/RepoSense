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

export function FolderBrickIcon({
  isOpen = false,
  className,
}: {
  isOpen?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? 'relative size-full flex items-center justify-center'}>
      {isOpen ? (
        <img
          src="/open-folder.png"
          alt="Folder Open"
          className="size-full object-contain pointer-events-none select-none"
        />
      ) : (
        <img
          src="/close-folder.png"
          alt="Folder Closed"
          className="size-full object-contain pointer-events-none select-none"
        />
      )}
    </div>
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
              maxWidth: '1020px',
              aspectRatio: `${totalCols} / ${totalRows}`,
              gap: '4px',
            }}
          >
            {bricks.map((brick) => {
              let isHovered = false;
              if (mousePos && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const brickWidth = rect.width / totalCols;
                const brickHeight = rect.height / totalRows;
                const brickCenterX = (brick.col + 0.5) * brickWidth;
                const brickCenterY = (brick.row + 0.5) * brickHeight;

                const dx = brickCenterX - mousePos.x;
                const dy = brickCenterY - mousePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const radius = 64;

                isHovered = dist < radius;
              }

              return (
                <div
                  key={brick.id}
                  style={{
                    gridColumnStart: brick.col + 1,
                    gridRowStart: brick.row + 1,
                  }}
                  className="size-full flex items-center justify-center p-[1px]"
                >
                  <FolderBrickIcon
                    isOpen={isHovered}
                    className="w-full h-full object-contain transition-transform duration-150 ease-out hover:scale-110"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Standalone 3D Folder Desktop Icon with Open/Close on Hover */}
        <div className="hidden sm:flex flex-col items-center gap-2 group cursor-pointer select-none">
          <div className="relative size-16 sm:size-20 flex items-center justify-center">
            {/* Closed Folder (Default) */}
            <img
              src="/close-folder.png"
              alt="Folder"
              className="size-full object-contain block group-hover:hidden"
            />
            {/* Open Folder (On Hover) */}
            <img
              src="/open-folder.png"
              alt="Folder Open"
              className="size-full object-contain hidden group-hover:block"
            />
          </div>
          <span className="text-[13px] sm:text-[14px] font-semibold text-[#334155] group-hover:text-[#126dfb] transition-colors tracking-tight">
            RepoSense
          </span>
        </div>
      </div>
    </div>
  );
}
