'use client';

import * as React from 'react';
import Link from 'next/link';
import { FolderBrickWordmark } from '~/components/landing/folder-brick-wordmark';

interface SystemLatency {
  region: 'FRA' | 'IAD' | 'SIN';
  ms: number;
  min: number;
  max: number;
}

export function LandingFooterSections() {
  const [latencies, setLatencies] = React.useState<SystemLatency[]>([
    { region: 'FRA', ms: 38, min: 30, max: 50 },
    { region: 'IAD', ms: 36, min: 28, max: 45 },
    { region: 'SIN', ms: 49, min: 40, max: 60 },
  ]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setLatencies((prev) =>
        prev.map((item) => {
          const delta = Math.floor(Math.random() * 5) - 2;
          const nextVal = Math.min(Math.max(item.ms + delta, item.min), item.max);
          return { ...item, ms: nextVal };
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col bg-white">
      <div className="relative border-x border-[#d4d4d4] border-t border-[#ececec]">
        {/* Top Grid: A1, C1, D1, E1, F1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 border-b border-[#ececec]">
          {/* Cell A1 (brand + newsletter): 4 cols */}
          <div className="relative p-6 sm:p-8 lg:col-span-4 border-b md:border-b-0 lg:border-r border-[#ececec] flex flex-col justify-between">
            <span className="absolute top-4 right-4 font-mono text-[10px] text-[#8d8d95] select-none">
              A1
            </span>

            <div>
              {/* Brand mark + wordmark in Fraunces 24px */}
              <div className="flex items-center gap-2.5 mb-6">
                <svg
                  width="18"
                  height="20"
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
                <span
                  style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                  className="text-[24px] font-normal tracking-tight text-[#0b0b0d]"
                >
                  RepoSense
                </span>
              </div>

              {/* Headline in Fraunces 28px */}
              <h3
                style={{ fontFamily: 'Fraunces, Georgia, serif' }}
                className="text-[26px] sm:text-[28px] font-normal leading-[1.18] text-[#0b0b0d] mb-8"
              >
                One email a month.<br />
                Only what shipped.
              </h3>
            </div>

            {/* Newsletter input + Subscribe button */}
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full sm:flex-1 h-[48px] px-4 border border-[#c8c8cc] rounded-none font-sans text-[15px] text-[#0b0b0d] placeholder-[#8d8d95] focus:outline-none focus:border-[#0b0b0d]"
              />
              <button
                type="button"
                className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer shrink-0"
              >
                <span className="relative z-10 flex h-[48px] px-6 items-center justify-center bg-[#0b0b0d] border border-[#0b0b0d] text-[15px] font-medium text-white rounded-none">
                  Subscribe
                </span>
                <span
                  className="absolute left-full top-0 h-full w-[4px] group-hover:w-[5px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                  style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                />
                <span
                  className="absolute top-full left-0 w-full h-[4px] group-hover:h-[5px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                  style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                />
              </button>
            </form>
          </div>

          {/* Cell C1 (Product): 4 cols */}
          <div className="relative p-6 sm:p-8 lg:col-span-4 border-b md:border-b-0 md:border-r border-[#ececec]">
            <span className="absolute top-4 right-4 font-mono text-[10px] text-[#8d8d95] select-none">
              C1
            </span>
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8d8d95] mb-5">
              PRODUCT
            </div>
            <ul className="space-y-2 font-sans text-[16px] text-[#47474e]">
              <li>
                <Link href="/explore" className="hover:text-[#0b0b0d] transition-colors duration-150 block">
                  Wiki Explorer
                </Link>
              </li>
              <li>
                <a href="#features" className="hover:text-[#0b0b0d] transition-colors duration-150 block">
                  Features
                </a>
              </li>
              <li>
                <Link href="/create" className="hover:text-[#0b0b0d] transition-colors duration-150 block">
                  Create a Wiki
                </Link>
              </li>
              <li>
                <Link href="/pulls" className="hover:text-[#0b0b0d] transition-colors duration-150 block">
                  Pull Requests
                </Link>
              </li>
            </ul>
          </div>

          {/* Cell D1 (Resources): 4 cols */}
          <div className="relative p-6 sm:p-8 lg:col-span-4">
            <span className="absolute top-4 right-4 font-mono text-[10px] text-[#8d8d95] select-none">
              D1
            </span>
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8d8d95] mb-5">
              RESOURCES
            </div>
            <ul className="space-y-2 font-sans text-[16px] text-[#47474e]">
              <li>
                <a
                  href="https://github.com/Ethan4582/RepoSense#readme"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#0b0b0d] transition-colors duration-150 block"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Ethan4582/RepoSense"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#0b0b0d] transition-colors duration-150 block"
                >
                  GitHub Repo
                </a>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[#0b0b0d] transition-colors duration-150 block">
                  Models
                </Link>
              </li>
              <li>
                <span className="hover:text-[#0b0b0d] cursor-pointer transition-colors duration-150 block">
                  Privacy
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Second Row: Cell C2 (Status/Live) & Cell E2 (Elsewhere) */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-[#ececec]">
          {/* Cell C2: Operational metrics info */}
          <div className="relative p-6 sm:p-8 border-b md:border-b-0 md:border-r border-[#ececec]">
            <span className="absolute top-4 right-4 font-mono text-[10px] text-[#8d8d95] select-none">
              C2
            </span>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[#47474e] mb-6">
              <span className="size-2 bg-[#2337ff] inline-block" />
              <span>ALL SYSTEMS OPERATIONAL</span>
            </div>

            <div className="space-y-4 font-mono text-[12px] max-w-md">
              {latencies.map((item) => {
                const pct = Math.round(((item.ms - 20) / 45) * 100);
                return (
                  <div key={`c2-${item.region}`} className="flex items-center gap-4">
                    <span className="w-10 text-[#47474e] font-semibold">{item.region}</span>
                    <div className="flex-1 h-1.5 bg-[#ececec]">
                      <div
                        className="h-full bg-black transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(15, pct))}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-[#0b0b0d]">{item.ms} MS</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cell E2: Elsewhere */}
          <div className="relative p-6 sm:p-8">
            <span className="absolute top-4 right-4 font-mono text-[10px] text-[#8d8d95] select-none">
              E2
            </span>
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#8d8d95] mb-4">
              ELSEWHERE
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {[
                { name: 'LinkedIn', href: 'https://www.linkedin.com/in/ashirwad08singh/' },
                { name: 'Portfolio', href: 'https://www.aash7.xyz/' },
                { name: 'X', href: 'https://x.com/ashirwadsingh_' },
                { name: 'GitHub', href: 'https://github.com/Ethan4582' },
              ].map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between py-3 border-b border-[#ececec] text-[15px] font-sans text-[#47474e] hover:text-[#0b0b0d] transition-colors duration-150"
                >
                  <span>{link.name}</span>
                  <span className="text-[13px] text-[#8d8d95] group-hover:text-[#0b0b0d] transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    &#x2197;
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive RepoSense Folder-Brick Wordmark with public/dustbin.png */}
        <div className="pt-4 border-t border-[#ececec]">
          <FolderBrickWordmark />
        </div>

        {/* Bottom Strip */}
        <div className="p-4 sm:px-8 border-t border-[#ececec] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.05em] text-[#8d8d95]">
          <div>MOVE ACROSS THE WORDMARK</div>
          <div>&copy; 2026 REPOSENSE &middot; ALL RIGHTS RESERVED</div>
        </div>
      </div>
    </footer>
  );
}
