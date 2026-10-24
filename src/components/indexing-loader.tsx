'use client';

import * as React from 'react';
import { cn } from '~/lib/utils';

type IndexingStep =
  | 'LOADING_REPO'
  | 'CHUNKING_AND_EMBEDDING'
  | 'PLANNING_WIKI'
  | 'GENERATING_PAGES'
  | 'FINALIZING'
  | 'DONE';

const STAGE_LABELS: Record<string, string> = {
  LOADING_REPO: 'Connecting to repository…',
  CHUNKING_AND_EMBEDDING: 'Scanning files & symbols…',
  PLANNING_WIKI: 'Analyzing repository architecture…',
  GENERATING_PAGES: 'Generating domain documentation…',
  FINALIZING: 'Finalizing DeepWiki…',
  DONE: 'Wiki generated!',
};

const DEFAULT_INDEXING_STEPS = [
  'Connecting to repository…',
  'Scanning files & symbols…',
  'Analyzing repository architecture…',
  'Generating domain documentation…',
  'Finalizing DeepWiki…',
];

const QUIRKY_QA_STEPS = [
  'Consulting the ancient scrolls of git blame…',
  'Teaching the neural net not to hallucinate APIs…',
  'Untangling the spaghetti code with extra parmesan…',
  'Deciphering variable names from 3 AM commits…',
  'Summoning stack traces from a parallel universe…',
  'Reading between the lines (literally all 40,000 of them)…',
  'Asking the rubber duck for architectural advice…',
  'Brewing premium roast coffee for the embeddings…',
  'Refusing to believe that regex actually passed…',
];

export interface IndexingLoaderProps {
  step?: string | null;
  detail?: string | null;
  mode?: 'indexing' | 'qa' | 'general';
  customText?: string;
  size?: 'default' | 'sm';
  className?: string;
}

export function IndexingLoader({
  step,
  detail,
  mode = 'indexing',
  customText,
  size = 'default',
  className,
}: IndexingLoaderProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Cycling text state when no static step is provided
  const [cycleIndex, setCycleIndex] = React.useState(0);
  const [textVisible, setTextVisible] = React.useState(true);

  const cycleList = React.useMemo(() => {
    return mode === 'qa' ? QUIRKY_QA_STEPS : DEFAULT_INDEXING_STEPS;
  }, [mode]);

  React.useEffect(() => {
    if (customText || detail || step) return;
    const interval = setInterval(() => {
      setTextVisible(false);
      setTimeout(() => {
        setCycleIndex((prev) => (prev + 1) % cycleList.length);
        setTextVisible(true);
      }, 250);
    }, 3200);
    return () => clearInterval(interval);
  }, [customText, detail, step, cycleList.length]);

  const activeText = React.useMemo(() => {
    if (customText) return customText;
    if (detail) return detail;
    if (step) return STAGE_LABELS[step] ?? step.replaceAll('_', ' ').toLowerCase();
    return cycleList[cycleIndex] ?? 'Processing…';
  }, [customText, detail, step, cycleList, cycleIndex]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const CSS_W = size === 'sm' ? 260 : 320;
    const CSS_H = size === 'sm' ? 180 : 230;
    const DPR = window.devicePixelRatio || 1;

    canvas.width = CSS_W * DPR;
    canvas.height = CSS_H * DPR;
    canvas.style.width = `${CSS_W}px`;
    canvas.style.height = `${CSS_H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const N = 6; // grid size (N x N)
    const TILE_W = size === 'sm' ? 21 : 26;
    const TILE_H = size === 'sm' ? 10.5 : 13;
    const LEVEL = size === 'sm' ? 10.5 : 13;
    const MAX_LAYERS = 5;
    const CX = CSS_W / 2;
    const CY = CSS_H / 2 + (size === 'sm' ? 4 : 6);

    const cur: number[][] = [];
    for (let x = 0; x < N; x++) {
      cur.push([]);
      for (let y = 0; y < N; y++) cur[x]!.push(1);
    }

    const PATTERN_DURATION = 3.2;
    const PATTERN_COUNT = 6;

    function targetHeight(x: number, y: number, t: number, pattern: number, seg: number) {
      const cx = (N - 1) / 2;
      const cy = (N - 1) / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const local = t - seg * PATTERN_DURATION;

      switch (pattern) {
        case 0: { // diagonal wave
          const v = Math.sin(t * 2.2 - (x + y) * 0.9);
          return 1 + Math.round((v + 1) * 1.5);
        }
        case 1: { // one column rises and falls
          const col = Math.floor(local * 1.6 + seg * 2) % N;
          const dc = (x - col + N) % N;
          if (dc < 3) return 1 + Math.round((Math.sin(t * 4 - dc * 0.6) + 1) * 2);
          return 1 + ((x + y) % 2);
        }
        case 2: { // one row sweeps
          const row = Math.floor(local * 1.6 + seg) % N;
          const dr = (y - row + N) % N;
          if (dr < 3) return 1 + Math.round((Math.sin(t * 3.5 - dr * 0.6 + x * 0.4) + 1) * 1.8);
          return 1 + (x % 2);
        }
        case 3: { // single cell pulses in order
          const idx = Math.floor(local * 2.2 + seg * 3) % (N * N);
          const ix = idx % N;
          const iy = Math.floor(idx / N);
          const dx = (x - ix + N) % N;
          const dy = (y - iy + N) % N;
          if (dx < 3 && dy < 3) return 1 + Math.round((Math.sin(local * 9 - (dx + dy) * 0.5) + 1) * 2);
          return 1;
        }
        case 4: { // ripple from center
          const v = Math.sin(t * 3 - dist * 1.1);
          return 1 + Math.round((v + 1) * 1.6);
        }
        case 5: { // random-looking stacking that settles
          const v = Math.sin(x * 2.3 + t * 1.7) * Math.cos(y * 1.9 - t * 1.3);
          return 1 + Math.round((v + 1) * 1.8);
        }
        default:
          return 1;
      }
    }

    function project(x: number, y: number, z: number) {
      const gx = x - N / 2;
      const gy = y - N / 2;
      return {
        px: CX + (gx - gy) * TILE_W,
        py: CY + (gx + gy) * TILE_H - z * LEVEL,
      };
    }

    function drawFace(points: Array<{ px: number; py: number }>, color: string, stroke: string) {
      ctx.beginPath();
      ctx.moveTo(points[0]!.px, points[0]!.py);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.px, points[i]!.py);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    function drawBox(x: number, y: number, h: number) {
      // Lighter, vibrant RepoSense blue palette matching hero cube
      const top = '#5a6cff';
      const left = '#384ef2';
      const right = '#253be0';
      const edge = 'rgba(28, 28, 28, 0.45)';

      const p = (dx: number, dy: number, z: number) => project(x + dx, y + dy, z);

      // Left face
      drawFace([p(0, 1, h), p(1, 1, h), p(1, 1, 0), p(0, 1, 0)], left, edge);
      // Right face
      drawFace([p(1, 0, h), p(1, 1, h), p(1, 1, 0), p(1, 0, 0)], right, edge);
      // Top face
      drawFace([p(0, 0, h), p(1, 0, h), p(1, 1, h), p(0, 1, h)], top, edge);
    }

    let lastTime = performance.now();
    let elapsed = 0;
    let animId: number;

    function frame(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      const seg = Math.floor(elapsed / PATTERN_DURATION);
      const pattern = seg % PATTERN_COUNT;

      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const target = Math.min(MAX_LAYERS, targetHeight(x, y, elapsed, pattern, seg));
          cur[x]![y]! += (target - cur[x]![y]!) * Math.min(1, dt * 7);
        }
      }

      ctx.clearRect(0, 0, CSS_W, CSS_H);

      const order: Array<[number, number]> = [];
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) order.push([x, y]);
      }
      order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

      for (const [x, y] of order) {
        drawBox(x, y, cur[x]![y]!);
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame((t) => {
      lastTime = t;
      frame(t);
    });

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [size]);

  return (
    <div className={cn('flex flex-col items-center justify-center gap-6 py-6', className)}>
      <canvas ref={canvasRef} aria-hidden="true" className="block" />
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all duration-300',
          'border bg-[rgba(35,55,255,0.06)] border-[rgba(35,55,255,0.2)] text-[#0b0b0d]'
        )}
      >
        <span
          className="size-1.5 rounded-full animate-pulse bg-[#2337ff]"
        />
        <span
          className="transition-opacity duration-250 ease-in-out"
          style={{ opacity: textVisible ? 1 : 0 }}
        >
          {activeText}
        </span>
      </div>
    </div>
  );
}
