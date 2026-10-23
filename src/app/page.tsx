'use client';

import * as React from 'react';
import Link from 'next/link';
import { useUser, SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';
import { FolderBrickWordmark } from '~/components/landing/folder-brick-wordmark';
import { api } from '~/trpc/react';
import { IsometricCubeField } from '~/components/landing/isometric-cube-field';
import { ProductShowcase } from '~/components/landing/product-showcase';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const wikiCountQuery = api.project.getTotalWikiCount.useQuery();
  const formattedCount = (wikiCountQuery.data ?? 1324574).toLocaleString();

  return (
    <div className="min-h-screen bg-white text-[#0b0b0d] font-sans selection:bg-[#2337ff] selection:text-white flex flex-col">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#ececec] bg-white">
        <div className="mx-auto flex h-[58px] max-w-[1440px] items-center justify-between px-6 sm:px-12">
          {/* Left Brand: Logo Image + Wordmark */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative size-6 shrink-0 overflow-hidden rounded-md transition-transform group-hover:scale-105">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" priority />
            </div>
            <span className="font-serif text-[22px] font-medium tracking-tight text-[#0b0b0d]">
              RepoSense
            </span>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/explore"
              className="text-[15px] font-medium text-[#47474e] hover:text-[#0b0b0d] transition-colors"
            >
              Wiki
            </Link>
            <a
              href="https://github.com/Ethan4582/RepoSense#readme"
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-medium text-[#47474e] hover:text-[#0b0b0d] transition-colors"
            >
              Docs
            </a>
            <a
              href="#features"
              className="text-[15px] font-medium text-[#47474e] hover:text-[#0b0b0d] transition-colors"
            >
              Features
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Ethan4582/RepoSense"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub Repository"
              className="size-10 inline-flex items-center justify-center rounded-none border border-[#e5e5e5] bg-white text-[#0b0b0d] hover:bg-[#2337ff] hover:border-[#2337ff] hover:text-white transition-all duration-200 ease-out"
            >
              <svg
                viewBox="0 0 16 16"
                width="20"
                height="20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
              </svg>
            </a>

            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-3">
                    <Link
                      href="/dashboard"
                      className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                    >
                      <span className="relative z-10 flex h-[40px] px-4 items-center justify-center gap-1.5 bg-[#0b0b0d] border border-[#0b0b0d] text-[14px] font-medium text-white rounded-none">
                        <span>Dashboard</span>
                        <span aria-hidden="true">&#x2197;</span>
                      </span>
                      <span
                        className="absolute left-full top-0 h-full w-[4px] group-hover:w-[5px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                        style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                      />
                      <span
                        className="absolute top-full left-0 w-full h-[4px] group-hover:h-[5px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                        style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                      />
                    </Link>
                    <SignOutButton redirectUrl="/">
                      <button className="h-[40px] px-3.5 rounded-none inline-flex items-center justify-center border border-[#ececec] bg-white text-[13px] font-medium text-[#47474e] hover:text-[#0b0b0d] hover:bg-[#fafafb] transition-colors duration-200 ease-out cursor-pointer">
                        Logout
                      </button>
                    </SignOutButton>
                  </div>
                ) : (
                  <Link
                    href="/sign-up"
                    className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                  >
                    <span className="relative z-10 flex h-[40px] px-4 items-center justify-center gap-1.5 bg-[#0b0b0d] border border-[#0b0b0d] text-[14px] font-medium text-white rounded-none">
                      <span>Start building</span>
                      <span aria-hidden="true">&#x2197;</span>
                    </span>
                    <span
                      className="absolute left-full top-0 h-full w-[4px] group-hover:w-[5px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                      style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                    />
                    <span
                      className="absolute top-full left-0 w-full h-[4px] group-hover:h-[5px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                      style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                    />
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 flex flex-col flex-1">
        <div className="relative border-x border-[#ececec] px-8 sm:px-14 pt-10 pb-6 flex flex-col justify-between flex-1">
          {/* Decorative subtle border ticks */}
          <span className="pointer-events-none absolute top-1/2 -left-[4px] h-[1px] w-2 bg-[#ececec]" />
          <span className="pointer-events-none absolute top-1/2 -right-[4px] h-[1px] w-2 bg-[#ececec]" />

          {/* Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[46%_54%] items-center gap-4 my-auto py-4">
            {/* Left Content */}
            <div className="max-w-[560px]">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[#47474e] mb-5">
                <span className="size-2 bg-[#2337ff] inline-block" />
                <span>REPOSENSE 4.0 &#183; VERIFIABLE CODEBASE INTELLIGENCE</span>
              </div>

              {/* Headline */}
              <h1 className="font-serif text-[48px] sm:text-[58px] lg:text-[72px] font-[360] leading-[0.98] tracking-[-2px] text-black mb-5">
                Build your operations
                <span className="block not-italic text-[#8d8d95]">block by block.</span>
              </h1>

              {/* Subheading */}
              <p className="text-[19px] font-normal leading-[1.5] text-[#47474e] max-w-[420px] mb-8">
                RepoSense turns your GitHub repositories into versioned, testable blocks your team can stack, query, and ship. Every run is traced and every answer cites its source.
              </p>

              {/* CTA Buttons - Matching Image 2 Exactly */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                {/* Primary (black) Button with Blue 3D Extrusion */}
                <Link
                  href={isSignedIn ? "/dashboard" : "/sign-up"}
                  className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                >
                  <span className="relative z-10 flex h-[52px] px-6 items-center justify-center gap-2 bg-[#0b0b0d] border border-[#0b0b0d] text-[18px] font-medium text-white rounded-none">
                    <span>Start building free</span>
                    <span aria-hidden="true">&#x2197;</span>
                  </span>
                  {/* Right 3D Face */}
                  <span
                    className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                  />
                  {/* Bottom 3D Face */}
                  <span
                    className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                  />
                </Link>

                {/* Secondary (white) Button with Gray 3D Extrusion */}
                <a
                  href="#how-it-works"
                  className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                >
                  <span className="relative z-10 flex h-[52px] px-6 items-center justify-center bg-white border border-[#0b0b0d] text-[18px] font-medium text-[#0b0b0d] rounded-none">
                    <span>See how it stacks</span>
                  </span>
                  {/* Right 3D Face */}
                  <span
                    className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#c8c8cc] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                  />
                  {/* Bottom 3D Face */}
                  <span
                    className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#e5e5ea] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                  />
                </a>
              </div>
            </div>

            {/* Right: Embedded Interactive Isometric Cube Canvas Component */}
            <div className="relative w-full aspect-square max-w-[660px] h-[540px] lg:h-[580px] mx-auto flex items-center justify-center lg:-ml-6">
              <IsometricCubeField className="w-full h-full" />
            </div>
          </div>

          {/* Bottom Stats / Metrics Bar */}
          <div className="w-full border-t border-[#ececec] mt-6 pt-4 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.04em]">
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-[#47474e]">
              <div className="inline-flex items-center gap-2">
                <span className="size-[7px] bg-[#2337ff] inline-block" />
                <span className="font-semibold text-black">{formattedCount}</span>
                <span>WIKIS INDEXED</span>
              </div>
              <div>100% BYOK ENCRYPTED</div>
            </div>
            <div>
              <a
                href="#features"
                className="inline-flex items-center gap-1 text-[#8d8d95] hover:text-[#0b0b0d] transition-colors"
              >
                <span>MOVE CLOSER TO OPEN THE BLOCK</span>
                <span aria-hidden="true">&#x2197;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Page 2: Live Product Showcase */}
      <ProductShowcase />

      {/* 4. Section 2 — Features Bento Grid */}
      <section id="features" className="pt-20 sm:pt-24 pb-20 border-t border-[#ececec]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
          {/* Header Block (Centered) */}
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#0b0b0d] leading-[1.15]">
              A codebase library that gets clearer every time you index.
            </h2>
            <p className="mt-3.5 text-sm sm:text-base text-[#47474e]">
              100% Bring Your Own Key. Instant architecture diagrams. Built to stay out of your way.
            </p>
          </div>

          {/* 3-Column Bento Grid */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1240px] mx-auto">
            {/* Card 1: Living Architecture Wikis */}
            <div className="group flex flex-col justify-between rounded-sm bg-[#fafafb] p-7 min-h-[360px] border border-[#ececec] hover:border-[#2337ff]/40 transition-all hover:shadow-xs">
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded border border-[#ececec] bg-white p-4 shadow-2xs transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between border-b border-[#ececec] pb-2.5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-[#2337ff]" />
                      <span className="text-xs font-semibold text-[#0b0b0d]">DeepWiki</span>
                    </div>
                    <div className="flex items-center gap-1 rounded bg-[#f4f4f5] px-1.5 py-0.5 text-[10px] font-mono text-[#2337ff]">
                      <span>&#x2318; K</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between rounded bg-[#fafafb] border border-[#ececec] px-2 py-1.5">
                      <span className="text-[#0b0b0d] font-medium"># Architecture</span>
                      <span className="text-[#2337ff] text-[10px]">3 chapters</span>
                    </div>
                    <div className="flex items-center justify-center py-1">
                      <div className="h-4 w-px bg-[#2337ff]/30" />
                    </div>
                    <div className="rounded bg-[#f4f4f5] border border-[#2337ff]/20 px-2 py-1 text-center font-mono text-[10px] text-[#2337ff]">
                      Client &#x2192; Worker &#x2192; Dual Vector
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#ececec]">
                <h3 className="text-[15px] font-semibold text-[#0b0b0d] leading-snug">
                  Living Architecture Wikis
                </h3>
                <p className="mt-1 text-[13px] text-[#47474e] leading-relaxed">
                  Convert raw repositories into multi-page documentation with interactive Mermaid diagrams.
                </p>
              </div>
            </div>

            {/* Card 2: Line-Exact Code Inspector */}
            <div className="group flex flex-col justify-between rounded-sm bg-[#fafafb] p-7 min-h-[360px] border border-[#ececec] hover:border-[#2337ff]/40 transition-all hover:shadow-xs">
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded border border-[#ececec] bg-white p-4 shadow-2xs transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="inline-flex items-center rounded bg-[#f4f4f5] border border-[#2337ff]/20 px-2 py-0.5 text-[10px] font-mono text-[#2337ff]">
                      src/lib/branch.ts:17-24
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Scanning
                    </span>
                  </div>
                  <div className="rounded bg-[#fafafb] border border-[#ececec] p-2.5 font-mono text-[10px] text-[#47474e] space-y-1">
                    <p className="text-[#0b0b0d]">const tree = await indexRepo();</p>
                    <p className="text-emerald-600 font-semibold">+ 47 AST nodes mapped</p>
                    <p className="text-[#8d8d95]">// zero hallucinations</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#ececec]">
                <h3 className="text-[15px] font-semibold text-[#0b0b0d] leading-snug">
                  Line-Exact Code Inspector
                </h3>
                <p className="mt-1 text-[13px] text-[#47474e] leading-relaxed">
                  Every answer cites exact commit SHA hashes and file lines. Click any reference to verify.
                </p>
              </div>
            </div>

            {/* Card 3: Bring Your Own Key */}
            <div className="group flex flex-col justify-between rounded-sm bg-[#fafafb] p-7 min-h-[360px] border border-[#ececec] hover:border-[#2337ff]/40 transition-all hover:shadow-xs">
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded border border-[#ececec] bg-white p-3.5 shadow-2xs transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#ececec]">
                    <span className="text-[11px] font-medium text-[#0b0b0d]">Supported Providers</span>
                    <span className="text-[10px] font-medium text-[#2337ff] bg-[#f4f4f5] px-1.5 py-0.5 rounded font-mono">
                      0% Markup
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 rounded bg-[#fafafb] border border-[#ececec] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#2337ff]" />
                      <span className="font-medium text-[#0b0b0d]">OpenAI</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded bg-[#fafafb] border border-[#ececec] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#2337ff]" />
                      <span className="font-medium text-[#0b0b0d]">Anthropic</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded bg-[#fafafb] border border-[#ececec] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#2337ff]" />
                      <span className="font-medium text-[#0b0b0d]">Gemini</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded bg-[#fafafb] border border-[#ececec] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#2337ff]" />
                      <span className="font-medium text-[#0b0b0d]">DeepSeek</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#ececec]">
                <h3 className="text-[15px] font-semibold text-[#0b0b0d] leading-snug">
                  Bring Your Own Key
                </h3>
                <p className="mt-1 text-[13px] text-[#47474e] leading-relaxed">
                  Plug in OpenAI, Anthropic, Gemini, Meta, DeepSeek, xAI, or Groq with zero server markup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Section 3 — How It Works */}
      <section id="how-it-works" className="py-20 border-t border-[#ececec] bg-[#fafafb]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#0b0b0d] leading-[1.15]">
              From GitHub URL to complete intelligence in 60 seconds.
            </h2>
            <p className="mt-3.5 text-sm sm:text-base text-[#47474e]">
              Point to any repository. Watch it index, vectorize, and create a verifiable knowledge base.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1240px] mx-auto">
            <div className="p-6 bg-white border border-[#ececec] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">01 / REPOSITORY INGEST</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Connect Any Git Repo</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                Provide any public or authenticated GitHub URL. RepoSense maps tree structures and symbol dependencies in seconds.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#ececec] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">02 / VECTOR GROUNDING</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Dual-Layer Indexing</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                AST tree mapping meets dense semantic vector embeddings. Every code chunk is tied to an immutable commit SHA.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#ececec] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">03 / CONTINUOUS CODERAG</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Ask, Verify &amp; Ship</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                Ask architectural questions, debug issues, or extract pull-request summaries. Verify all outputs with line-exact citations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer Section with Giant Interactive Wordmark */}
      <footer className="pt-24 pb-16 bg-white border-t border-[#ececec]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
          {/* Top 4-Column Link Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-16">
            <div>
              <h4 className="text-sm font-semibold text-[#0b0b0d] tracking-tight mb-4">
                product
              </h4>
              <ul className="space-y-2.5 text-sm text-[#47474e]">
                <li>
                  <Link href="/explore" className="hover:text-[#2337ff] transition-colors">
                    example wikis
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-[#2337ff] transition-colors">
                    features
                  </a>
                </li>
                <li>
                  <Link href="/create" className="hover:text-[#2337ff] transition-colors">
                    create wiki
                  </Link>
                </li>
                <li>
                  <Link href="/pulls" className="hover:text-[#2337ff] transition-colors">
                    pull requests
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#0b0b0d] tracking-tight mb-4">
                resources
              </h4>
              <ul className="space-y-2.5 text-sm text-[#47474e]">
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense#readme"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    docs
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    github repo
                  </a>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-[#2337ff] transition-colors">
                    models &amp; pricing
                  </Link>
                </li>
                <li>
                  <span className="hover:text-[#2337ff] cursor-pointer transition-colors">
                    privacy
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#0b0b0d] tracking-tight mb-4">
                connect
              </h4>
              <ul className="space-y-2.5 text-sm text-[#47474e]">
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    github
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    x (twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    linkedin
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#2337ff] transition-colors"
                  >
                    youtube
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#0b0b0d] tracking-tight mb-4">
                byok notice
              </h4>
              <p className="text-xs sm:text-sm text-[#47474e] leading-relaxed">
                reposense runs 100% on your own encrypted API keys — your keys and private code are never sold or shared.
              </p>
            </div>
          </div>

          {/* Giant Interactive "reposense" Folder-Brick Wordmark */}
          <div className="pt-8 border-t border-[#ececec]">
            <FolderBrickWordmark />
          </div>

          {/* Bottom Legal Caption */}
          <div className="mt-12 text-center text-xs text-[#8d8d95]">
            &#169; RepoSense 2026. Built with Cloudflare Workers.
          </div>
        </div>
      </footer>
    </div>
  );
}
