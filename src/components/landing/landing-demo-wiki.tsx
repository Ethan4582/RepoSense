'use client';

import * as React from 'react';
import {
  GitPullRequest,
  Share2,
  ChevronRight,
  FileCode2,
  Send,
} from 'lucide-react';
import { cn } from '~/lib/utils';

interface WikiPage {
  slug: string;
  title: string;
  files: string[];
  headings: string[];
  content: React.ReactNode;
}

interface WikiSection {
  title: string;
  pages: WikiPage[];
}

const DEMO_SECTIONS: WikiSection[] = [
  {
    title: 'VS Code Architecture Overview',
    pages: [
      {
        slug: 'multi-process-model',
        title: 'Multi-Process Model',
        files: ['src/vs/workbench/browser/web.main.ts:1-48', 'package.json:9-12'],
        headings: [
          'Multi-Process Model',
          'Main Process',
          'Renderer Process',
          'Extension Host Process',
          'Utility Processes',
          'Remote Extension Host (REH)',
        ],
        content: (
          <div className="space-y-6 text-[#18181b] leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">Multi-Process Model</h1>
              <p className="text-[14px] text-muted-foreground leading-6">
                VS Code distributes responsibility across multiple processes to maintain UI responsiveness under heavy workloads such as syntax analysis, running extensions, or terminal emulation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f4f4f5] border border-[#e4e4e7] font-mono text-[#09090b]">
                <FileCode2 className="size-3.5 text-[#2563eb]" />
                src/vs/workbench/browser/web.main.ts <span className="text-[#71717a]">1-48</span>
              </span>
            </div>

            <ul className="space-y-3.5 text-[14px] text-muted-foreground">
              <li className="leading-6">
                <strong className="text-foreground font-semibold">Main Process:</strong> The Electron main process controls the overall application lifecycle, window management, native OS integrations, and handles command-line arguments. Core main entry points include <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">CodeMain</code> and interfaces like <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">IWindowsMainService</code> that create and own window instances.
              </li>
              <li className="leading-6">
                <strong className="text-foreground font-semibold">Renderer Process:</strong> Each visible editor window runs its own renderer process hosting the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">Workbench</code> UI layer. This includes all UI components—editor groups, sidebars, activity bar, status bar, and embedded Monaco editor.
              </li>
              <li className="leading-6">
                <strong className="text-foreground font-semibold">Extension Host Process:</strong> Isolated processes running VS Code extensions separate from the UI thread, communicating asynchronously using RPC protocols. This sandboxing ensures robustness and security.
              </li>
              <li className="leading-6">
                <strong className="text-foreground font-semibold">Utility Processes:</strong> Dedicated child processes serve background tasks including terminal PTY hosts, file system watchers, and search indexing to keep the UI performant.
              </li>
              <li className="leading-6">
                <strong className="text-foreground font-semibold">Remote Extension Host (REH):</strong> Specialized hosts running extensions remotely on containers, SSH, WSL, or cloud servers, enabling remote development scenarios backed by protocols and remote agent services.
              </li>
            </ul>
          </div>
        ),
      },
      {
        slug: 'repository-structure-and-build-system',
        title: 'Repository Structure and Build System',
        files: ['build/gulpfile.js', 'package.json:15-40', 'tsconfig.json'],
        headings: ['Build Pipelines', 'Layer Layering Invariants', 'Compile Targets'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Repository Structure and Build System</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              The codebase enforces strict unidirectional dependency boundaries. Code inside <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">vs/base</code> cannot depend on <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">vs/platform</code> or higher layers.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2 text-xs">
              <div className="font-semibold text-foreground text-sm">Layer Boundaries:</div>
              <div className="font-mono text-muted-foreground">base/ &rarr; platform/ &rarr; editor/ &rarr; workbench/</div>
            </div>
          </div>
        ),
      },
      {
        slug: 'core-architectural-layers',
        title: 'Core Architectural Layers',
        files: ['src/vs/base/common/lifecycle.ts', 'src/vs/platform/instantiation/common/instantiation.ts'],
        headings: ['Dependency Injection Container', 'Disposable Pattern', 'Service Collections'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Core Architectural Layers</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Dependency injection is driven by the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">createDecorator</code> service descriptor pattern. Memory management is unified under the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">IDisposable</code> lifecycle tracker.
            </p>
          </div>
        ),
      },
      {
        slug: 'getting-started-development',
        title: 'Getting Started: Development Environment',
        files: ['README.md', '.vscode/launch.json'],
        headings: ['Prerequisites', 'Bootstrap Instructions', 'Running Locally'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Development Environment Setup</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Clone the repository, verify Node.js requirements, and launch yarn run watch to spin up the incremental TypeScript compilation daemon.
            </p>
          </div>
        ),
      },
      {
        slug: 'contribution-workflow',
        title: 'Contribution Workflow and Repo Automation',
        files: ['.github/workflows/ci.yml', '.github/PULL_REQUEST_TEMPLATE.md'],
        headings: ['Issue Triage Bot', 'PR Verification Gates'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Contribution Workflow & Automation</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Automated lint, hygiene checks, build matrix compilation, and regression test suites gate incoming contributions before maintainer triage.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Electron Main Process',
    pages: [
      {
        slug: 'app-lifecycle-window-mgmt',
        title: 'Application Lifecycle and Window Management',
        files: ['src/vs/code/electron-main/main.ts', 'src/vs/platform/windows/electron-main/windows.ts'],
        headings: ['Startup Protocol', 'State Hydration', 'Graceful Shutdown'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Application Lifecycle and Window Management</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Handles single-instance socket locks, restore session state, and native window recreation on reboot with seamless GPU acceleration handoffs.
            </p>
          </div>
        ),
      },
      {
        slug: 'cli-and-environment-services',
        title: 'CLI and Environment Services',
        files: ['src/vs/code/node/cliProcessMain.ts', 'src/vs/platform/environment/node/environmentService.ts'],
        headings: ['Argument Parsing', 'Path Resolution', 'Tunnel Connections'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CLI and Environment Services</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Processes command line flags like <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">--diff</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">--goto</code>, and sets up temporary telemetry and profile directory overrides.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Workbench UI Framework',
    pages: [
      {
        slug: 'layout-parts-system',
        title: 'Layout and Parts System',
        files: ['src/vs/workbench/browser/layout.ts', 'src/vs/workbench/browser/part.ts'],
        headings: ['Grid View Partitioning', 'Sash Resizing Engine', 'Active Part Routing'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Layout and Parts System</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Manages the flexible split-view grid system for editor panes, side panels, auxiliary bars, and terminal tabs with sub-pixel sash coordinate alignment.
            </p>
          </div>
        ),
      },
      {
        slug: 'editor-groups-service',
        title: 'Editor Groups and Editor Service',
        files: ['src/vs/workbench/services/editor/common/editorService.ts'],
        headings: ['Editor History Stack', 'Split Orientations', 'Model Binding'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Editor Groups and Editor Service</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Resolves resource URIs into text, binary, or custom editor models with dirty state tracking and undo-redo transaction stacks.
            </p>
          </div>
        ),
      },
      {
        slug: 'theming-icons-styling',
        title: 'Theming, Icons, and Styling',
        files: ['src/vs/platform/theme/common/themeService.ts'],
        headings: ['Color Tokens Registry', 'Custom Icon Fonts', 'Semantic Highlighting'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Theming, Icons, and Styling</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Dynamic CSS injection compiles theme tokens into root variables while applying TextMate syntax tokens and tree icon themes.
            </p>
          </div>
        ),
      },
      {
        slug: 'settings-keybindings',
        title: 'Settings, Keybindings, and Configuration',
        files: ['src/vs/platform/configuration/common/configurationService.ts'],
        headings: ['Cascading Overrides', 'Keybinding Resolver', 'Telemetry Policy'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings, Keybindings, and Configuration</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              Multi-tiered JSON configuration evaluation prioritizing workspace folder settings over global user defaults with hot-reload JSON schema validation.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    title: 'Monaco Editor Core',
    pages: [
      {
        slug: 'text-buffer-piece-tree',
        title: 'Piece Tree Text Buffer Model',
        files: ['src/vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBuffer.ts'],
        headings: ['Red-Black Balance', 'Line Offset Table', 'Memory Overhead'],
        content: (
          <div className="space-y-5 text-[#18181b] leading-relaxed">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Piece Tree Text Buffer Model</h1>
            <p className="text-[14px] text-muted-foreground leading-6">
              High-performance balanced binary search tree for document modifications, offering O(log N) line lookup and string insertion without allocating multi-megabyte strings.
            </p>
          </div>
        ),
      },
    ],
  },
];

export function LandingDemoWiki() {
  const [activeSlug, setActiveSlug] = React.useState('multi-process-model');
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
        text: `In microsoft/vscode, "${q}" is coordinated through the main process and dispatched across dedicated worker threads with IPC channels.`,
      },
    ]);
  };

  return (
    <div className="flex h-full w-full flex-col bg-white text-foreground overflow-hidden font-sans select-none">
      {/* Top Navigation Header */}
      <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-[#ececec] px-4 sm:px-6 bg-white z-10">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="RepoSense" className="size-5 rounded object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-[#0b0b0d]">RepoSense</span>
          <span className="text-[#8d8d95] font-light">/</span>
          <span className="text-[14px] font-normal text-[#47474e]">microsoft/vscode</span>
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

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: Detailed TOC */}
        <aside className="w-[230px] sm:w-[260px] shrink-0 border-r border-[#ececec] bg-[#fafafb] overflow-y-auto p-4 space-y-5 text-left">
          <div className="text-[11px] font-mono text-[#8d8d95] uppercase tracking-wider">
            Last indexed: 24 Oct 2026 (v1.94)
          </div>

          <nav className="space-y-4">
            {DEMO_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="text-[12px] font-semibold text-[#0b0b0d] px-1">{section.title}</div>
                <div className="space-y-0.5">
                  {section.pages.map((p) => {
                    const isActive = p.slug === activeSlug;
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => setActiveSlug(p.slug)}
                        className={cn(
                          'relative flex w-full items-center justify-between py-1.5 px-2.5 rounded text-left text-[12.5px] transition-colors',
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

        {/* Center Column: Documentation Article Viewport with Fixed-to-Bottom QA Bar */}
        <div className="relative flex-1 min-w-0 flex flex-col h-full bg-white">
          {/* Scrollable Article Area */}
          <main className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-6">
            <div className="max-w-[760px] mx-auto pb-10">
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
          </main>

          {/* Grounded QA Bar: pinned to bottom of container */}
          <div className="w-full shrink-0 border-t border-[#ececec]/80 bg-white/95 backdrop-blur-xs p-3.5 flex flex-col items-center z-20">
            {messages.length > 0 && (
              <div className="w-full max-w-[560px] mb-2.5 max-h-[140px] overflow-y-auto rounded-lg border border-[#e5e5ea] bg-white p-3 shadow-sm space-y-2 text-xs">
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
              className="flex items-center gap-2 w-full max-w-[560px] rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 shadow-xs"
            >
              <input
                type="text"
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                placeholder="Ask about microsoft/vscode..."
                className="flex-1 bg-transparent text-xs text-[#0b0b0d] placeholder:text-[#8d8d95] outline-none"
              />
              <span className="text-[10px] font-mono text-[#8d8d95] border border-[#e5e5ea] px-1.5 py-0.5 rounded">
                Fast &middot; GPT-4o
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
        </div>

        {/* Right Column: "On this page" Headings Navigation */}
        <aside className="hidden lg:block w-[190px] xl:w-[220px] shrink-0 border-l border-[#ececec] p-5 overflow-y-auto text-left bg-white">
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
