import * as React from 'react';

interface SectionBoundaryProps {
  tag?: string;
  isHeroEnd?: boolean;
}

export function SectionBoundary({ tag = '01 CLIENTS', isHeroEnd = false }: SectionBoundaryProps) {
  if (isHeroEnd) {
    return (
      <div className="relative -mx-6 sm:-mx-[64px] w-[calc(100%+48px)] sm:w-[calc(100%+128px)] overflow-visible">
        {/* Full content-width rule */}
        <div className="w-full border-t border-[#ececec]" />

        {/* Left Diamond Intersection (14px wide, stroke 1.5px, #111111) */}
        <svg
          width="14"
          height="8"
          viewBox="0 0 14 8"
          fill="#ffffff"
          className="pointer-events-none absolute left-0 -top-[4px] -translate-x-1/2 z-30"
          aria-hidden="true"
        >
          <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
        </svg>

        {/* Right Diamond Intersection (14px wide, stroke 1.5px, #111111) */}
        <svg
          width="14"
          height="8"
          viewBox="0 0 14 8"
          fill="#ffffff"
          className="pointer-events-none absolute right-0 -top-[4px] translate-x-1/2 z-30"
          aria-hidden="true"
        >
          <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
        </svg>

        {/* Attached Section Tag with notched corner */}
        {tag && (
          <div className="flex justify-end pr-0">
            <div className="inline-flex items-center gap-2 pl-3 pr-4 py-1.5 bg-white border-l border-b border-[#ececec] font-mono text-[11px] uppercase tracking-[0.04em] text-[#47474e] -mt-[1px]">
              <span className="size-[7px] bg-[#2337ff] inline-block shrink-0" />
              <span className="font-medium whitespace-nowrap">{tag}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-visible">
      {/* Edge-to-edge horizontal rule spanning the entire viewport */}
      <div className="w-screen relative left-1/2 -translate-x-1/2 border-t border-[#ececec]" />

      {/* Guide line alignment frame */}
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-[64px] relative pointer-events-none">
        {/* Left Diamond centered on left vertical frame line */}
        <svg
          width="14"
          height="8"
          viewBox="0 0 14 8"
          fill="#ffffff"
          className="absolute left-6 sm:left-[64px] -top-[4px] -translate-x-1/2 z-30 pointer-events-none"
          aria-hidden="true"
        >
          <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
        </svg>

        {/* Right Diamond centered on right vertical frame line */}
        <svg
          width="14"
          height="8"
          viewBox="0 0 14 8"
          fill="#ffffff"
          className="absolute right-6 sm:right-[64px] -top-[4px] translate-x-1/2 z-30 pointer-events-none"
          aria-hidden="true"
        >
          <polygon points="7,0.5 13.5,4 7,7.5 0.5,4" stroke="#111111" strokeWidth="1.5" />
        </svg>

        {/* Attached Section Tag notched inside the vertical line */}
        {tag && (
          <div className="absolute right-6 sm:right-[64px] top-0 pointer-events-auto z-20">
            <div className="inline-flex items-center gap-2 pl-3 pr-4 py-1.5 bg-white border-l border-b border-[#ececec] font-mono text-[11px] uppercase tracking-[0.04em] text-[#47474e] -mt-[1px]">
              <span className="size-[7px] bg-[#2337ff] inline-block shrink-0" />
              <span className="font-medium whitespace-nowrap">{tag}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
