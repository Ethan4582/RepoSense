'use client';

import * as React from 'react';
import Link from 'next/link';
import { useUser, SignOutButton } from '@clerk/nextjs';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Cpu,
  ExternalLink,
  GitBranch,
  Github,
  KeyRound,
  Layers,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';
import { FolderBrickWordmark, FolderBrickIcon } from '~/components/landing/folder-brick-wordmark';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans selection:bg-[#126dfb] selection:text-white">
      {/* 1. Top Navigation Bar (Sticky, Minimal) */}
      <header className="sticky top-0 z-50 h-[60px] border-b border-[#e2e8f0] bg-[#f8fafc]/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1180px] items-center justify-between px-4 sm:px-6">
          {/* Left Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-7 transition-transform group-hover:scale-105">
              <FolderBrickIcon />
            </div>
            <span className="text-base font-semibold tracking-tight text-[#0f172a]">
              RepoSense
            </span>
          </Link>

          {/* Center Group (3 Navigation Links) */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/explore"
              className="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Example Wikis
            </Link>
            <a
              href="https://github.com/Ethan4582/RepoSense#readme"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors inline-flex items-center gap-1"
            >
              Docs
              <ExternalLink className="size-3 opacity-60" />
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Features
            </a>
          </nav>

          {/* Right Group (Actions) */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Ethan4582/RepoSense"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#0f172a] hover:bg-[#f1f5f9] transition-colors shadow-2xs"
            >
              <Github className="size-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>

            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-1 rounded-full bg-[#126dfb] px-4 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-[#0e58cc] transition-colors shadow-2xs"
                    >
                      Dashboard
                      <ArrowRight className="size-3.5" />
                    </Link>
                    <SignOutButton redirectUrl="/sign-in">
                      <button className="rounded-full border border-[#e2e8f0] bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors shadow-2xs">
                        Logout
                      </button>
                    </SignOutButton>
                  </div>
                ) : (
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center rounded-full bg-[#126dfb] px-5 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-[#0e58cc] transition-colors shadow-2xs"
                  >
                    Login
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Section 1 — Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-16 overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[420px] w-full max-w-4xl bg-radial from-[#126dfb]/8 to-transparent blur-3xl opacity-70" />

        <div className="relative mx-auto max-w-[1180px] px-4 sm:px-6">
          {/* Static Text Block */}
          <div className="mx-auto max-w-3xl text-center">
            {/* Top Pill Announcement */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-3.5 py-1 text-xs font-medium text-[#64748b] shadow-2xs mb-6">
              <span className="size-2 rounded-full bg-[#126dfb] animate-pulse" />
              <span>Next-Gen DeepWiki 3.0 Architecture</span>
            </div>

            {/* Two-Line Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight text-[#0f172a] leading-[1.1]">
              Turn any GitHub repository into a living DeepWiki.
            </h1>

            {/* Supporting Subline */}
            <p className="mx-auto mt-6 max-w-[44ch] text-base sm:text-lg text-[#64748b] leading-relaxed">
              100% BYOK architecture diagrams, line-numbered citations, and interactive codebase Q&A.
            </p>

            {/* CTA Row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href={isSignedIn ? "/dashboard" : "/sign-in"}
                className="inline-flex items-center justify-center rounded-full bg-[#126dfb] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0e58cc] transition-all shadow-xs hover:shadow-md hover:scale-[1.01]"
              >
                Get Started
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-white px-6 py-2.5 text-sm font-medium text-[#0f172a] hover:bg-[#f1f5f9] transition-all shadow-2xs hover:scale-[1.01]"
              >
                Explore Public Wikis
              </Link>
            </div>
          </div>

          {/* Lower Viewport: Product Wiki Showcase Stage */}
          <div className="mt-14 sm:mt-18 max-w-5xl mx-auto">
            <div className="relative rounded-2xl border border-[#e2e8f0] bg-white p-2 sm:p-3 shadow-[0_24px_60px_-15px_rgba(18,109,251,0.14)] transition-all">
              {/* Window Frame Bar */}
              <div className="flex h-9 items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-3.5 rounded-t-xl mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="size-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="size-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-3 py-0.5 text-[11px] text-[#64748b] shadow-2xs">
                  <Lock className="size-2.5 text-[#126dfb]" />
                  <span>reposense.dev/wiki/Ethan4582/RepoSense</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#126dfb]">
                  <GitBranch className="size-3" />
                  <span className="hidden sm:inline">main · 100% indexed</span>
                </div>
              </div>

              {/* Wiki Preview Image */}
              <div className="relative overflow-hidden rounded-xl border border-[#e2e8f0]/60 bg-white">
                <img
                  src="/hero_image.png"
                  alt="RepoSense DeepWiki Showcase"
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Section 2 — Features Section (3 Minimal Bento Cards) */}
      <section id="features" className="pt-24 sm:pt-28 pb-20 border-t border-[#e2e8f0]/70">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          {/* Header Block (Centered) */}
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#0f172a] leading-[1.15]">
              A codebase library that gets clearer every time you index.
            </h2>
            <p className="mt-3.5 text-sm sm:text-base text-[#64748b]">
              100% Bring Your Own Key. Instant architecture diagrams. Built to stay out of your way.
            </p>
          </div>

          {/* 3-Column Bento Grid */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1120px] mx-auto">
            {/* Card 1: Living Architecture Wikis */}
            <div className="group flex flex-col justify-between rounded-2xl bg-[#f1f5f9] p-7 min-h-[360px] border border-[#e2e8f0]/60 hover:border-[#126dfb]/30 transition-all hover:shadow-xs">
              {/* Top Miniature Mockup */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-[#126dfb]" />
                      <span className="text-xs font-semibold text-[#0f172a]">DeepWiki</span>
                    </div>
                    <div className="flex items-center gap-1 rounded bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium text-[#126dfb]">
                      <span>⌘ K</span>
                    </div>
                  </div>
                  {/* Schematic Flow */}
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between rounded-md bg-[#f8fafc] border border-[#e2e8f0] px-2 py-1.5">
                      <span className="text-[#0f172a] font-medium"># Architecture</span>
                      <span className="text-[#126dfb] text-[10px]">3 chapters</span>
                    </div>
                    <div className="flex items-center justify-center py-1">
                      <div className="h-4 w-px bg-[#126dfb]/30" />
                    </div>
                    <div className="rounded-md bg-[#eef4ff] border border-[#126dfb]/20 px-2 py-1 text-center font-mono text-[10px] text-[#126dfb]">
                      Client → Worker → Dual Vector
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Copy */}
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]/50">
                <h3 className="text-[15px] font-semibold text-[#0f172a] leading-snug">
                  Living Architecture Wikis
                </h3>
                <p className="mt-1 text-[13px] text-[#64748b] leading-relaxed">
                  Convert raw repositories into multi-page documentation with interactive Mermaid diagrams.
                </p>
              </div>
            </div>

            {/* Card 2: Line-Exact Code Inspector */}
            <div className="group flex flex-col justify-between rounded-2xl bg-[#f1f5f9] p-7 min-h-[360px] border border-[#e2e8f0]/60 hover:border-[#126dfb]/30 transition-all hover:shadow-xs">
              {/* Top Miniature Mockup */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="inline-flex items-center rounded-full bg-[#eef4ff] border border-[#126dfb]/20 px-2 py-0.5 text-[10px] font-mono text-[#126dfb]">
                      src/lib/branch.ts:17-24
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Scanning
                    </span>
                  </div>
                  <div className="rounded-md bg-[#0f172a] p-2.5 font-mono text-[10px] text-slate-300 leading-relaxed overflow-hidden">
                    <p className="text-slate-500">{'// Line-exact citation'}</p>
                    <p><span className="text-[#60a5fa]">export</span> <span className="text-amber-300">function</span> <span className="text-emerald-400">verify</span>() &#123;</p>
                    <p className="pl-2 text-slate-400">return <span className="text-cyan-300">vault</span>.decrypt();</p>
                    <p>&#125;</p>
                  </div>
                </div>
              </div>

              {/* Bottom Copy */}
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]/50">
                <h3 className="text-[15px] font-semibold text-[#0f172a] leading-snug">
                  Line-Exact Code Inspector
                </h3>
                <p className="mt-1 text-[13px] text-[#64748b] leading-relaxed">
                  Ask deep architectural questions with clickable source citations and split-pane file previews.
                </p>
              </div>
            </div>

            {/* Card 3: Bring Your Own Key */}
            <div className="group flex flex-col justify-between rounded-2xl bg-[#f1f5f9] p-7 min-h-[360px] border border-[#e2e8f0]/60 hover:border-[#126dfb]/30 transition-all hover:shadow-xs">
              {/* Top Miniature Mockup */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[250px] rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#e2e8f0]">
                    <span className="text-[11px] font-medium text-[#0f172a]">Supported Providers</span>
                    <span className="text-[10px] font-medium text-[#126dfb] bg-[#eef4ff] px-1.5 py-0.5 rounded">
                      0% Markup
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#126dfb]" />
                      <span className="font-medium text-[#0f172a]">OpenAI</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#126dfb]" />
                      <span className="font-medium text-[#0f172a]">Anthropic</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#126dfb]" />
                      <span className="font-medium text-[#0f172a]">Gemini</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1">
                      <span className="size-1.5 rounded-full bg-[#126dfb]" />
                      <span className="font-medium text-[#0f172a]">DeepSeek</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Copy */}
              <div className="mt-6 pt-4 border-t border-[#e2e8f0]/50">
                <h3 className="text-[15px] font-semibold text-[#0f172a] leading-snug">
                  Bring Your Own Key
                </h3>
                <p className="mt-1 text-[13px] text-[#64748b] leading-relaxed">
                  Plug in OpenAI, Anthropic, Gemini, Meta, DeepSeek, xAI, or Groq with zero server markup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section 3 — Footer Section */}
      <footer className="pt-24 pb-16 bg-[#f8fafc] border-t border-[#e2e8f0]">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          {/* Top 4-Column Link Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-16">
            {/* Column 1: Product */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4">
                product
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
                <li>
                  <Link href="/explore" className="hover:text-[#126dfb] transition-colors">
                    example wikis
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-[#126dfb] transition-colors">
                    features
                  </a>
                </li>
                <li>
                  <Link href="/create" className="hover:text-[#126dfb] transition-colors">
                    create wiki
                  </Link>
                </li>
                <li>
                  <Link href="/pulls" className="hover:text-[#126dfb] transition-colors">
                    pull requests
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Resources */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4">
                resources
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense#readme"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    docs
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    github repo
                  </a>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-[#126dfb] transition-colors">
                    models & pricing
                  </Link>
                </li>
                <li>
                  <span className="hover:text-[#126dfb] cursor-pointer transition-colors">
                    privacy
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 3: Connect */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4">
                connect
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
                <li>
                  <a
                    href="https://github.com/Ethan4582/RepoSense"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    github
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    x (twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    linkedin
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#126dfb] transition-colors"
                  >
                    youtube
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: BYOK Notice */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4">
                byok notice
              </h4>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed">
                reposense runs 100% on your own encrypted API keys — your keys and private code are never sold or shared.
              </p>
            </div>
          </div>

          {/* Giant Interactive "reposense" Folder-Brick Wordmark */}
          <div className="pt-8 border-t border-[#e2e8f0]">
            <FolderBrickWordmark />
          </div>

          {/* Bottom Legal Caption */}
          <div className="mt-12 text-center text-xs text-[#94a3b8]">
            © RepoSense 2026. Built with Cloudflare Workers.
          </div>
        </div>
      </footer>
    </div>
  );
}
