'use client';

import * as React from 'react';

const N = 4;                 // footprint size (N x N)
const L = 4;                 // number of layers
const BLUE_LAYER = 2;        // layer index that carries accent cubes
const BREATH_PERIOD = 6;     // seconds for one full inhale/exhale
const GAP_MIN = 0.04;        // resting gap (in cube units)
const GAP_MAX = 0.16;        // maximum breathing gap
const INTRO_DURATION = 0.9;  // seconds for each cube to settle
const DROP_HEIGHT = 14;      // starting height (in cube units) for intro fall

const UW = Math.cos(Math.PI / 6); // isometric horizontal factor
const UH = 0.5;                   // isometric depth factor

const COLORS = {
  white: { top: '#f3f3f1', left: '#e7e7e4', right: '#dadad6' },
  blue:  { top: '#5a6cff', left: '#2a3df2', right: '#1b2bd1' }
};
const STROKE = '#1c1c1c';
const FLOOR_STROKE = '#9a9a9a';

const LAYER_LABELS = [
  { text: '04 WIKI PAGES',          k: 3, blue: false },
  { text: '03 CODEBASE Q&A',        k: 2, blue: true },
  { text: '02 CITATION TRACING',    k: 1, blue: false },
  { text: '01 GITHUB REPO', k: 0, blue: false }
];

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cube {
  i: number;
  j: number;
  k: number;
  blue: boolean;
  delay: number;
  startDrop: number;
}

export function IsometricCubeField({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let hovered = false;
    let hoverProgress = 0;
    const rand = mulberry32(42);

    const cubes: Cube[] = [];
    for (let k = 0; k < L; k++) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const baseLayerDelay = k * 0.42;
          const cellJitter = rand() * 0.45;
          const randomHeightOffset = (rand() - 0.5) * 5.5;

          cubes.push({
            i,
            j,
            k,
            blue: k === BLUE_LAYER,
            delay: baseLayerDelay + cellJitter,
            startDrop: DROP_HEIGHT + randomHeightOffset
          });
        }
      }
    }

    const drawOrder = cubes.slice().sort((a, b) => {
      const depthA = (a.i + a.j) + a.k * 0.001;
      const depthB = (b.i + b.j) + b.k * 0.001;
      return depthA - depthB;
    });

    let width = 0;
    let height = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const onPointerEnter = () => { hovered = true; };
    const onPointerLeave = () => { hovered = false; };
    const onPointerMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width * 0.40;
      const cy = rect.height / 2;
      const dist = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy);
      hovered = dist < Math.min(rect.width, rect.height) * 0.46;
    };

    canvas.addEventListener('mouseenter', onPointerEnter);
    canvas.addEventListener('mouseleave', onPointerLeave);
    canvas.addEventListener('mousemove', onPointerMove);

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
    }

    function project(x: number, y: number, z: number, size: number) {
      const isoX = (x - y) * UW * size;
      const isoY = (x + y) * UH * size - z * size;
      // === CUBE POSITION CONFIGURATION ===
      // Adjust width multiplier (e.g. 0.50 -> 0.52 to move further right)
      // Adjust vertical pixel offset (+40 -> +50 to move further down)
      const centerX = width * 0.50;
      const centerY = height / 2 + 42;
      return { x: centerX + isoX, y: centerY + isoY };
    }

    function drawCube(x: number, y: number, z: number, size: number, palette: { top: string; left: string; right: string }) {
      const p0 = project(x, y, z + 1, size);
      const p1 = project(x + 1, y, z + 1, size);
      const p2 = project(x + 1, y + 1, z + 1, size);
      const p3 = project(x, y + 1, z + 1, size);

      const b1 = project(x + 1, y, z, size);
      const b2 = project(x + 1, y + 1, z, size);
      const b3 = project(x, y + 1, z, size);

      ctx!.lineWidth = 1;
      ctx!.strokeStyle = STROKE;
      ctx!.lineJoin = 'round';

      // Top face
      ctx!.fillStyle = palette.top;
      ctx!.beginPath();
      ctx!.moveTo(p0.x, p0.y);
      ctx!.lineTo(p1.x, p1.y);
      ctx!.lineTo(p2.x, p2.y);
      ctx!.lineTo(p3.x, p3.y);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();

      // Left face
      ctx!.fillStyle = palette.left;
      ctx!.beginPath();
      ctx!.moveTo(p3.x, p3.y);
      ctx!.lineTo(p2.x, p2.y);
      ctx!.lineTo(b2.x, b2.y);
      ctx!.lineTo(b3.x, b3.y);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();

      // Right face
      ctx!.fillStyle = palette.right;
      ctx!.beginPath();
      ctx!.moveTo(p1.x, p1.y);
      ctx!.lineTo(p2.x, p2.y);
      ctx!.lineTo(b2.x, b2.y);
      ctx!.lineTo(b1.x, b1.y);
      ctx!.closePath();
      ctx!.fill();
      ctx!.stroke();
    }

    function drawFloorBoundary(baseSize: number, currentGap: number, time: number, hoverProg: number) {
      const pad = 0.55 + hoverProg * 0.35;
      const halfExtent = (N / 2) * (1 + currentGap) + pad;
      const zFloor = -0.12;

      const corner1 = project(-halfExtent, -halfExtent, zFloor, baseSize);
      const corner2 = project(halfExtent, -halfExtent, zFloor, baseSize);
      const corner3 = project(halfExtent, halfExtent, zFloor, baseSize);
      const corner4 = project(-halfExtent, halfExtent, zFloor, baseSize);

      ctx!.save();
      ctx!.strokeStyle = FLOOR_STROKE;
      ctx!.lineWidth = 1.25;
      const breathPhase = (time * 2 * Math.PI) / BREATH_PERIOD;
      const dashOffset = Math.sin(breathPhase) * 28;
      ctx!.setLineDash([4, 4]);
      ctx!.lineDashOffset = dashOffset;

      ctx!.beginPath();
      ctx!.moveTo(corner1.x, corner1.y);
      ctx!.lineTo(corner2.x, corner2.y);
      ctx!.lineTo(corner3.x, corner3.y);
      ctx!.lineTo(corner4.x, corner4.y);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }

    function drawLayerLabels(baseSize: number, currentGap: number, zGapExtra: number, hoverProg: number) {
      if (hoverProg < 0.05) return;

      ctx!.save();
      ctx!.globalAlpha = Math.min(1, (hoverProg - 0.05) * 1.5);
      ctx!.font = '500 11px "Martian Mono", monospace';

      const centerOffset = (N - 1) / 2;
      // The right-most tip of the layer sits at cube (i=N-1, j=0) right corner (p1 / b1 in project coordinates)
      const rightCubeX = (N - 1 - centerOffset) * (1 + currentGap);
      const rightCubeY = (0 - centerOffset) * (1 + currentGap);

      for (const label of LAYER_LABELS) {
        // Vertical midpoint of the layer
        const zPos = label.k * (1 + currentGap + zGapExtra) + 0.5;
        // p1 on the right edge is at (x+1, y)
        const edgePoint = project(rightCubeX + 1, rightCubeY, zPos, baseSize);

        const textWidth = ctx!.measureText(label.text).width;
        const boxWidth = textWidth + 18;
        const boxHeight = 22;

        // Position chip to the right of the cube edge, ensuring full visibility inside canvas
        const minGap = 28;
        const chipLeftX = Math.min(
          Math.max(edgePoint.x + minGap, width - boxWidth - 12),
          width - boxWidth - 8
        );
        const textY = edgePoint.y;
        const boxX = chipLeftX;
        const boxY = textY - boxHeight / 2;

        const isBlue = label.blue;
        const lineCol = isBlue ? '#2337ff' : '#c8c8cc';
        const textCol = isBlue ? '#2337ff' : '#0b0b0d';
        const borderCol = isBlue ? '#2337ff' : '#ececec';
        const bgCol = isBlue ? '#ffffff' : '#ffffff';

        // Continuous 1px connector line with no gap at either end
        ctx!.strokeStyle = lineCol;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(edgePoint.x, edgePoint.y);
        ctx!.lineTo(chipLeftX, edgePoint.y);
        ctx!.stroke();

        // Label Chip
        ctx!.fillStyle = bgCol;
        ctx!.strokeStyle = borderCol;
        ctx!.beginPath();
        ctx!.rect(boxX, boxY, boxWidth, boxHeight);
        ctx!.fill();
        ctx!.stroke();

        ctx!.fillStyle = textCol;
        ctx!.textBaseline = 'middle';
        ctx!.fillText(label.text, boxX + 9, textY);
      }
      ctx!.restore();
    }

    const startTime = performance.now();

    function render(now: number) {
      if (!canvas || !ctx) return;
      if (width === 0 || height === 0) resize();

      const time = (now - startTime) / 1000;

      const targetHover = hovered ? 1 : 0;
      hoverProgress += (targetHover - hoverProgress) * 0.08;

      const breathT = 0.5 + 0.5 * Math.sin((time * 2 * Math.PI) / BREATH_PERIOD);
      const restingGap = GAP_MIN + (GAP_MAX - GAP_MIN) * breathT;
      // Hover expansion: ~12% overall scale growth, layer gap expands ~1.5x
      const currentGap = restingGap * (1 + hoverProgress * 0.5);
      const zGapExtra = hoverProgress * 0.32;
      const baseScale = 1 + hoverProgress * 0.12;
      const baseSize = (Math.min(width, height) / (N * 3.7)) * baseScale;

      ctx.clearRect(0, 0, width, height);

      const centerOffset = (N - 1) / 2;

      drawFloorBoundary(baseSize, currentGap, time, hoverProgress);

      for (const cube of drawOrder) {
        const introT = easeOutCubic((time - cube.delay) / INTRO_DURATION);
        const dropOffset = (1 - introT) * cube.startDrop;

        const posX = (cube.i - centerOffset) * (1 + currentGap);
        const posY = (cube.j - centerOffset) * (1 + currentGap);
        const posZ = cube.k * (1 + currentGap + zGapExtra) + dropOffset;

        const palette = cube.blue ? COLORS.blue : COLORS.white;
        drawCube(posX, posY, posZ, baseSize, palette);
      }

      drawLayerLabels(baseSize, currentGap, zGapExtra, hoverProgress);

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mouseenter', onPointerEnter);
      canvas.removeEventListener('mouseleave', onPointerLeave);
      canvas.removeEventListener('mousemove', onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full cursor-pointer select-none ${className ?? ''}`}
      style={{ touchAction: 'none' }}
    />
  );
}
