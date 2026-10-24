'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FolderBrickWordmark } from '~/components/landing/folder-brick-wordmark';

export function LandingFooterSections() {
  return (
    <>
      {/* Section 4 — How It Works */}
      <section id="how-it-works" className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col">
        <div className="relative border-x border-[#d4d4d8] border-t border-[#d4d4d8] px-6 sm:px-[64px] py-16 bg-[#fafafb]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#0b0b0d] leading-[1.15]">
              From GitHub URL to complete intelligence in 60 seconds.
            </h2>
            <p className="mt-3.5 text-sm sm:text-base text-[#47474e]">
              Point to any repository. Watch it index, vectorize, and create a verifiable knowledge base.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1240px] mx-auto">
            <div className="p-6 bg-white border border-[#d4d4d8] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">01 / REPOSITORY INGEST</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Connect Any Git Repo</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                Provide any public or authenticated GitHub URL. RepoSense maps tree structures and symbol dependencies in seconds.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#d4d4d8] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">02 / VECTOR GROUNDING</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Dual-Layer Indexing</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                AST tree mapping meets dense semantic vector embeddings. Every code chunk is tied to an immutable commit SHA.
              </p>
            </div>

            <div className="p-6 bg-white border border-[#d4d4d8] rounded-sm">
              <div className="font-mono text-xs text-[#2337ff] font-semibold mb-2">03 / CONTINUOUS CODERAG</div>
              <h3 className="text-base font-semibold text-[#0b0b0d] mb-2">Ask, Verify &amp; Ship</h3>
              <p className="text-sm text-[#47474e] leading-relaxed">
                Ask architectural questions, debug issues, or extract pull-request summaries. Verify all outputs with line-exact citations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Final CTA */}
      <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col">
        <div className="relative border-x border-[#d4d4d8] border-t border-[#d4d4d8] px-6 sm:px-[64px] py-20 bg-white text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#0b0b0d] leading-tight">
              Start understanding your code with zero drift.
            </h2>
            <p className="mt-4 text-[#47474e] text-base leading-relaxed">
              No credit card required. Connect any repository and generate your first interactive architecture wiki in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/sign-up"
                className="h-12 px-7 rounded-none inline-flex items-center justify-center gap-2 bg-[#0b0b0d] text-[15px] font-semibold text-white border border-black shadow-[4px_4px_0_#2337ff] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2337ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#2337ff] transition-all"
              >
                <span>Get Started Free</span>
                <span aria-hidden="true">&#x2197;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Original Main Footer: 4-Column Directory + RepoSense Wordmark */}
      <footer className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col">
        <div className="relative border-x border-[#d4d4d8] border-t border-[#d4d4d8] px-6 sm:px-[64px] pt-16 pb-12 bg-[#f8fafc]">
          {/* Top 4-Column Link Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12">
            {/* Column 1: Product */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4 lowercase">
                product
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
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

            {/* Column 2: Resources */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4 lowercase">
                resources
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
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

            {/* Column 3: Connect */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4 lowercase">
                connect
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748b]">
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

            {/* Column 4: BYOK Notice */}
            <div>
              <h4 className="text-sm font-semibold text-[#0f172a] tracking-tight mb-4 lowercase">
                byok notice
              </h4>
              <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed">
                reposense runs 100% on your own encrypted API keys — your keys and private code are never sold or shared.
              </p>
            </div>
          </div>

          {/* Interactive RepoSense Folder-Brick Wordmark */}
          <div className="pt-8 border-t border-[#e2e8f0]">
            <FolderBrickWordmark />
          </div>
        </div>
      </footer>

      {/* Small Minimalist Footer Bar */}
      <footer className="w-full border-t border-[#d4d4d8] bg-white py-6 font-mono text-[11px] text-[#8d8d95]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-[64px] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative size-4 overflow-hidden rounded">
              <Image src="/logo.png" alt="RepoSense" fill className="object-cover" />
            </div>
            <span className="font-semibold text-[#0b0b0d]">RepoSense</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/explore" className="hover:text-[#0b0b0d] transition-colors">
              Explore
            </Link>
            <a
              href="https://github.com/Ethan4582/RepoSense"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#0b0b0d] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/Ethan4582/RepoSense#readme"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#0b0b0d] transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
