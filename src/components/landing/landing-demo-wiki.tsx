'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  GitPullRequest,
  Share2,
  ChevronRight,
  FileCode2,
  Send,
  ExternalLink,
} from 'lucide-react';
import { cn } from '~/lib/utils';

interface WikiSection {
  title: string;
  pages: {
    slug: string;
    title: string;
    content: React.ReactNode;
    headings: string[];
    files: string[];
  }[];
}

const DEMO_SECTIONS: WikiSection[] = [
  {
    title: 'Overview',
    pages: [
      {
        slug: 'overview',
        title: 'Overview',
        files: ['src/index.ts', 'src/server/app.ts', 'package.json'],
        headings: [
          'Overview',
          'Project Structure',
          'Key Architectural Principles',
          'Execution Flow',
          'API Endpoints',
          'Task Lifecycle',
          'Operational Considerations',
        ],
        content: (
          <div className="space-y-6 text-[#18181b] leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">Overview</h1>
              <p className="text-[14px] text-muted-foreground leading-6">
                The <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">TaskFlow</code> repository is a TypeScript-based project designed to automate task management through a modular architecture. This document provides an overview of the repository's structure, key components, and operational details.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2">Project Structure</h2>
              <p className="text-[14px] text-muted-foreground leading-6 mb-3">
                The repository is organized into several key directories, each serving a specific purpose within the application:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-muted-foreground">
                <li><code className="font-mono text-xs text-foreground bg-muted/60 px-1 py-0.5 rounded">src/server/</code>: Manages the HTTP transport layer and API routes.</li>
                <li><code className="font-mono text-xs text-foreground bg-muted/60 px-1 py-0.5 rounded">src/tasks/</code>: Houses the asynchronous execution engines and worker loops.</li>
                <li><code className="font-mono text-xs text-foreground bg-muted/60 px-1 py-0.5 rounded">src/db/</code>: Encapsulates schema definitions, Prisma ORM, and pgvector clients.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2">Key Architectural Principles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="border border-border/60 rounded-md p-3 bg-muted/20">
                  <div className="text-[13px] font-semibold text-foreground mb-1">State Isolation</div>
                  <div className="text-xs text-muted-foreground">Every pipeline run executes in an immutable workspace with state captured at exact commit SHAs.</div>
                </div>
                <div className="border border-border/60 rounded-md p-3 bg-muted/20">
                  <div className="text-[13px] font-semibold text-foreground mb-1">Vector Indexing</div>
                  <div className="text-xs text-muted-foreground">Source tokens are chunked by AST nodes with line-level offsets for instant retrieval.</div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Architecture',
    pages: [
      {
        slug: 'architecture',
        title: 'Architecture',
        files: ['src/core/router.ts', 'src/core/dispatcher.ts'],
        headings: ['System Architecture', 'Dispatch Pipeline', 'Failure Modes'],
        content: (
          <div className="space-y-4 text-[#18181b]">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">System Architecture</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              TaskFlow relies on an event-driven architecture with zero background daemon overhead on idle. Tasks are enqueued via typed RPC routes and processed concurrently with backpressure guarantees.
            </p>
          </div>
        ),
      },
      {
        slug: 'runtime-lifecycle',
        title: 'Runtime Lifecycle',
        files: ['src/lifecycle/init.ts', 'src/lifecycle/teardown.ts'],
        headings: ['Bootstrap Flow', 'Teardown Sequences'],
        content: (
          <div className="space-y-4 text-[#18181b]">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Runtime Lifecycle</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              On boot, connection pools to PostgreSQL Neon instances are warmed, environment vaults decrypted, and AST cache trees verified before accepting traffic.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Data Flow',
    pages: [
      {
        slug: 'data-flow',
        title: 'Data Flow',
        files: ['src/db/schema.prisma', 'src/db/queries.ts'],
        headings: ['Ingestion Flow', 'Cosine Vector Queries'],
        content: (
          <div className="space-y-4 text-[#18181b]">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Data Flow</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              High-throughput ingestion streams repository blobs into in-memory buffers before emitting normalized markdown nodes directly to the generator.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Setup and Workflow',
    pages: [
      {
        slug: 'setup-workflow',
        title: 'Setup Workflow',
        files: ['docker-compose.yml', 'README.md'],
        headings: ['Prerequisites', 'Installation', 'Environment Variables'],
        content: (
          <div className="space-y-4 text-[#18181b]">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Setup Workflow</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">pnpm install</code> followed by database provisioning to launch locally in under 30 seconds.
            </p>
          </div>
        ),
      },
    ],
  },
];

export function LandingDemoWiki() {
  const [activeSlug, setActiveSlug] = React.useState('overview');
  const [qaInput, setQaInput] = React.useState('');
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  const activePage = React.useMemo(() => {
    for (const section of DEMO_SECTIONS) {
      for (const page of section.pages) {
        if (page.slug === activeSlug) return page;
      }
    }
    return DEMO_SECTIONS[0]!.pages[0]!;
  }, [activeSlug]);

  const handleAsk = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!qaInput.trim()) return;
    const q = qaInput.trim();
    setQaInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      {
        role: 'assistant',
        text: `In TaskFlow, "${q}" is handled through the modular architecture outlined in \`src/server/app.ts\`. Execution state is isolated per commit revision with real-time vector grounding.`,
      },
    ]);
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-foreground overflow-hidden font-sans select-none">
      {/* Top Navigation Header: Exact replica of Wiki Header without empty gutters */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#ececec] px-4 sm:px-6 bg-white">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="RepoSense" className="size-5 rounded object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-[#0b0b0d]">RepoSense</span>
          <span className="text-[#8d8d95] font-light">/</span>
          <span className="text-[14px] font-normal text-[#47474e]">Ethan4582/TaskFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] border border-[#e5e5ea] text-xs font-medium text-[#47474e] hover:bg-[#f8f8fa] transition-colors"
          >
            <GitPullRequest className="size-3.5" />
            <span>Pull Requests</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[6px] bg-[#2563eb] text-xs font-medium text-white hover:bg-[#1d4ed8] shadow-xs transition-colors"
          >
            <Share2 className="size-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Main Body: 3-column Layout without artificial gaps */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: Wiki Table of Contents */}
        <aside className="w-[220px] sm:w-[240px] shrink-0 border-r border-[#ececec] bg-[#fafafb] overflow-y-auto p-4 space-y-5 text-left">
          <div className="text-[11px] font-mono text-[#8d8d95] uppercase tracking-wider">
            Last edited: Oct 24, 2026
          </div>

          <nav className="space-y-4">
            {DEMO_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <div className="text-[13px] font-semibold text-[#0b0b0d]">{section.title}</div>
                <div className="space-y-0.5">
                  {section.pages.map((p) => {
                    const isActive = p.slug === activeSlug;
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => setActiveSlug(p.slug)}
                        className={cn(
                          'relative flex w-full items-center justify-between py-1.5 px-2.5 rounded text-left text-[13px] transition-colors',
                          isActive
                            ? 'bg-white font-medium text-[#0b0b0d] shadow-xs border border-[#e5e5ea]'
                            : 'text-[#47474e] hover:bg-neutral-200/50 hover:text-[#0b0b0d]'
                        )}
                      >
                        {isActive ? (
                          <span className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-full bg-[#2563eb]" />
                        ) : null}
                        <span className="truncate">{p.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Center Column: Documentation Article Viewport */}
        <main className="relative flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-6 bg-white">
          <div className="max-w-[760px] mx-auto pb-24">
            {/* Relevant Files Pill */}
            {activePage.files.length > 0 && (
              <details className="group mb-5 rounded-md border border-[#ececec] bg-[#f8f8fa] px-3.5 py-2 text-xs">
                <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-[#47474e] hover:text-[#0b0b0d]">
                  <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                  <span>Relevant source files</span>
                  <span className="rounded-full bg-[#e5e5ea] px-1.5 py-0.2 text-[10px] font-semibold text-[#47474e]">
                    {activePage.files.length}
                  </span>
                </summary>
                <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1">
                  {activePage.files.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#e5e5ea] font-mono text-[11px] text-[#0b0b0d]"
                    >
                      <FileCode2 className="size-3 text-[#2563eb]" />
                      {f}
                    </span>
                  ))}
                </div>
              </details>
            )}

            {/* Rendered Page Content */}
            {activePage.content}
          </div>

          {/* Floating Grounded QA Bar: pinned to bottom of reader */}
          <div className="sticky bottom-4 left-0 right-0 mx-auto max-w-[560px] z-20">
            {messages.length > 0 && (
              <div className="mb-2 max-h-[160px] overflow-y-auto rounded-lg border border-[#e5e5ea] bg-white p-3 shadow-lg space-y-2 text-xs">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <span
                      className={cn(
                        'inline-block px-2.5 py-1.5 rounded-md leading-relaxed',
                        m.role === 'user' ? 'bg-[#0b0b0d] text-white' : 'bg-[#f4f4f5] text-[#18181b]'
                      )}
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleAsk}
              className="flex items-center gap-2 rounded-xl border border-[#e5e5ea] bg-white/95 backdrop-blur-md px-3 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
            >
              <input
                type="text"
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                placeholder="Ask about Ethan4582/TaskFlow..."
                className="flex-1 bg-transparent text-xs text-[#0b0b0d] placeholder:text-[#8d8d95] outline-none"
              />
              <span className="text-[10px] font-mono text-[#8d8d95] border border-[#e5e5ea] px-1.5 py-0.5 rounded">
                GPT-4o
              </span>
              <button
                type="submit"
                className="size-6 rounded-full bg-[#0b0b0d] text-white inline-flex items-center justify-center hover:bg-black transition-colors"
                title="Send query"
              >
                <Send className="size-3" />
              </button>
            </form>
          </div>
        </main>

        {/* Right Column: "On this page" Headings Navigation */}
        <aside className="hidden lg:block w-[180px] xl:w-[210px] shrink-0 border-l border-[#ececec] p-5 overflow-y-auto text-left bg-white">
          <div className="text-[13px] font-semibold text-[#0b0b0d] mb-3">On this page</div>
          <ul className="space-y-2 text-[12px] text-[#8d8d95]">
            {activePage.headings.map((h, i) => (
              <li key={i} className="hover:text-[#0b0b0d] cursor-pointer transition-colors leading-snug">
                {h}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
