'use client';

import * as React from 'react';
import { cn } from '~/lib/utils';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How does RepoSense index a repository?',
    answer:
      'We parse your Git AST tree and pgvector index every chunk tied to an immutable commit SHA.',
  },
  {
    question: 'How does Bring Your Own Key (BYOK) work?',
    answer:
      'Add your OpenAI, Gemini, Anthropic, or Groq keys. They stay AES-256-GCM encrypted in your private vault.',
  },
  {
    question: 'Can I verify the citations in AI answers?',
    answer:
      'Yes. Every answer has inline badges that open the exact code line in the stacked file inspector.',
  },
  {
    question: 'Does RepoSense stay in sync with branches and PRs?',
    answer:
      'Yes. RepoSense tracks branch commits and pull requests so documentation never drifts from code.',
  },
  {
    question: 'Is my source code stored or used to train models?',
    answer:
      'Never. Your code is not used for model training and runs under your private BYOK keys.',
  },
];

export function FaqSection() {
  // Items 1 and 2 open by default, items 3-5 collapsed
  const [openIndices, setOpenIndices] = React.useState<number[]>([0, 1]);

  const toggleItem = (idx: number) => {
    setOpenIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <section id="faq" className="relative w-full bg-white select-none">
      {/* ── Top Horizontal Rule across full width with Diamonds and 09 FAQ Tag ── */}
      <div className="relative w-full border-t border-[#ececec]">
        <div className="relative mx-auto w-full max-w-[1440px] px-6 sm:px-[64px]">
          {/* Left diamond marker sitting on the top rule at the vertical guide line */}
          <svg
            width="14"
            height="8"
            viewBox="0 0 14 8"
            fill="#ffffff"
            className="pointer-events-none absolute left-6 sm:left-[64px] -top-[4px] -translate-x-1/2 z-30"
            aria-hidden="true"
          >
            <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
          </svg>

          {/* Right diamond marker sitting on the top rule at the vertical guide line */}
          <svg
            width="14"
            height="8"
            viewBox="0 0 14 8"
            fill="#ffffff"
            className="pointer-events-none absolute right-6 sm:right-[64px] -top-[4px] translate-x-1/2 z-30"
            aria-hidden="true"
          >
            <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
          </svg>

          {/* Top-right section tag: small blue square + 09 FAQ (Martian Mono 9px, uppercase) in 1px border box */}
          <div className="absolute right-6 sm:right-[64px] top-0 z-20">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-l border-b border-[#ececec] font-mono text-[9px] uppercase tracking-[0.06em] text-[#47474e]">
              <span className="size-[5px] bg-[#2337ff] inline-block shrink-0" />
              <span>05 FAQ</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Section Body with Vertical Frame Lines continuing from Hero ── */}
      <div className="relative mx-auto w-full max-w-[1440px] px-6 sm:px-[64px]">
        <div className="relative border-x border-[#ececec] px-6 sm:px-[64px] pt-24 pb-28">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Left column (~40% -> col-span-5) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              {/* Eyebrow: small blue cube icon + "QUESTIONS" (Martian Mono 11px, uppercase, charcoal), 24px above heading */}
              <div className="flex items-center gap-2 mb-6">
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
                  QUESTIONS
                </span>
              </div>

              {/* H2: "Asked before you build." Fraunces, weight 360, ~52px, line-height 1.0, tracking -1.6px, black. Break after "before". */}
              <h2 className="font-serif text-[44px] sm:text-[48px] lg:text-[52px] font-[360] leading-[1.0] tracking-[-1.6px] text-black">
                Asked before
                <br />
                you build.
              </h2>
            </div>

            {/* Right column (~60% -> col-span-7) */}
            <div className="lg:col-span-7 w-full border-t border-[#ececec]">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndices.includes(idx);
                return (
                  <div key={item.question} className="border-b border-[#ececec]">
                    {/* Question row: Inter Tight 18px, weight 500, black, 24px vertical padding, full-width clickable button */}
                    <button
                      type="button"
                      onClick={() => toggleItem(idx)}
                      className={cn(
                        'w-full flex items-center justify-between py-6 text-left transition-colors duration-150 group cursor-pointer select-none',
                        'outline-none focus-visible:outline-2 focus-visible:outline-[#2337ff] focus-visible:outline-offset-2'
                      )}
                      aria-expanded={isOpen}
                    >
                      <span className="font-sans text-[18px] font-medium leading-snug text-black group-hover:text-[#47474e] transition-colors">
                        {item.question}
                      </span>

                      {/* Toggle icon: "−" when open, "+" when closed, 1px stroke, 14px size */}
                      <span className="ml-4 flex size-5 shrink-0 items-center justify-center text-black group-hover:text-[#47474e] transition-colors">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          aria-hidden="true"
                        >
                          <line x1="1" y1="7" x2="13" y2="7" />
                          {!isOpen && <line x1="7" y1="1" x2="7" y2="13" />}
                        </svg>
                      </span>
                    </button>

                    {/* Butter-smooth height animation via grid-template-rows */}
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-250 ease-out',
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-6 font-sans text-[15px] font-normal leading-[1.5] text-[#47474e] max-w-[620px] select-text">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </div>

      {/* ── Bottom Horizontal Rule across full width with Diamonds and 10 BUILD Tag ── */}
      <div className="relative w-full border-t border-[#ececec]">
        <div className="relative mx-auto w-full max-w-[1440px] px-6 sm:px-[64px]">
          {/* Left diamond marker sitting on the bottom rule */}
          <svg
            width="14"
            height="8"
            viewBox="0 0 14 8"
            fill="#ffffff"
            className="pointer-events-none absolute left-6 sm:left-[64px] -top-[4px] -translate-x-1/2 z-30"
            aria-hidden="true"
          >
            <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
          </svg>

          {/* Right diamond marker sitting on the bottom rule */}
          <svg
            width="14"
            height="8"
            viewBox="0 0 14 8"
            fill="#ffffff"
            className="pointer-events-none absolute right-6 sm:right-[64px] -top-[4px] translate-x-1/2 z-30"
            aria-hidden="true"
          >
            <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
          </svg>

          {/* Bottom-right section tag: small blue square + 10 BUILD sitting on bottom rule */}
          <div className="absolute right-6 sm:right-[64px] top-0 z-20">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-l border-b border-[#ececec] font-mono text-[9px] uppercase tracking-[0.06em] text-[#47474e]">
              <span className="size-[5px] bg-[#2337ff] inline-block shrink-0" />
              <span>10 BUILD</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
