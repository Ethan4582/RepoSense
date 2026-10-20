# RepoSense UI/UX Design Specification & Architecture
## T3 Code Ergonomics x Minimalist Notion Architecture (Cloudflare-Ready)

---

## 1. Executive Summary & Design Vision

### 1.1 The Hybrid Philosophy
RepoSense combines the focused developer ergonomics of **T3 Code** with the clean, breathing document elegance of **Notion**:
- **Zero Boxy Clutter:** Eradicates the "card-inside-card" syndrome. We replace nested rectangular boxes with a unified document canvas, subtle 1px dividers, and quiet typography.
- **Color Fidelity:** Retains 100% of RepoSense's native theme colors and Tailwind tokens—elevating the look strictly through spacing, typography hierarchy, and cleaner component architecture.
- **Notion Document Structure:** Transcripts, extracted issues, file summaries, and commit logs expand cleanly using Notion-style toggles (`▸ / ▾`) right on the page—eliminating disruptive popups and modals.
- **T3 Code Interaction Layer:** Docked bottom composer bar, instant model switching, dual modes (RAG vs. Simple Chat), repository-scoped Pull Request management, and slide-over GitHub code inspection.
- **Cloudflare Native:** Engineered from the ground up for edge execution on Cloudflare Workers and Cloudflare Pages (`nodejs_compat`, standard web fetch, Web Crypto API, Neon serverless Postgres).

---

## 2. Global Navigation & Ergonomic Sidebar

The sidebar provides dedicated workspace tabs for 100% distraction-free workflows.

```
+-----------------------------------------------------------+
| [Logo] RepoSense                   [Collapse Sidebar ◨]   |
| [Repository: Ethan4582/RepoSense ▾] [branch: main ▾]      |
+-----------------------------------------------------------+
| WORKSPACE TABS                                            |
| 💬 Chat & Discussions      (T3 composer + RAG canvas)     |
| 🔀 Pull Requests           (Repository-scoped GitHub PRs) |
| 🎙️ Meetings & Issues       (Notion-style audio & issues)  |
| 🔖 QA Bookmarks            (Searchable saved QA vault)    |
| ⚙️ API Keys & Vault        (Clean centralized BYOK page)  |
+-----------------------------------------------------------+
| PINNED THREADS 📌                                         |
| 📌 Auth Flow with Clerk & BYOK Key Vault                  |
| 📌 Dual Vector Indexing Pipeline Setup                    |
+-----------------------------------------------------------+
| RECENT THREADS                                            |
| • LCEL migration review in chains.py                      |
| • Stripe to BYOK migration details                        |
| • Hono server routing conventions                         |
|                                                           |
| [+ New Thread]                                            |
+-----------------------------------------------------------+
| [User Avatar: ASH]                      [Account Settings]|
+-----------------------------------------------------------+
```

### 2.1 Sidebar Sections
1. **Repository Switcher Header:**
   - Active repository dropdown (`Ethan4582/RepoSense`) with branch selector (`main ▾`).
   - All tabs (Pull Requests, Meetings, Chat) automatically re-scope to the chosen repository.
2. **Dedicated Workspace Tabs:**
   - **`💬 Chat`**: Active conversation thread with docked composer and file grounding.
   - **`🔀 Pull Requests`**: T3-style PR viewer scoped strictly to the selected repo.
   - **`🎙️ Meetings & Issues`**: Notion-style meeting document notes and issue extractor.
   - **`🔖 QA Bookmarks`**: Global searchable archive of saved Q&As.
   - **`⚙️ API Keys & Vault`**: Dedicated, clean page for configuring and verifying all LLM/Embedding API keys.
3. **Thread Management with Pinning (📌):**
   - **Pinned Threads Section:** Users can pin important threads to stay permanently at the top.
   - **Chronological Recent Threads:** Hovering reveals quick actions (`Pin 📌`, `Rename ✏️`, `Delete 🗑️`).
   - **`+ New Thread` Button:** Anchored cleanly right below the thread list (ChatGPT style).
4. **User Footer:**
   - User profile info, dark/light theme switcher, and general account settings.

---

## 3. Workspace Tab Deep Dive

---

### 3.1 Workspace Tab: `💬 Chat` (T3 Code Canvas + Docked Composer)

#### A. Main Chat Surface (Clean & Spacious)
- **Header Breadcrumb:**
  ```
  📁 Ethan4582 / RepoSense  ·  [branch: main ▾]  ·  [GitHub ↗]        [+ Invite Members]  [📌 Pin Thread]
  ```
- **Indexing & Onboarding Lifecycle:**
  When a new repository is created, the thread canvas displays an inline status:
  - `✓ Repository cloned and scanned`
  - `✓ Code chunks vectorized (Gemini-004 / OpenAI-3-small)`
  - `✨ We are ready to answer the questions.`

#### B. The Bottom T3 Composer Bar
- **Docked Floating Card:** Anchored at the bottom of the viewport with a subtle border and backdrop blur.
- **Top Bar Inside Composer:**
  - **Mode Selector Pill:** Toggle between `[RAG Mode (5 Files)]` and `[Simple Chat Mode]`.
  - **Model Selector Pill:** `[DeepSeek Logo] DeepSeek V3 ▾` (opens search, categories, and pricing badges).
  - **`Get Tips 💡` Pill:** Opens codebase prompt tips and 1-click prompt starters.
- **Borderless Textarea:** Auto-expanding up to 200px.
- **Bottom Footer:**
  - Left: `@ Mention File` shortcut pill.
  - Center: `Enter to send · Shift+Enter for newline`.
  - Right: Circular Send Button (turns to Stop icon during generation).

#### C. 5-File RAG Grounding & In-Chat Code Inspector
When the assistant answers in RAG mode:
1. **Direct Answer:** Clean markdown formatting without boxy wrappers.
2. **5-File Citation Strip:** Exactly 5 relevant files shown in a clean pill group:
   ```
   Context (5 files): [📄 src/server/auth.ts] [📄 src/lib/crypto.ts] [📄 prisma/schema.prisma] [📄 src/middleware.ts] [📄 src/server/routes/keys.ts]
   ```
3. **Inline File Summary & Slide-Over Code Inspector:**
   - Clicking any file opens a slide-over panel right inside the chat (like T3 Code).
   - **Header:** File path, `Copy Code` button, and direct `Open on GitHub ↗` anchor link.
   - **AI Summary Callout:** Plain-English summary of what this file does in the repository.
   - **Code Viewer:** Syntax highlighting with line numbers.
   - **File Switcher Tabs:** Switch between all 5 files without closing the drawer.
4. **Answer Action Bar:**
   - 📋 `Copy Summary`
   - 🐙 `View on GitHub`
   - 🔖 `Save to QA History` (adds to Bookmarks)

---

### 3.2 Workspace Tab: `🎙️ Meetings & Issues` (Notion-Style Document)

Replaces the previous nested boxy cards and modal popups with a clean, Notion-style meeting document.

#### A. Meeting List View
A clean, minimal document list (no giant cards):
```
TITLE / SUMMARY                                          DATE         ISSUES     DURATION    ACTIONS
------------------------------------------------------------------------------------------------------
📄 Runner's Knee & Rotator Cuff Discussion               Aug 31, 2025  2 issues   04:12 mins  [Open] [···]
📄 Q3 Architecture Sync & Vector Migration               Sep 14, 2025  4 issues   18:40 mins  [Open] [···]
```
- **Upload Action:** Clean header button `[+ Upload Meeting Audio]` supporting AssemblyAI processing.

#### B. Meeting Detail View (Notion Page Format)
- **Top Callout:**
  > 💡 **Executive Summary:** Discussion focused on anterior cruciate ligament rehabilitation and rotator cuff strain prevention following heavy weight training.
- **Audio Playback Strip:** Discreet embedded player with scrubber and speed toggle (`1x`, `1.25x`, `1.5x`).
- **Extracted Issues (Collapsible Notion Toggles):**
  *No modal popups!* Everything expands inline:
  ```
  ▸ Issue #1: Runner's Knee, Rotator Cuff Tear              [00:05 - 02:22]   [Create GitHub Issue ↗]
  ▾ Issue #2: What is ACL tear?                              [02:23 - 04:12]   [Create GitHub Issue ↗]
    Summary: Anterior cruciate ligament tear occurs during sudden stops, jumping or pivoting movements.
    
    Transcript Chunk:
    "02:23 - ACL tear is characterized by sudden swelling and instability in the joint..."
  ```

---

### 3.3 Workspace Tab: `🔀 Pull Requests` (T3 Code-Style Repository Scope)

Strictly scoped to the GitHub repository active in the workspace.

#### A. PR Header Bar
- Repository Context: `Pull Requests for Ethan4582/RepoSense`
- Filters: `All (12)` · `Open (3)` · `Merged (8)` · `Closed (1)`
- Search input: Filter by PR title, author, or branch name.

#### B. PR List Item Anatomy
```
[#198] Update deprecated chains to LCEL                    [Open Badge]  [+184 / -42]
Opened 2 days ago by Tomaz Bratanic · branch: feature/lcel -> main
Summary: Refactors api.py and pdf_bot.py to use RunnableParallel and LangChain LCEL chains.
[View Diff ↗]  [Inspect Files (4)]  [Open on GitHub ↗]
```

#### C. Slide-Over PR Inspector
Clicking a PR slides out a T3-style detail drawer:
- **AI PR Summary:** High-level summary of the architectural changes in the PR.
- **Changed Files Tree:** List of touched files with additions/deletions.
- **Direct GitHub Link:** Quick jump to the actual GitHub Pull Request.

---

### 3.4 Workspace Tab: `⚙️ API Keys & Vault` (Clean Centralized Config)

A dedicated, spacious configuration page (moved out of popup menus directly into the workspace tabs):

#### A. Provider Matrix & Key Status
Clean table listing all supported LLM and embedding providers:
```
PROVIDER       TYPE                  REQUIRED FOR             STATUS         ACTION
------------------------------------------------------------------------------------------
OpenAI         Chat & Embeddings     Chat / RAG Vectors       ● Active       [Edit] [Test]
Google Gemini  Chat & Embeddings     Chat / RAG Vectors       ● Active       [Edit] [Test]
DeepSeek       Chat (Reasoning)      Chat Only (Needs Embed)  ○ Not Set      [Add Key]
Anthropic      Chat (Claude 3.5)     Chat Only (Needs Embed)  ● Active       [Edit] [Test]
Groq           Fast Chat             Chat Only (Needs Embed)  ○ Not Set      [Add Key]
Meta / XAI     Chat                  Chat Only (Needs Embed)  ○ Not Set      [Add Key]
```

#### B. The Dual-Key Embedding Rule (Clearly Explained on Page):
- **OpenAI & Gemini:** Can fulfill **both** chat and vector embeddings. If an OpenAI or Gemini key is configured, your workspace is 100% RAG-ready.
- **Other Providers (DeepSeek, Anthropic, etc.):** Used for chat generation, but require an OpenAI or Gemini key active in the vault to generate vector embeddings during repository indexing.
- **AES-256-GCM Security Callout:** Keys are encrypted client-side/server-side and never exposed in raw text.

---

### 3.5 Workspace Tab: `🔖 QA Bookmarks` (Saved QA Vault)

A dedicated archive of questions and answers bookmarked by the user across any thread.
- **Search Bar:** Real-time search across question titles, answer content, or referenced file names.
- **List View:**
  - Question Title & Timestamp.
  - Origin Thread Link (e.g. `From thread: Auth Flow Discussion`).
  - 5 Cited Files Pills.
  - Actions: `Jump to Thread`, `Copy Answer`, `Remove Bookmark`.

---

### 3.6 Header Action: `+ Invite Members` Dialog

A minimalist modal opened from the workspace header:
- **Invite Link:** One-click copyable URL with token expiry.
- **Role Selector:** `Viewer` (read-only chat & meetings) vs. `Collaborator` (can index repos & run chats).
- **Active Members List:** Displays team members, avatars, roles, and remove buttons.

---

## 4. Backend Implementation & Database Changes

To support these features without breaking Cloudflare deployment, the following backend changes have been implemented:

### 4.1 Database Schema Updates (`prisma/schema.prisma`)
Added `isPinned` and `isBookmarked` booleans to `Question` model:
```prisma
model Question {
  id            String   @id @default(cuid())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  question      String
  answers       String
  fileReference Json?
  isPinned      Boolean  @default(false)    // Supports thread / question pinning
  isBookmarked  Boolean  @default(false)    // Supports QA bookmarks vault
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  userId        String
  user          User     @relation(fields: [userId], references: [id])
}
```

### 4.2 GitHub Service Updates (`src/lib/github.ts`)
1. **Cloudflare Standard `fetch`:** Replaced legacy `axios` HTTP calls with standard web `fetch` to ensure zero-failure execution inside Cloudflare's runtime.
2. **Repository-Scoped PR Fetcher:** Added `getPullRequests(githubUrl)` and `getPullRequestsForProject(projectId)` using `octokit.rest.pulls.list({ owner, repo, state: 'all' })`.

### 4.3 TRPC API Router Updates (`src/server/api/routers/project.ts`)
Added dedicated procedures:
- `getPullRequests`: Returns active & closed pull requests for the selected repository.
- `togglePinQuestion`: Toggles `isPinned` status for persistent thread ordering.
- `toggleBookmarkQuestion`: Toggles `isBookmarked` status.
- `getBookmarkedQuestions`: Queries saved QAs with optional case-insensitive full-text search.

---

## 5. Cloudflare Deployment Safety Guardrails

Because RepoSense is deployed on Cloudflare Workers / Cloudflare Pages, every module must strictly respect these architectural constraints:

| Constraint | Cloudflare Requirement | RepoSense Implementation Guardrail |
| :--- | :--- | :--- |
| **Runtime Environment** | V8 Isolate (not full Node.js server) | Configured `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml`. Zero reliance on native C++ Node addons. |
| **HTTP Requests** | Web Standard `fetch` only | All external API calls (GitHub API, AssemblyAI, LLMs) use standard `fetch` or SDKs operating over `fetch`. Axios removed from commit summaries. |
| **Crypto Operations** | Web Crypto API (`crypto.subtle`) | AES-256-GCM BYOK encryption uses Web Crypto primitives or edge-safe `node:crypto`. |
| **Database Connectivity** | Serverless Connection Pooling | Neon PostgreSQL connection string configured for pooled TCP/WebSocket connections. |
| **File System Access** | No persistent local disk | Code files and diffs stream directly in memory during chunking and vectorization; no `fs.writeFileSync` on disk. |
| **Streaming Responses** | Standard `ReadableStream` | Chat completions stream using standard Web `ReadableStream` and server-sent events (SSE). |

---

## 6. Implementation Checklist

- [x] **Database Schema:** `Question.isPinned` and `Question.isBookmarked` added and generated in Prisma client.
- [x] **Cloudflare Safe HTTP:** `axios` replaced with native `fetch` in `src/lib/github.ts`.
- [x] **PR API Procedure:** `getPullRequests` added to `src/server/api/routers/project.ts` scoped to active project.
- [x] **Pin & Bookmark Procedures:** `togglePinQuestion`, `toggleBookmarkQuestion`, `getBookmarkedQuestions` implemented.
- [x] **TypeScript Verification:** `tsc --noEmit` passing with 0 errors.
- [ ] **Sidebar Revamp:** Implement 5 tabs: `Chat`, `Pull Requests`, `Meetings`, `QA Bookmarks`, `API Keys & Vault`.
- [ ] **Notion Meeting Notes:** Refactor `/meetings` to clean list and inline collapsible issue toggles.
- [ ] **T3 PR View:** Refactor `/pull-requests` to show repository-scoped PRs with slide-over inspector.
- [ ] **T3 Docked Composer:** Wire dual modes (`RAG` vs `Simple Chat`), model picker, and tips into chat canvas.