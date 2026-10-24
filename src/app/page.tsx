'use client';

import * as React from 'react';
import Link from 'next/link';
import { useUser, SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';
import { api } from '~/trpc/react';
import { IsometricCubeField } from '~/components/landing/isometric-cube-field';
import { ProductShowcase } from '~/components/landing/product-showcase';
import { FeaturesSection } from '~/components/landing/features-section';
import { FaqSection } from '~/components/landing/faq-section';
import { LandingFooterSections } from '~/components/landing/landing-footer-sections';
import { SectionBoundary } from '~/components/landing/section-boundary';
import { RepoMarquee } from '~/components/landing/repo-marquee';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const wikiCountQuery = api.project.getTotalWikiCount.useQuery();
  const formattedCount = wikiCountQuery.data?.toLocaleString() ?? '—';

  return (
    <div className="min-h-screen bg-white text-[#0b0b0d] font-sans selection:bg-[#2337ff] selection:text-white flex flex-col">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#ececec] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 sm:px-[64px]">
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

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="h-9 w-24 rounded-none bg-neutral-100 animate-pulse" />
            ) : isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="h-10 px-4 rounded-none inline-flex items-center justify-center text-sm font-semibold border border-black bg-white text-black shadow-[4px_4px_0_#d4d4d8] hover:bg-[#fafafb] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#c4c4c8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#d4d4d8] transition-all"
                >
                  Dashboard
                </Link>
                <SignOutButton>
                  <button
                    type="button"
                    className="h-10 px-4 rounded-none inline-flex items-center justify-center text-sm font-semibold border border-black bg-[#0b0b0d] text-white shadow-[4px_4px_0_#2337ff] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2337ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#2337ff] transition-all cursor-pointer"
                  >
                    Sign Out
                  </button>
                </SignOutButton>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="h-10 px-4 rounded-none inline-flex items-center justify-center text-sm font-semibold border border-black bg-white text-black shadow-[4px_4px_0_#d4d4d8] hover:bg-[#fafafb] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#c4c4c8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#d4d4d8] transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="h-10 px-4 rounded-none inline-flex items-center justify-center gap-1.5 text-sm font-semibold border border-black bg-[#0b0b0d] text-white shadow-[4px_4px_0_#2337ff] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2337ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#2337ff] transition-all"
                >
                  <span>Get Started</span>
                  <span aria-hidden="true">&#x2197;</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col overflow-visible">
        <div className="relative border-x border-[#d4d4d4] px-6 sm:px-[64px] pt-8 pb-0 flex flex-col justify-between overflow-visible">
          {/* Main 2-Column Split: Left 44fr, Right 56fr */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[44fr_56fr] items-center gap-8 overflow-visible">
            {/* Left Content Column */}
            <div className="max-w-[460px] flex flex-col items-start overflow-visible">
              {/* Top Eyebrow / Tagline in Left Column */}
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[#47474e] mb-6">
                <span className="size-2 rounded-full bg-[#2337ff] animate-pulse" />
                <span>[ 001 ] REPOSENSE / ARCHITECTURE ENGINE</span>
              </div>

              {/* Main Heading: Fraunces, weight 360, tight tracking */}
              <h1
                className="text-[38px] sm:text-[48px] lg:text-[56px] xl:text-[64px]"
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontWeight: 360,
                  lineHeight: 1.0,
                  letterSpacing: '-2px',
                  color: '#0b0b0d',
                  marginBottom: '24px',
                  fontStyle: 'normal',
                }}
              >
                Understand,<br />
                Code and Chat <br />
                <span style={{ color: '#8d8d95' }}>File by File</span>
              </h1>

              {/* Subheading: Inter Tight 19px, line-height 1.5, max-width 440px */}
              <p
                style={{
                  fontFamily: 'var(--font-inter-tight, inherit)',
                  fontSize: '19px',
                  lineHeight: 1.5,
                  color: '#47474e',
                  maxWidth: '440px',
                  marginBottom: '32px',
                }}
              >
               Turn GitHub repos into searchable wikis with line-exact answers and citation traces for developers, teams, and agents.
              </p>

              {/* Primary & Secondary Action CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={isSignedIn ? "/dashboard" : "/sign-up"}
                  className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                >
                  <span className="relative z-10 flex h-[52px] px-6 items-center justify-center gap-2 bg-[#0b0b0d] border border-[#0b0b0d] text-[18px] font-medium text-white rounded-none">
                    <span>Start building free</span>
                    <span aria-hidden="true">&#x2197;</span>
                  </span>
                  <span
                    className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#1423b8] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                  />
                  <span
                    className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#2337ff] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                  />
                </Link>
                <a
                  href="#how-it-works"
                  className="group relative inline-block transition-transform duration-150 ease-out hover:-translate-x-[1px] hover:-translate-y-[1px] cursor-pointer"
                >
                  <span className="relative z-10 flex h-[52px] px-6 items-center justify-center bg-white border border-[#0b0b0d] text-[18px] font-medium text-[#0b0b0d] rounded-none">
                    <span>See how it stacks</span>
                  </span>
                  <span
                    className="absolute left-full top-0 h-full w-[5px] group-hover:w-[6px] bg-[#c8c8cc] border-t border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewY(45deg)', transformOrigin: 'top left' }}
                  />
                  <span
                    className="absolute top-full left-0 w-full h-[5px] group-hover:h-[6px] bg-[#e5e5ea] border-l border-r border-b border-[#0b0b0d] transition-all duration-150 ease-out"
                    style={{ transform: 'skewX(45deg)', transformOrigin: 'top left' }}
                  />
                </a>
              </div>
            </div>

            {/* Right: Embedded Interactive Isometric Cube Canvas Component */}
            <div
              className="relative flex items-center justify-center w-full overflow-visible z-1"
              style={{
                minWidth: '380px',
                maxWidth: '740px',
                width: '100%',
                height: '540px',
                marginLeft: 'auto',
              }}
            >
              <IsometricCubeField className="w-full h-full" />
            </div>
          </div>

          {/* Bottom Stats / Metrics Bar */}
          <div className="w-full border-t border-[#ececec] mt-4 py-3 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.04em]">
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-[#47474e]">
              <div className="inline-flex items-center gap-2">
                <span className="size-[7px] bg-[#2337ff] inline-block" />
                <span className="font-semibold text-black">{formattedCount}</span>
                <span>WIKIS INDEXED</span>
              </div>
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

          {/* Section End Divider Line with SectionBoundary */}
          <SectionBoundary tag="01 CLIENTS" isHeroEnd />
        </div>
      </section>

      {/* Marquee Banner: Popular Repositories & Wiki Count */}
      <RepoMarquee wikiCount={formattedCount} />

      {/* 3. Page 2: Live Product Showcase */}
      <div className="w-full relative">
        <SectionBoundary tag="02 STACK" />
        <ProductShowcase />
      </div>

      {/* 4. Page 3: Features Section (Replicating Reference Design) */}
      <div className="w-full relative">
        <SectionBoundary tag="03 ARCHITECTURE" />
        <FeaturesSection />
      </div>

      {/* 5. Section 4: FAQ Section (Replicating Reference Design) */}
      <FaqSection />

      {/* 6. Section 5 & Footer */}
      <div className="w-full relative">
        <SectionBoundary tag="04 PLATFORM" />
        <LandingFooterSections />
      </div>
    </div>
  );
}
