'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const TARGET_PATH = '/wiki/cmvjlqiy50000hrb0g2o7e4wk';

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

export function ProductShowcase() {
  const [iframeSrc, setIframeSrc] = React.useState<string>(TARGET_PATH);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Safety timeout: if iframe fails or is blocked by network, show error state
  React.useEffect(() => {
    if (iframeSrc && !isLoaded) {
      timerRef.current = setTimeout(() => {
        if (!isLoaded) {
          setHasError(true);
        }
      }, 14000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [iframeSrc, isLoaded]);

  const handleIframeLoad = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsLoaded(true);
    setHasError(false);
  };

  const handleIframeError = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    setIframeSrc(`${TARGET_PATH}?_r=${Date.now()}`);
  };

  return (
    <section
      id="product-showcase"
      className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] flex flex-col"
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
              className="h-12 px-6 rounded-none inline-flex items-center justify-center gap-2 bg-[#0b0b0d] text-[15px] font-semibold text-white border border-black shadow-[4px_4px_0_#2337ff] hover:bg-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2337ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#2337ff] transition-all"
            >
              <span>Get Started</span>
              <span aria-hidden="true">&#x2197;</span>
            </Link>
            <Link
              href="/explore"
              className="h-12 px-6 rounded-none inline-flex items-center justify-center gap-2 bg-white text-[15px] font-semibold text-black border border-black shadow-[4px_4px_0_#d4d4d8] hover:bg-[#fafafb] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#c4c4c8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#d4d4d8] transition-all"
            >
              <span>Explore Wikis</span>
            </Link>
          </div>
        </div>

        {/* Embed Container: Crisp framed panel with minimal surrounding gutters */}
        <div className="w-full bg-[#f8f8fa] border border-[#e5e5ea] rounded-[10px] md:rounded-[12px] p-1.5 sm:p-2 box-border">
          {/* Embed Viewport: Generous height and aspect ratio so wiki layout never compacts */}
          <div className="relative w-full bg-white border border-[#e5e5ea] rounded-[6px] md:rounded-[8px] overflow-hidden min-h-[640px] md:min-h-[760px] xl:min-h-[840px] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]">
            
            {/* Loading Skeleton */}
            <div
              className={`absolute inset-0 bg-[#fafafb] flex flex-col z-10 pointer-events-none transition-opacity duration-400 ease-out ${
                isLoaded ? 'opacity-0 invisible' : 'opacity-100 visible'
              }`}
              aria-hidden={isLoaded}
            >
              <div className="h-12 border-b border-[#ededf0] flex items-center px-5 gap-3 bg-white">
                <span className="size-2.5 rounded-full bg-[#e5e5ea]" />
                <span className="size-2.5 rounded-full bg-[#e5e5ea]" />
                <span className="size-2.5 rounded-full bg-[#e5e5ea]" />
                <div className="w-48 h-6 rounded bg-[#f0f0f4] ml-2 animate-pulse" />
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="hidden sm:flex w-[220px] border-r border-[#ededf0] p-6 flex-col gap-3 bg-[#fafafb]">
                  <div className="h-3.5 w-4/5 rounded bg-[#e9e9ed] animate-pulse" />
                  <div className="h-3.5 w-3/5 rounded bg-[#e9e9ed] animate-pulse" />
                  <div className="h-3.5 w-11/12 rounded bg-[#e9e9ed] animate-pulse" />
                  <div className="h-3.5 w-1/2 rounded bg-[#e9e9ed] animate-pulse" />
                  <div className="h-3.5 w-3/4 rounded bg-[#e9e9ed] mt-4 animate-pulse" />
                  <div className="h-3.5 w-5/6 rounded bg-[#e9e9ed] animate-pulse" />
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col gap-4 bg-white">
                  <div className="h-7 w-2/5 rounded bg-[#e9e9ed] animate-pulse" />
                  <div className="h-3.5 w-11/12 rounded bg-[#f0f0f4] animate-pulse" />
                  <div className="h-3.5 w-4/5 rounded bg-[#f0f0f4] animate-pulse" />
                  <div className="h-3.5 w-5/6 rounded bg-[#f0f0f4] animate-pulse" />
                  <div className="h-3.5 w-2/3 rounded bg-[#f0f0f4] animate-pulse" />
                  <div className="h-44 w-full rounded-lg bg-[#f4f4f7] mt-3 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Error State with retry and fallback link */}
            {hasError && (
              <div
                className="absolute inset-0 bg-white flex flex-col items-center justify-center z-20 p-6 text-center"
                role="alert"
              >
                <div className="size-11 rounded-full bg-[#fef2f2] border border-[#fee2e2] text-[#ef4444] inline-flex items-center justify-center mb-4">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-[#0b0b0d] mb-1.5">
                  Unable to load live showcase
                </h3>
                <p className="text-sm text-[#47474e] max-w-[420px] mb-5 leading-relaxed">
                  The embedded preview could not be loaded directly. You can retry loading or open the interactive showcase directly in a new tab.
                </p>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="h-10 px-5 rounded-none inline-flex items-center justify-center bg-[#0b0b0d] text-sm font-semibold text-white border border-black shadow-[3px_3px_0_#2337ff] hover:bg-black transition-all"
                  >
                    Retry
                  </button>
                  <a
                    href={TARGET_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-5 rounded-none inline-flex items-center justify-center border border-black bg-white text-sm font-semibold text-black shadow-[3px_3px_0_#d4d4d8] hover:bg-[#fafafb] transition-all"
                  >
                    <span>Open in new tab</span>
                    <span aria-hidden="true">&nearr;</span>
                  </a>
                </div>
              </div>
            )}

            {/* Live Interactive iframe: never unmounted once loaded */}
            {iframeSrc && (
              <iframe
                src={iframeSrc}
                title="RepoSense Live Product Showcase - Agent &amp; Architecture Wiki"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write; clipboard-read; fullscreen; web-share"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                className="w-full h-full border-0 absolute inset-0 bg-white"
                style={{ pointerEvents: 'auto' }}
              />
            )}

          </div>
        </div>

      </div>
    </section>
  );
}
