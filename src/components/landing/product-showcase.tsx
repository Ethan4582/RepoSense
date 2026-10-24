'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LandingDemoWiki } from './landing-demo-wiki';

// Provider list using clean authentic SVGs directly from public/models
const PROVIDERS = [
  { name: 'Gemini', logo: '/models/gemini.svg' },
  { name: 'Grok', logo: '/models/grok.svg' },
  { name: 'OpenAI', logo: '/models/openai.svg' },
  { name: 'Anthropic', logo: '/models/anthropic.svg' },
  { name: 'DeepSeek', logo: '/models/deepseek.svg' },
  { name: 'Meta', logo: '/models/meta.svg' },
  { name: 'Mistral', logo: '/models/mistral.svg' },
  { name: 'Groq', logo: '/models/groq.svg' },
];

const TARGET_PATH = '/wiki/cmvjlqiy50000hrb0g2o7e4wk?embed=true';

export function ProductShowcase() {
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const [useFallback, setUseFallback] = React.useState(false);

  return (
    <section
      id="product-showcase"
      className="relative w-full bg-white max-w-[1440px] mx-auto px-6 sm:px-[64px]"
    >
      <div className="relative border-x border-[#d4d4d8] px-6 sm:px-[64px] pt-8 pb-12 flex flex-col justify-between">
        
        {/* Header Block (top-left aligned) */}
        <div className="flex flex-col items-start gap-5 max-w-[840px] mb-8">
          
          {/* Animated line motion of real provider icons from public/models */}
          <div
            className="relative w-full max-w-[280px] sm:max-w-[340px] overflow-hidden py-1"
            aria-label="Supported Providers: Gemini, Grok, OpenAI, Anthropic, DeepSeek, Meta, Mistral, Groq"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-2.5 w-max animate-[marquee_18s_linear_infinite] hover:[animation-play-state:paused]">
              {/* Duplicate array for seamless infinite looping */}
              {[...PROVIDERS, ...PROVIDERS].map((p, idx) => (
                <div
                  key={`${p.name}-${idx}`}
                  title={p.name}
                  className="size-9 sm:size-10 shrink-0 flex items-center justify-center p-2 rounded-xl border border-[#e5e5ea] bg-white shadow-2xs hover:border-[#2337ff]/40 transition-transform hover:scale-105"
                >
                  <Image
                    src={p.logo}
                    alt={p.name}
                    width={22}
                    height={22}
                    className="size-5 object-contain"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Shorter H2: Fraunces, weight 360, tight tracking */}
          <h2 className="font-serif text-[34px] sm:text-[44px] lg:text-[52px] font-[360] leading-[1.06] tracking-[-0.03em] text-[#0b0b0d]">
            Build, optimize &amp; control agents
          </h2>

          {/* Two Buttons matching the uniform hard 3D shadow aesthetic */}
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <Link
              href="/sign-up"
              className="h-12 px-7 rounded-none inline-flex items-center justify-center bg-[#0b0b0d] text-[15px] font-semibold text-white border border-black shadow-[4px_4px_0_#2337ff] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2337ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#2337ff] transition-all"
            >
              <span>Get Started</span>
            </Link>
            <Link
              href="/explore"
              className="h-12 px-6 rounded-none inline-flex items-center justify-center gap-2 bg-white text-[15px] font-semibold text-black border border-black shadow-[4px_4px_0_#d4d4d8] hover:bg-[#fafafb] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#c4c4c8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#d4d4d8] transition-all"
            >
              <span>Explore Wikis</span>
            </Link>
          </div>
        </div>

        {/* Live Stretched Wiki Container: minimal surrounding bezel, stretched content, full interactivity */}
        <div className="w-full bg-[#f8f8fa] border border-[#e5e5ea] rounded-[10px] md:rounded-[12px] p-1 box-border">
          <div className="relative w-full bg-white border border-[#e5e5ea] rounded-[8px] overflow-hidden h-[660px] md:h-[760px] xl:h-[820px] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]">
            {!useFallback ? (
              <>
                <iframe
                  src={TARGET_PATH}
                  title="RepoSense Live Wiki - Agent Architecture"
                  loading="lazy"
                  allow="clipboard-write; clipboard-read; fullscreen; web-share"
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setUseFallback(true)}
                  className="w-full h-full border-0 absolute inset-0 bg-white"
                  style={{ pointerEvents: 'auto' }}
                />
                {!iframeLoaded && (
                  <div className="absolute inset-0 bg-white flex items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-[#2337ff] animate-ping" />
                      Loading live showcase...
                    </div>
                  </div>
                )}
              </>
            ) : (
              <LandingDemoWiki />
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
