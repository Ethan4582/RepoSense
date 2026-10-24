'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FolderBrickWordmark } from '~/components/landing/folder-brick-wordmark';

export function LandingFooterSections() {
  return (
    <>


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
