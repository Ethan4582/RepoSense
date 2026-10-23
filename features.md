### Task: Fix Critical Wiki Bugs, Spacing, Citations, and Auth Flow

Refactor and fix the following critical UI and functional issues in the DeepWiki documentation platform. Do not implement Codemap or Agentic loops yet; focus strictly on stability, spacing, and bug fixes.

#### 1. Fix Layout Spacing & Margin Alignment
- Refactor the main layout container to match our wireframe:
  - Center the entire 3-column layout inside `max-w-[1280px] mx-auto` with generous horizontal browser margins (`px-6 md:px-12`).
  - Add explicit vertical divider borders (`border-r border-border/40` and `border-l border-border/40`) separating the left navigation, center reading area, and right TOC.
  - The left "WIKI PAGES" column must be permanently visible (`w-[240px] shrink-0`). Remove the close cross icon (`✕`).
  - Constrain the floating bottom chat bar strictly within the center column boundaries rather than stretching across sidebars.

#### 2. Fix Right TOC Click-to-Scroll & Scroll Spying
- In the markdown renderer, integrate `rehype-slug` to generate deterministic HTML `id` attributes for all `h2` and `h3` tags.
- Add `scroll-mt-24` utility classes to headings so scroll targets are not concealed behind top headers.
- Wire the "On this page" right-sidebar links to `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`.
- Ensure all 3 columns scroll independently (`overflow-y-auto h-[calc(100vh-3.5rem)]`).

#### 3. Fix Referenced Code Line Highlighting & Modern Code Inspector
- Replace the cream/yellow background (`#fff9db`) in the code viewer with modern line highlighting:
  - Active line range: `bg-primary/[0.08]` with a `2px border-l border-primary`.
  - Fix default `L1-1` behavior: Read the citation's actual `startLine` and `endLine` from chunk metadata, pass them to the code viewer, and auto-scroll the viewer to `startLine`.

  #### 5. Auth & Public Access Fixes
- Fix Clerk sign-out: Ensure `useClerk().signOut()` properly terminates sessions and redirects cleanly to `/sign-in`.
- Fix Public Wiki Double-Reload: Ensure the public repository endpoint (`/api/public/wiki/[id]`) serves public wikis immediately to unauthenticated requests without waiting for client-side Clerk session hydration.

#### 6. Single-Turn Bookmarking in Multi-Turn Sessions
- In the Q&A thread, give each question-answer turn its own isolated Bookmark button.
- Saving a turn persists its specific `questionText`, `answerMarkdown`, and `citedFiles` array into the `Question` table.
- On `/qa`, render cards for each saved question that rehydrate that exact snapshot directly from Postgres without issuing duplicate LLM calls.