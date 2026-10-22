eepWiki Frontend UI Realignment Specification (plan.md)

This specification provides the authoritative UI instructions for Anti-Gravity / Claude CLI to match the exact geometry drawn in the architectural layout wireframe.

The core requirement is a floating, centered 3-column stage with generous empty gutters on both sides of the browser window, distinct vertical divider borders, and a tightly constrained center content width.

1. Layout & Geometry (Wireframe Parity)

  [Left Browser Margin: 10-14vw]                                                     [Right Browser Margin: 10-14vw]
◄──────────────────────────────►                                                  ◄──────────────────────────────►
                               ┌─────────────────────────────────────────────────┐
                               │ owner / repo  [Public]   [Edit Wiki] [PRs] [Share][ dark/light button]  │
                               ├───────────────┬─────────────────┬───────────────┤
                               │               │                 │               │
                               │  Different    │   Center        │  Content      │
                               │  pages in     │   Article       │  on the       │
                               │  the wiki     │   Content       │  page (TOC)   │
                               │               │   (Constrained) │               │
                               │  (Scrollable) │                 │  (Scrollable) │
                               │               │                 │               │
                               │               │ ┌─────────────┐ │               │
                               │               │ │ Chat Dock   │ │               │
                               │               │ └─────────────┘ │               │
                               └───────────────┴─────────────────┴───────────────┘


1.1 The Floating Centered Stage

Never Bleed to Browser Edges: The entire 3-column documentation application must float in the middle of the viewport.

Stage Wrapper:

Width constraint: max-w-[1240px] xl:max-w-[1280px] mx-auto

Viewport inset padding: px-6 md:px-10 lg:px-12

This guarantees that wide screens have massive whitespace margins on the left and right (matching the wireframe).

Grid Architecture:

Define three distinct columns with clean vertical hairline separators:

<div className="w-full max-w-[1280px] mx-auto grid grid-cols-[210px_minmax(0,1fr)_200px] h-[calc(100vh-3.5rem)]">
  <!-- Left Column: Wiki Hierarchy -->
  <aside className="border-r border-border/50 px-4 py-6 overflow-y-auto scrollbar-thin">
    ...
  </aside>

  <!-- Center Column: Main Reading Stage -->
  <main className="px-8 lg:px-12 py-6 overflow-y-auto scrollbar-thin relative scroll-smooth pb-32">
    ...
  </main>

  <!-- Right Column: Table of Contents / On this page -->
  <aside className="border-l border-border/50 px-4 py-6 overflow-y-auto scrollbar-thin">
    ...
  </aside>
</div>


1.2 Permanent Left Hierarchy (Zero Close Button)

Remove the ✕ close button entirely.

The left column (Different pages in the wiki) remains permanently visible and anchored to its slot.

Do not allow the left sidebar to collapse or overlay onto the center content.

1.3 Floating Dock Restricted to Center Column

As drawn in the wireframe, the bottom chat dock is docked strictly within the center reading column, never spanning across the left or right columns.

Container positioning:

Anchor within the center column: sticky bottom-4 mx-auto w-full max-w-xl

Surface styling: bg-background/90 backdrop-blur-md border border-border/70 shadow-lg rounded-2xl p-2.5 flex items-center gap-3

2. Top Navigation Bar (Minimal & Clean)

No RepoSense Logo or Brand Wordmark: Remove the logo icon and the "RepoSense" wordmark completely.

Repository Coordinates (Left):

Display only owner / repo in clean medium-weight type.

Followed by the status badge (Public / Private) and branch tag (main).

Action Buttons (Right):

[Edit Wiki] — Ghost/outline pill button to toggle edit mode.

[Pull Requests] — Outline pill button routing directly to the repository PRs page.

[Share] — Pill button to copy the shareable link.

[☼] — Theme toggle button (light/dark mode).

Eliminate Header Bloat: Remove the "Enter email to refresh" box, account gear icons, and unnecessary metadata from the header.

3. Left-Margin Hover App Drawer

The global workspace navigation (Dashboard, Repositories, Meetings, API Keys) lives in the empty left margin of the browser.

Place an invisible hover detector along the far-left browser margin (fixed left-0 top-0 bottom-0 w-8 z-40).

Hovering slides out an off-canvas navigation drawer (w-72 bg-background border-r shadow-2xl z-50).

Leaving the drawer closes it smoothly without reflowing or shifting the centered 3-column stage.

4. "On This Page" Anchor Jump & Scroll-Spy

4.1 Working Click-to-Scroll

Inject slugified IDs into all markdown h2 and h3 tags using rehype-slug.

Add scroll-mt-20 on all headings so the fixed top navigation does not occlude the heading text upon jump.

Clicking any item in the right column triggers smooth scrolling:

const target = document.getElementById(slug);
if (target) {
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


4.2 Dynamic Scroll-Spy

Attach an IntersectionObserver to all headings in the center scrollable container.

Highlight the active section in the right TOC with text-primary font-medium border-l-2 border-primary -ml-[1px] pl-2.

5. Interactive Citation Badges (CitationPill.tsx)

Parse all markdown occurrences of [[filepath:start-end]] and [[filepath:line]] into interactive pill components:

GitHub icon + monospace relative path + shaded line range tag (1-48).

Click Action:

Opens the GitHub permalink in a new tab:
https://github.com/{owner}/{repo}/blob/{commitHash}/{filePath}#L{startLine}-L{endLine}

Or opens the split-pane Code Viewer scrolled directly to that line range.

Zero raw brackets ([[...]]) must leak into the rendered prose.

6. Modern Split-Pane Code Inspector

When inspecting code, replace the right column or open a split pane.

Remove Yellow Highlighting: Replace #fff9db line highlighting with a clean, theme-aware blue tint: rgba(18, 109, 251, 0.08) and a 2px solid #126dfb left border.

Header Tabs: Display clean tabs for multiple files with active file paths and line ranges.