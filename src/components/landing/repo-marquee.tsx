'use client';

import * as React from 'react';

const POPULAR_REPOS = [
  'freeCodeCamp/freeCodeCamp',
  'sindresorhus/awesome',
  'EbookFoundation/free-programming-books',
  'facebook/react',
  'tensorflow/tensorflow',
  'twbs/bootstrap',
  'vinta/awesome-python',
  'torvalds/linux',
  'ohmyzsh/ohmyzsh',
  'flutter/flutter',
  'microsoft/vscode',
  'vercel/next.js',
  'shadcn/ui',
];

interface RepoMarqueeProps {
  wikiCount?: string;
}

export function RepoMarquee({ wikiCount = '1,300+' }: RepoMarqueeProps) {
  return (
    <section className="relative w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col">
      <div className="relative border-x border-[#d4d4d4] px-6 sm:px-[64px] py-3 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 overflow-hidden">
        {/* Left Label */}
        <div className="shrink-0 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.05em] text-[#8d8d95] leading-tight select-none">
          <div>INDEXED WIKIS</div>
          <div className="text-[#0b0b0d] font-semibold">{wikiCount} REPOSITORIES</div>
        </div>

        {/* Marquee Banner that stops on hover */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          }}
        >
          <div className="flex items-center gap-8 w-max animate-[marquee_45s_linear_infinite] hover:[animation-play-state:paused] cursor-default">
            {[...POPULAR_REPOS, ...POPULAR_REPOS].map((repo, idx) => (
              <div
                key={`${repo}-${idx}`}
                className="font-mono text-[13px] sm:text-[14px] font-medium tracking-tight text-[#47474e] hover:text-[#0b0b0d] transition-colors whitespace-nowrap"
              >
                {repo}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
