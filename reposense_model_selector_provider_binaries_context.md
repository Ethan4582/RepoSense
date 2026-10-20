# Task: Upgrade RepoSense Pull Requests Page with Essential T3 Code Filters & Notion Minimalism

## Context & Current State
The Pull Requests page currently displays basic status pills (`All (0)`, `Open (0)`, `Closed (0)`) and a simple search bar. When users work with multiple repositories or multiple threads across projects, they need clean, focused filters inspired by T3 Code—without unnecessary clutter.

The visual style must blend **T3 Code ergonomics** (fast keyboard-friendly filters, quick pill toggles, slide-over PR inspector) with **Notion-style minimalism** (borderless or subtle 1px dividers, zero bulky box-in-box cards, clean typographic hierarchy).

---

## Key Requirements

### 1. Essential Filter Bar (T3 Code-Inspired)
Replace the rigid filter row with a flexible, compact toolbar:

1. **Repository Selector Dropdown:**
   - Option: `All Linked Repositories` or select a specific project/repo (e.g., `Ethan4582/RepoSense`, `user/repo-b`).
   - Essential for users managing multiple repositories across threads.
2. **Status Pills (with Live Counts):**
   - `All (count)` · `Open (count)` (emerald accent) · `Merged (count)` (purple accent) · `Draft (count)` (zinc accent) · `Closed (count)` (neutral).
3. **Quick Attribute Filters (Dropdowns or Compact Pills):**
   - **Author / Scope:** `All Authors` vs. `Created by Me` (or current user session).
   - **Sort By:** `Recently Updated` (default) · `Newest` · `Oldest`.
4. **Instant Search Input:**
   - Real-time search across PR title, PR `#ID`, branch name, and author handle.
   - Shows a clear `(x)` reset button and active match indicator.

---

### 2. Upgraded PR List Item Anatomy (T3 + Notion Style)
Eliminate nested card containers. Render PR items as clean, high-density interactive rows or minimal document blocks:
- **Left Column:** 
  - Status Icon: Git PR icon colored by state (Green = Open, Purple = Merged, Gray = Draft/Closed).
  - Title & PR Number: `#142 Refactor embedding pipeline to Cloudflare Workers`.
  - Branch Flow: `feature/vector-edge` → `main`.
  - Author avatar + username + relative timestamp (`updated 2h ago`).
- **Right Column:**
  - Diff stats badge: `+248 / -32`.
  - Repository badge (when `All Repositories` is selected): `Ethan4582/RepoSense`.
  - Quick Actions: `Open in GitHub ↗` and `Inspect AI Summary`.

---

### 3. T3-Style Slide-Over Drawer (On Row Click)
Clicking any PR row opens a sleek slide-over panel on the right:
- **Header:** PR title, GitHub status badge, branch comparison, and direct link to GitHub.
- **AI Summary Callout:** High-level bullet points summarizing the changes and impacted modules.
- **Changed Files List:** Tree or compact list of touched files with addition/deletion bars.

---

### 4. Technical & Cloudflare Safety Constraints
- **Cloudflare Runtime Compatibility:** Ensure all backend queries use native Web `fetch` (via Octokit/REST API) with zero Node-only C++ dependencies or Axios.
- **Backend tRPC Procedure:** Extend `project.getPullRequests` to accept:
  ```ts
  input: z.object({
    projectId: z.string().optional(), // optional to allow fetching across user's repos
    state: z.enum(['all', 'open', 'closed', 'merged']).default('all'),
    author: z.string().optional(),
    search: z.string().optional(),
  })
