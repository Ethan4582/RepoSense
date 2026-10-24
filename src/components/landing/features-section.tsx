'use client';

import * as React from 'react';
import { cn } from '~/lib/utils';

// Faint isometric background pattern
function IsometricPattern() {
  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none opacity-40 group-hover:opacity-65 transition-opacity duration-300"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <defs>
        <pattern
          id="feat-iso-grid"
          width="40"
          height="23.094"
          patternUnits="userSpaceOnUse"
        >
          {/* 30-degree isometric grid lines */}
          <path
            d="M0 11.547 L20 0 L40 11.547 L20 23.094 Z"
            fill="none"
            stroke="#d4d4d8"
            strokeWidth="0.75"
            strokeDasharray="1.5 2.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#feat-iso-grid)" />
    </svg>
  );
}

// Visual 1: Versioned codebase wikis (isometric stacked layers with top layer floating)
function VisualVersions() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 3 - Bottom V12 */}
        <g opacity="0.35">
          <path
            d="M60 118 L140 76 L220 118 L140 160 Z"
            fill="#ffffff"
            stroke="#18181b"
            strokeWidth="1.25"
          />
          <path d="M60 118 L60 124 L140 166 L220 124 L220 118" stroke="#18181b" strokeWidth="1.25" />
          <path d="M140 160 L140 166" stroke="#18181b" strokeWidth="1.25" />
        </g>
        <text x="232" y="126" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          V12
        </text>

        {/* Layer 2 - Middle V13 */}
        <g opacity="0.6">
          <path
            d="M60 92 L140 50 L220 92 L140 134 Z"
            fill="#ffffff"
            stroke="#18181b"
            strokeWidth="1.25"
          />
          <path d="M60 92 L60 98 L140 140 L220 98 L220 92" stroke="#18181b" strokeWidth="1.25" />
          <path d="M140 134 L140 140" stroke="#18181b" strokeWidth="1.25" />
        </g>
        <text x="232" y="100" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          V13
        </text>

        {/* Layer 1 - Top Live V14 (Blue Highlighted & Floating) */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            {/* 3D Slab Thickness */}
            <path
              d="M60 62 L60 70 L140 112 L220 70 L220 62 Z"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.3"
            />
            {/* Top Plane */}
            <path
              d="M60 62 L140 20 L220 62 L140 104 Z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.3"
            />
            {/* Center crease line */}
            <path d="M140 104 L140 112" stroke="#000000" strokeWidth="1.3" />
            <text x="232" y="68" className="fill-[#0b0b0d] font-mono text-[9px] font-semibold tracking-wider select-none">
              V14 · LIVE
            </text>
            <line x1="222" y1="65" x2="228" y2="65" stroke="#8d8d95" strokeWidth="0.75" strokeDasharray="1 2" />
          </g>
        </g>
      </svg>
    </div>
  );
}

// Visual 2: Traced, line-numbered answers (chain of blocks with highlighted blue block)
function VisualTrace() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Block helper path macro */}
        {/* Sequence of snake blocks in isometric projection */}
        {/* Background inactive blocks */}
        {[
          { x: 145, y: 35 },
          { x: 165, y: 45 },
          { x: 185, y: 55 },
          { x: 175, y: 70 },
          { x: 165, y: 85 },
          { x: 145, y: 95 },
          { x: 125, y: 105 },
          { x: 105, y: 95 },
        ].map((pt, i) => (
          <g key={i} opacity="0.85">
            <path
              d={`M${pt.x} ${pt.y} l12 -6 l12 6 l-12 6 z`}
              fill="#ffffff"
              stroke="#18181b"
              strokeWidth="1.1"
            />
            <path
              d={`M${pt.x} ${pt.y} v5 l12 6 l12 -6 v-5`}
              stroke="#18181b"
              strokeWidth="1.1"
            />
            <path d={`M${pt.x + 12} ${pt.y + 6} v5`} stroke="#18181b" strokeWidth="1.1" />
          </g>
        ))}

        {/* Highlighted active blue block */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            <path
              d="M135 72 l15 -8 l15 8 l-15 8 z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path
              d="M135 72 v12 l15 8 l15 -8 v-12"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path d="M150 80 v12" stroke="#000000" strokeWidth="1.25" />
          </g>
        </g>

        {/* Label */}
        <text x="56" y="112" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          14 BLOCKS · 2.4 S
        </text>
        <line x1="108" y1="109" x2="130" y2="88" stroke="#8d8d95" strokeWidth="0.75" strokeDasharray="1.5 2" />
      </svg>
    </div>
  );
}

// Visual 3: Agents with spend limits (cube inside dashed bounding cage)
function VisualCage() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dashed outer isometric bounding cube cage */}
        <g stroke="#71717a" strokeWidth="1" strokeDasharray="3 3">
          {/* Top diamond */}
          <path d="M140 22 L200 52 L140 82 L80 52 Z" />
          {/* 3 Vertical pillars */}
          <line x1="80" y1="52" x2="80" y2="112" />
          <line x1="140" y1="82" x2="140" y2="142" />
          <line x1="200" y1="52" x2="200" y2="112" />
          {/* Bottom edges */}
          <path d="M80 112 L140 142 L200 112" />
        </g>

        {/* Limit label at top right */}
        <text x="206" y="46" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          LIMIT · $40
        </text>
        <line x1="200" y1="52" x2="204" y2="48" stroke="#8d8d95" strokeWidth="0.75" />

        {/* Central blue agent cube */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            {/* Top face */}
            <path
              d="M140 56 L168 70 L140 84 L112 70 Z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            {/* Left face */}
            <path
              d="M112 70 L140 84 L140 114 L112 100 Z"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.25"
            />
            {/* Right face */}
            <path
              d="M140 84 L168 70 L168 100 L140 114 Z"
              fill="#0d1b94"
              stroke="#000000"
              strokeWidth="1.25"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

// Visual 4: Approvals in Slack (agent block -> route -> checkmark approval node)
function VisualApproval() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Agent Node (left white block) */}
        <g>
          <path
            d="M80 84 L108 70 L136 84 L108 98 Z"
            fill="#ffffff"
            stroke="#18181b"
            strokeWidth="1.25"
          />
          <path
            d="M80 84 V104 L108 118 L136 104 V84"
            fill="#f4f4f5"
            stroke="#18181b"
            strokeWidth="1.25"
          />
          <path d="M108 98 V118" stroke="#18181b" strokeWidth="1.25" />
          <text x="96" y="62" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
            AGENT
          </text>
          <line x1="108" y1="66" x2="108" y2="70" stroke="#8d8d95" strokeWidth="0.75" />
        </g>

        {/* Small connector step */}
        <g opacity="0.6">
          <path
            d="M138 106 L146 102 L154 106 L146 110 Z"
            fill="#ffffff"
            stroke="#18181b"
            strokeWidth="1"
          />
        </g>

        {/* Approval Target Node (Right Blue block with floating Check Chip) */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            {/* Top face */}
            <path
              d="M160 102 L188 88 L216 102 L188 116 Z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            {/* Left face */}
            <path
              d="M160 102 V124 L188 138 L216 124 V102"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path d="M188 116 V138" stroke="#000000" strokeWidth="1.25" />

            {/* Floating Approval Tag / Checkmark Chip */}
            <rect
              x="172"
              y="58"
              width="18"
              height="18"
              rx="3"
              fill="#ffffff"
              stroke="#18181b"
              strokeWidth="1.2"
            />
            <path
              d="M176 67 L179 70 L186 63"
              stroke="#2337ff"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x="195" y="71" className="fill-[#47474e] font-mono text-[9px] font-medium tracking-wider select-none">
              APPROVED · 4 MIN
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

// Visual 5: Replay before you publish (bar stack comparing draft vs production)
function VisualReplay() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Baseline isometric grid floor guide */}
        <line x1="90" y1="130" x2="210" y2="70" stroke="#d4d4d8" strokeWidth="0.75" strokeDasharray="2 2" />

        {/* Back row: White production bars */}
        {[
          { x: 120, h: 40, yBase: 90 },
          { x: 138, h: 52, yBase: 81 },
          { x: 156, h: 62, yBase: 72 },
          { x: 174, h: 48, yBase: 63 },
          { x: 192, h: 36, yBase: 54 },
        ].map((bar, i) => (
          <g key={i} opacity="0.45">
            <path
              d={`M${bar.x} ${bar.yBase - bar.h} l10 -5 l10 5 l-10 5 z`}
              fill="#ffffff"
              stroke="#18181b"
              strokeWidth="1"
            />
            <path
              d={`M${bar.x} ${bar.yBase - bar.h} v${bar.h} l10 5 l10 -5 v-${bar.h}`}
              fill="#f4f4f5"
              stroke="#18181b"
              strokeWidth="1"
            />
            <path d={`M${bar.x + 10} ${bar.yBase - bar.h + 5} v${bar.h}`} stroke="#18181b" strokeWidth="1" />
          </g>
        ))}

        {/* Front row: Draft bars with one prominent floating blue bar */}
        {[
          { x: 100, h: 38, yBase: 112, isBlue: false },
          { x: 118, h: 54, yBase: 103, isBlue: false },
          { x: 136, h: 66, yBase: 94, isBlue: true },
          { x: 154, h: 50, yBase: 85, isBlue: false },
          { x: 172, h: 32, yBase: 76, isBlue: false },
        ].map((bar, i) =>
          bar.isBlue ? (
            <g key={i} className="transition-transform duration-300 group-hover:-translate-y-1">
              <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
                <path
                  d={`M${bar.x} ${bar.yBase - bar.h} l10 -5 l10 5 l-10 5 z`}
                  fill="#2337ff"
                  stroke="#000000"
                  strokeWidth="1.25"
                />
                <path
                  d={`M${bar.x} ${bar.yBase - bar.h} v${bar.h} l10 5 l10 -5 v-${bar.h}`}
                  fill="#1827b6"
                  stroke="#000000"
                  strokeWidth="1.25"
                />
                <path d={`M${bar.x + 10} ${bar.yBase - bar.h + 5} v${bar.h}`} stroke="#000000" strokeWidth="1.25" />
              </g>
            </g>
          ) : (
            <g key={i}>
              <path
                d={`M${bar.x} ${bar.yBase - bar.h} l10 -5 l10 5 l-10 5 z`}
                fill="#ffffff"
                stroke="#18181b"
                strokeWidth="1.1"
              />
              <path
                d={`M${bar.x} ${bar.yBase - bar.h} v${bar.h} l10 5 l10 -5 v-${bar.h}`}
                fill="#ffffff"
                stroke="#18181b"
                strokeWidth="1.1"
              />
              <path d={`M${bar.x + 10} ${bar.yBase - bar.h + 5} v${bar.h}`} stroke="#18181b" strokeWidth="1.1" />
            </g>
          )
        )}

        <text x="200" y="104" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          PROD
        </text>
        <text x="180" y="128" className="fill-[#47474e] font-mono text-[9px] font-semibold tracking-wider select-none">
          DRAFT
        </text>
      </svg>
    </div>
  );
}

// Visual 6: Your data stays put (isometric mesh grid with localized blue nodes)
function VisualRegions() {
  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 280 160"
        className="w-[240px] h-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Isometric base grid matrix (5x5 tiles) */}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const originX = 140;
            const originY = 40;
            const x = originX + (col - row) * 16;
            const y = originY + (col + row) * 9.2;
            const isHighlighted1 = row === 3 && col === 0; // EU region node
            const isHighlighted2 = row === 0 && col === 3; // APAC node

            if (isHighlighted1 || isHighlighted2) return null;

            return (
              <g key={`${row}-${col}`}>
                <path
                  d={`M${x} ${y} l14 -8 l14 8 l-14 8 z`}
                  fill="#ffffff"
                  stroke="#18181b"
                  strokeWidth="0.85"
                />
                <path
                  d={`M${x} ${y} v3 l14 8 l14 -8 v-3`}
                  stroke="#18181b"
                  strokeWidth="0.85"
                />
              </g>
            );
          })
        )}

        {/* Highlighted node 1 (EU-Central) */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            {/* x = 140 - 48 = 92, y = 40 + 27.6 = 67.6 */}
            <path
              d="M92 68 l14 -8 l14 8 l-14 8 z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path
              d="M92 68 v10 l14 8 l14 -8 v-10"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path d="M106 76 v10" stroke="#000000" strokeWidth="1.25" />
          </g>
        </g>

        {/* Highlighted node 2 (US / APAC) */}
        <g className="transition-transform duration-300 group-hover:-translate-y-1">
          <g className="motion-safe:animate-[featFloat_4s_ease-in-out_infinite] group-hover:motion-safe:animate-[featFloat_3s_ease-in-out_infinite]">
            {/* x = 140 + 48 = 188, y = 40 + 27.6 = 67.6 */}
            <path
              d="M188 42 l14 -8 l14 8 l-14 8 z"
              fill="#2337ff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path
              d="M188 42 v10 l14 8 l14 -8 v-10"
              fill="#1827b6"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <path d="M202 50 v10" stroke="#000000" strokeWidth="1.25" />
          </g>
        </g>

        <text x="100" y="132" className="fill-[#8d8d95] font-mono text-[9px] tracking-wider select-none">
          EU-CENTRAL · FRANKFURT
        </text>
      </svg>
    </div>
  );
}

export type FeatureVariant =
  | 'versions'
  | 'trace'
  | 'cage'
  | 'approval'
  | 'replay'
  | 'regions';

export function FeatureVisual({ variant }: { variant: FeatureVariant }) {
  return (
    <div className="relative w-full h-[174px] bg-[#f5f5f3] overflow-hidden flex items-center justify-center">
      <IsometricPattern />
      {variant === 'versions' && <VisualVersions />}
      {variant === 'trace' && <VisualTrace />}
      {variant === 'cage' && <VisualCage />}
      {variant === 'approval' && <VisualApproval />}
      {variant === 'replay' && <VisualReplay />}
      {variant === 'regions' && <VisualRegions />}
    </div>
  );
}

interface FeatureItem {
  variant: FeatureVariant;
  title: string;
  body: string;
  caption: string;
}

const FEATURES: FeatureItem[] = [
  {
    variant: 'versions',
    title: 'Versioned codebase wikis',
    body: 'Every indexed wiki keeps its history. Diff two versions, see what changed in each file, and roll back in one click.',
    caption: 'V14 · LIVE · 3 REVIEWERS',
  },
  {
    variant: 'trace',
    title: 'Traced, line-numbered answers',
    body: 'Ask a question and follow each answer through the files, functions, and line numbers it came from.',
    caption: '30-DAY TRACES ON TEAM',
  },
  {
    variant: 'cage',
    title: 'Agents with spend limits',
    body: 'Agents run inside the spend, tool, and data limits you set. Anything outside those limits pauses and asks a person.',
    caption: '$40 / RUN CAP',
  },
  {
    variant: 'approval',
    title: 'Approvals in Slack',
    body: 'Route sensitive steps to a teammate. They approve from Slack or email, and the run picks up where it paused.',
    caption: 'MEDIAN APPROVAL 4 MIN',
  },
  {
    variant: 'replay',
    title: 'Replay before you publish',
    body: "Run a draft against last week's real repository changes and compare its output with production before anything goes live.",
    caption: '7 DAYS OF REPLAY',
  },
  {
    variant: 'regions',
    title: 'Your data stays put',
    body: 'Pin your workspace to the EU, US, or APAC. Indexing and queries run in that region, and your code never leaves it.',
    caption: '12 REGIONS · 3 JURISDICTIONS',
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col"
    >
      <div className="relative border-x border-[#d4d4d8] px-6 sm:px-[64px] pt-16 pb-20">
        
        {/* Section Header: 2-column layout (Left ~50% / Right ~50%) */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 pb-[100px]">
          {/* Left Column: Blue cube icon + FEATURES label */}
          <div className="flex items-center gap-2 pt-2 md:w-1/2">
            {/* Small blue isometric cube icon */}
            <svg
              width="14"
              height="16"
              viewBox="0 0 14 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M7 1 L13 4.5 L7 8 L1 4.5 Z" fill="#2337ff" stroke="#000000" strokeWidth="0.8" />
              <path d="M1 4.5 V11.5 L7 15 V8 Z" fill="#1827b6" stroke="#000000" strokeWidth="0.8" />
              <path d="M13 4.5 V11.5 L7 15 V8 Z" fill="#0d1b94" stroke="#000000" strokeWidth="0.8" />
            </svg>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#47474e]">
              FEATURES
            </span>
          </div>

          {/* Right Column: H2 in Fraunces, weight 360 + Subtitle in Inter Tight */}
          <div className="flex flex-col md:w-1/2 max-w-[620px]">
            <h2 className="font-serif text-[42px] sm:text-[54px] lg:text-[66px] font-[360] leading-[1.0] tracking-[-1.98px] text-[#000000]">
              Built for the day something breaks.
            </h2>
            <p className="mt-5 font-sans text-[19px] leading-[1.5] text-[#47474e] max-w-[420px]">
              Automation is easy to start and hard to trust. These are the parts that make RepoSense safe to run across your codebase, your agents, and your team.
            </p>
          </div>
        </div>

        {/* 3x2 Card Grid with shared 1px #ececec border */}
        <div className="w-full border border-[#ececec] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 -space-y-px md:space-y-0">
          {FEATURES.map((item, idx) => {
            // Compute shared border classes so grid shares 1px lines without double thickness
            const isRightCol = (idx + 1) % 3 === 0;
            const isBottomRow = idx >= 3;

            return (
              <div
                key={item.variant}
                className={cn(
                  'group flex flex-col bg-white transition-colors duration-200',
                  'border-b border-[#ececec] lg:border-b-0',
                  !isBottomRow && 'lg:border-b lg:border-[#ececec]',
                  'md:border-r md:border-[#ececec]',
                  isRightCol && 'lg:border-r-0',
                  idx % 2 === 1 && 'md:border-r-0 lg:border-r lg:border-[#ececec]'
                )}
              >
                {/* Visual Image Area (height ~174px, faint isometric pattern) */}
                <FeatureVisual variant={item.variant} />

                {/* Content Area with 24px padding */}
                <div className="p-6 flex flex-col flex-1 justify-between bg-white">
                  <div>
                    {/* Title: Fraunces 24px, weight 360 */}
                    <h3 className="font-serif text-[24px] font-[360] leading-[1.18] tracking-[-0.02em] text-[#0b0b0d]">
                      {item.title}
                    </h3>

                    {/* Body: Inter Tight 15px, line-height 1.5, charcoal */}
                    <p className="mt-2.5 font-sans text-[15px] leading-[1.5] text-[#47474e]">
                      {item.body}
                    </p>
                  </div>

                  {/* Caption: Martian Mono 9-10px uppercase in light-slate-gray */}
                  <div className="mt-7 pt-3 border-t border-[#f0f0f2]">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#8d8d95]">
                      {item.caption}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
