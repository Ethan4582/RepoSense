# RepoSense — DeepWiki Architecture & Execution Plan

This document is the authoritative end-to-end execution plan for **Anti-Gravity / Claude CLI**. It defines the complete transition of RepoSense from a generic chat interface into a **DeepWiki-style Living Code Documentation & Architecture Intelligence Platform** powered 100% by **BYOK (Bring Your Own Key)** and deployed entirely on **Cloudflare Workers**.

Work through the phases in strict sequential order. Do not skip steps, do not introduce hardcoded API keys, and do not alter the existing application color palette (`globals.css`). Reference `binary.md` for all provider model catalogs, adapters, and logo paths.

---

## 0. Core Product, Architectural & Cloudflare Principles

1. **100% Cloudflare Workers Deployment (Frontend + Backend):**
   - Both the Next.js frontend (via `@opennextjs/cloudflare` / Cloudflare Pages/Workers) and the Hono API backend run on **Cloudflare Workers**.
   - **Strict Edge Runtime Compatibility:** Never use Node-only native C++ addons or `node:crypto` modules that break in Workers. Always use `crypto.subtle` (Web Crypto API) for AES-GCM encryption, `@neondatabase/serverless` HTTP/WebSocket driver with `@prisma/adapter-neon` for Prisma, and standard `fetch` streams.
2. **Zero Server-Side Inference Burn + Cloudflare Worker Bill Protection:**
   - **AI Inference:** 100% BYOK. Zero server-side LLM or embedding keys exist in environment variables.
   - **Worker CPU vs. Wall-Clock Time:** On Cloudflare Workers Standard pricing, you are billed for **CPU time** and **requests**, NOT wall-clock wait time while waiting on external OpenAI/Anthropic/GitHub HTTP responses. To keep CPU time near zero (<10ms per request), never run heavy AST parsers; use fast, lightweight regex/line-splitting and stream responses cleanly.
   - **Edge Caching & Emergency Circuit Breaker:** Public Wikis are cached at the Cloudflare Edge (`Cache-Control` + Cloudflare Cache API) so viral traffic spikes serve straight from Cloudflare's CDN without hitting Postgres or spinning up Worker CPU. An emergency kill-switch (`EMERGENCY_READ_ONLY_MODE`) and strict per-user job concurrency caps prevent runaway Worker or database load.
3. **DeepWiki-First Experience (No Generic ChatGPT Mode):**
   - Users do not start blank, unlinked ChatGPT threads. Every workspace centers around a GitHub repository converted into a comprehensive, multi-page **DeepWiki** with architectural Mermaid.js diagrams, line-numbered source citations, and an integrated codebase Q&A investigator.
4. **OpenAI Out-of-the-Box Defaults:**
   - Out-of-the-box defaults across the entire app (Settings, Project Creation, Model Selector) must be set to **OpenAI** (not Gemini).
5. **Production-Grade Upfront Wiki Generation:**
   - Because users supply their own keys and choose their own model tier (e.g., `gpt-5`, `gpt-6-astra`, `claude-opus-5-5`, `gemini-4-argon`), indexing takes a transparent 2–5 minutes via **Cloudflare Workflows** (durable, step-checkpointed execution) to generate the entire multi-page documentation hierarchy upfront with an accurate **Estimated Time Remaining** counter.
6. **Direct Line-Aware Code Chunking & Native Pull Requests:**
   - Eliminate per-file and per-commit AI summary generation completely. Chunk filtered source code deterministically with exact `startLine` and `endLine` numbers and batch-embed them directly.
   - Fetch native GitHub Pull Requests (titles, descriptions, authors, status, labels, timestamps) via Octokit and render them directly in the Pull Requests page for the active repository.
7. **Public vs. Private Wikis & Duplicate Guard:**
   - Repositories can be indexed as **Public** or **Private** wikis (private GitHub repos force `isPublicWiki = false`).
   - Public wikis appear on an **Explore Public Wikis** directory. If a user submits a GitHub URL that already has a Public Wiki, notify them with the option to **View Existing Public Wiki** immediately or **Proceed & Re-index** with their own key/model.
   - If a visitor tries to ask a question in the bottom chat bar of a Public Wiki without being signed in or without having a valid API key, prompt them to sign in and configure their own API key.
8. **Preserve Existing Color Palette & Meetings Module:**
   - Keep the exact CSS variables and theme colors. Keep the Meetings + AssemblyAI logic untouched.

---

## 1. Phase 1 — Database Schema Overhaul (`prisma/schema.prisma`)

**Goal:** Update PostgreSQL + `pgvector` schema (using `@prisma/adapter-neon` for Cloudflare Workers compatibility) to support DeepWiki pages, line-numbered code chunks, public/private visibility, encrypted BYOK keys, and remove legacy commit/file summary columns and Stripe/credit tables.

### 1.1 Tables & Columns to Delete
- **Drop `StripeTransactions` model** completely.
- **Drop `User.credits` column**.
- **Drop `Commit` table** (Pull Requests are fetched natively from GitHub per repo; no AI commit summaries).
- **Drop `SourceCodeEmbedding.summary` column** (we store line-aware code chunks directly).

### 1.2 Enums to Define
```prisma
enum Provider {
  OPENAI
  GEMINI
  ANTHROPIC
  META
  DEEPSEEK
  XAI
  GROQ
}

enum EmbeddingProvider {
  OPENAI
  GEMINI
}

enum KeyStatus {
  UNVERIFIED
  VALID
  INVALID
  QUOTA_EXHAUSTED
}

enum IndexingStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

enum IndexingStep {
  LOADING_REPO
  CHUNKING_AND_EMBEDDING
  PLANNING_WIKI
  GENERATING_PAGES
  FINALIZING
  DONE
}
```

### 1.3 Updated & New Models

#### `User`
- Keep `id`, `emailAddress`, `firstName`, `lastName`, `imageUrl`, `createdAt`, `updatedAt`.
- Set defaults to OpenAI:
  - `defaultChatProvider Provider @default(OPENAI)`
  - `defaultChatModel String @default("gpt-5")` (or `"gpt-6.1-sol"` per `binary.md`)
  - `defaultEmbeddingProvider EmbeddingProvider @default(OPENAI)`
  - `preferences Json?` (stores favorite models array)

#### `ApiKey`
- `id String @id @default(cuid())`
- `userId String` (FK → `User`, `onDelete: Cascade`)
- `provider Provider`
- `encryptedKey String`
- `iv String`
- `keyLast4 String`
- `status KeyStatus @default(UNVERIFIED)`
- `lastVerifiedAt DateTime?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `@@unique([userId, provider])`

#### `Project` (Represents a Converted Repository Wiki)
- `id String @id @default(cuid())`
- `name String` (Automatically derived as `owner/repo` from `repoUrl`—never manually typed)
- `repoOwner String` (e.g., `"huggingface"`)
- `repoName String` (e.g., `"transformers"`)
- `repoUrl String` (Normalized `https://github.com/owner/repo`)
- `encryptedGithubToken String?` (AES-GCM encrypted optional token)
- `githubTokenIv String?`
- `isPrivateRepo Boolean @default(false)` (Detected via GitHub API)
- `isPublicWiki Boolean @default(true)` (Forced to `false` if `isPrivateRepo == true` or token is required)
- `chatProvider Provider @default(OPENAI)`
- `chatModel String @default("gpt-5")`
- `embeddingProvider EmbeddingProvider @default(OPENAI)` (Locked once indexing starts)
- `embeddingModel String @default("text-embedding-3-small")`
- `embeddingDimensions Int @default(1536)`
- `repoSkeleton Json?` (Stores file tree, directory map, and extracted import/export signatures)
- `lastIndexedCommitSha String?` (e.g., `"429e69"` shown in header: `Last indexed: 22 October 2026 (429e69)`)
- `lastIndexedAt DateTime?`
- `deletedAt DateTime?`
- Relations: `userToProjects`, `wikiPages`, `sourceCodeEmbeddings`, `qaThreads`, `meetings`, `indexingJobs`
- `@@index([repoOwner, repoName, isPublicWiki])`

#### `WikiPage` (Stores the Multi-Page DeepWiki Documentation)
- `id String @id @default(cuid())`
- `projectId String` (FK → `Project`, `onDelete: Cascade`)
- `slug String` (e.g., `"overview"`, `"core-architecture/model-loading"`)
- `title String` (e.g., `"Overview"`, `"PreTrainedModel & PreTrainedConfig"`)
- `sectionTitle String` (Left sidebar group header, e.g., `"Overview"`, `"Core Architecture"`, `"Model Architectures"`)
- `sectionOrder Int` (Order of the section in the left sidebar)
- `pageOrder Int` (Order of the page within its section)
- `content String @db.Text` (Full Markdown article including ` ```mermaid ` diagrams, tables, and `[[file.ext:start-end]]` citation tags)
- `relevantFiles String[]` (Array of file paths used to synthesize this page, rendered in the collapsible `> Relevant source files` accordion at the top of the article)
- `headings Json?` (Extracted `[{ id, text, level }]` for the right-hand `On this page` scroll-spy TOC)
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `@@unique([projectId, slug])`
- `@@index([projectId, sectionOrder, pageOrder])`

#### `SourceCodeEmbedding` (Line-Aware Code Chunks & Full File Store)
- `id String @id @default(cuid())`
- `projectId String` (FK → `Project`, `onDelete: Cascade`)
- `filePath String` (e.g., `"docs/source/en/philosophy.md"` or `"src/transformers/__init__.py"`)
- `directory String` (e.g., `"src/transformers"`)
- `chunkIndex Int` (0, 1, 2...)
- `startLine Int` (1-based start line of this chunk in the original file)
- `endLine Int` (1-based end line of this chunk in the original file)
- `chunkContent String @db.Text` (The raw code/text for lines `startLine..endLine` with file header prepended for embedding)
- `fullFileContent String? @db.Text` (Stored on `chunkIndex = 0` so the right-hand Split-Pane Code Viewer can load any file with full line numbers instantly without re-fetching from GitHub)
- `embeddingOpenAI Unsupported("vector(1536)")?`
- `embeddingGemini Unsupported("vector(768)")?`
- `@@index([projectId, filePath])`
- Add HNSW cosine indexes on both `embeddingOpenAI` and `embeddingGemini`.

#### `QaThread` & `QaMessage` (Replaces broken single-turn `Question` behavior)
- **`QaThread`**:
  - `id String @id @default(cuid())`
  - `projectId String` (FK → `Project`, `onDelete: Cascade`)
  - `userId String` (FK → `User`, `onDelete: Cascade`)
  - `title String` (First question asked)
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `messages QaMessage[]`
- **`QaMessage`**:
  - `id String @id @default(cuid())`
  - `threadId String` (FK → `QaThread`, `onDelete: Cascade`)
  - `role String` (`"user"` | `"assistant"`)
  - `content String @db.Text` (Markdown answer with clickable `[[file.ext:start-end]]` citations)
  - `scannedFiles Json?` (Array of `{ filePath, startLine, endLine }` scanned during retrieval, used for the right-hand `> Scanning ...` panel and code viewer)
  - `modelUsed String?`
  - `createdAt DateTime @default(now())`

#### `IndexingJob`
- `id String @id @default(cuid())`
- `projectId String` (FK → `Project`, `onDelete: Cascade`)
- `status IndexingStatus @default(QUEUED)`
- `currentStep IndexingStep @default(LOADING_REPO)`
- `totalFiles Int @default(0)`
- `processedFiles Int @default(0)`
- `totalWikiPages Int @default(0)`
- `completedWikiPages Int @default(0)`
- `estimatedSecondsRemaining Int?`
- `currentDetail String?` (e.g., `"Generating chapter 4/10: Core Architecture..."`)
- `errorCode String?`
- `errorMessage String?`
- `startedAt DateTime @default(now())`
- `finishedAt DateTime?`

---

## 2. Phase 2 — BYOK Vault, OpenAI Defaults & Key Verification Fix

**Goal:** Ensure all API keys are encrypted via Web Crypto (`crypto.subtle`), default model selection is always **OpenAI**, and key testing (`/keys/:provider/test`) never triggers false-positive quota errors.

### 2.1 Fix OpenAI & Provider Key Verification (`POST /keys/:provider/test`)
- **Bug to Fix:** Valid OpenAI keys with active credits were failing with false `"Quota exhausted"` errors during verification.
- **Root Cause & Fix:**
  - Do **not** test keys by calling expensive reasoning models or high-token completions.
  - For **OpenAI, Groq, DeepSeek, xAI, Meta**: Verify by calling `GET {baseURL}/models` with `Authorization: Bearer ${apiKey}` (zero tokens consumed, instant 200 OK if key is valid).
  - Only classify an error as `QUOTA_EXHAUSTED` if the provider explicitly returns error code `"insufficient_quota"` or HTTP `402`. If a `429` is returned with `"rate_limit_exceeded"`, treat the key as `VALID` (transient rate limit, not zero credits).
  - For **Anthropic & Gemini**: Send a 1-token `maxOutputTokens: 1` probe to their cheapest model (`claude-haiku-4-5` / `gemini-2.5-flash-lite`) and inspect the exact error code.

### 2.2 Strict Model-to-Provider Key Alignment
- Before starting any indexing job or Q&A request, verify on the backend that the user has a `VALID` `ApiKey` matching `project.chatProvider` **and** a `VALID` `ApiKey` matching `project.embeddingProvider` (`OPENAI` or `GEMINI`).
- Never send an OpenAI model ID (`gpt-4.1`, `gpt-5`, etc.) to the Gemini adapter or vice versa. When the user switches the provider in Settings or the Model Selector, automatically reset the selected model to that provider's default model from `binary.md`.

---

## 3. Phase 3 — High-Speed Ingestion & Upfront DeepWiki Generation Pipeline

**Goal:** Build the multi-step **Cloudflare Workflow** (`IndexingWorkflow`) that filters files, chunks code with line numbers, extracts the Repo Skeleton, and generates the entire multi-page DeepWiki documentation with Mermaid diagrams without hitting Cloudflare Worker CPU or subrequest limits.

### 3.1 Strict File & Directory Filtering (`src/lib/repo-filter.ts`)
- Fetch the repository file tree in a **single call** via Octokit `git.getTree({ owner, repo, tree_sha: defaultBranch, recursive: "true" })`.
- Note: Do **not** expose branch selectors anywhere in the UI or backend. Always resolve the repository's default branch automatically via `repos.get({ owner, repo })` and record its latest commit SHA (`lastIndexedCommitSha`).
- **GitHub Token Handling (`401 Bad Credentials` Fix):**
  - If the user did not supply a GitHub token (or for public repos), make unauthenticated Octokit requests (or validate any optional token first). If a user-supplied token returns `401 Bad Credentials`, immediately surface a clear error: *"Your GitHub Personal Access Token is invalid or expired. Please remove it for public repos or provide a new token."*
- **Strict Ignore Rules & Hard File Cap:**
  - Exclude directories: `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`, `out/`, `coverage/`, `vendor/`, `__pycache__/`, `.venv/`, `public/models/`, `components/ui/` (skip generic shadcn boilerplate primitives so embeddings focus on real application logic).
  - Exclude files: lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `Cargo.lock`, `poetry.lock`), `.env*`, minified files (`*.min.js`, `*.min.css`), binary/media/font assets (`*.png`, `*.jpg`, `*.svg`, `*.ico`, `*.pdf`, `*.mp4`, `*.woff2`), and files larger than `250 KB`.
  - **Cloudflare Subrequest Guard:** Cap total indexed files per repository at `300` prioritized source files (sorted by core directories `src/`, `app/`, `lib/`, `server/`, `docs/`, `README.md`) and fetch raw file contents via GitHub's tarball/archive stream or batched blob steps inside `IndexingWorkflow` so a single Worker invocation never exceeds Cloudflare's subrequest limit.

### 3.2 Deterministic Line-Aware Code Chunking & Repo Skeleton (`src/lib/chunker.ts`)
1. **Repo Skeleton Extraction (0 LLM Tokens, <5ms CPU):**
   - For every filtered file, extract:
     - `filePath`, `directory`, `lineCount`, `sizeBytes`
     - Top-level `imports` and `exports` (functions, classes, types, route definitions) with their line numbers using fast single-pass regex scanning (no heavy AST libraries that burn Worker CPU limits).
   - Save this compact JSON map to `Project.repoSkeleton`.
2. **Line-Numbered Chunking:**
   - Split each file into chunks of ~120 lines (with a 20-line overlap).
   - Record exact `startLine` and `endLine` integers for each chunk.
   - Format `chunkContent` with explicit line numbers so both the embedding model and the Q&A LLM know exact line coordinates:
     ```text
     File: src/server/app.ts (Lines 1-95)
     1 | import { Hono } from "hono";
     2 | import { cors } from "hono/cors";
     ...
     ```
   - Save the complete raw text of each file in `fullFileContent` (on `chunkIndex === 0`) so the Split-Pane Code Viewer can render any file instantly with line numbers.
3. **Batch Vector Embeddings:**
   - Embed all chunks in batches of `100` using OpenAI `text-embedding-3-small` (`1536` dim) or Gemini `gemini-embedding-001` (`768` dim).
   - Bulk insert into `SourceCodeEmbedding` using `prisma.createMany` + bulk SQL `UNNEST` vector update.

### 3.3 Upfront Multi-Page DeepWiki Synthesis (`src/lib/wiki-generator.ts`)
1. **Step A — Wiki Architecture Blueprint (`PLANNING_WIKI`):**
   - Send `Project.repoSkeleton`, `README.md`, and `package.json` / manifest files to the user's selected chat model.
   - Instruct the LLM to return a structured JSON Wiki Plan containing **3 to 5 Sections** and **6 to 12 total Pages** tailored to the repository (always starting with Section 1: `Overview` → Page 1: `Overview`):
     ```json
     {
       "sections": [
         {
           "sectionTitle": "Overview",
           "sectionOrder": 1,
           "pages": [
             {
               "slug": "overview",
               "title": "Overview",
               "pageOrder": 1,
               "relevantFiles": ["README.md", "package.json", "src/server/app.ts"]
             },
             {
               "slug": "getting-started",
               "title": "Getting Started & Configuration",
               "pageOrder": 2,
               "relevantFiles": ["README.md", "src/env.js", "prisma/schema.prisma"]
             }
           ]
         },
         {
           "sectionTitle": "Core Architecture",
           "sectionOrder": 2,
           "pages": [...]
         }
       ]
     }
     ```
2. **Step B — Checkpointed Page & Mermaid Generation (`GENERATING_PAGES`):**
   - Update `IndexingJob.totalWikiPages` and compute `estimatedSecondsRemaining` (e.g., `remainingPages * 15` seconds).
   - Execute page generation inside Cloudflare Workflow `step.do()` blocks (in batches of 2–3 concurrent pages via `p-limit(3)`) so each batch has its own fresh Cloudflare subrequest and CPU quota and automatically checkpoints to Postgres.
   - For each page, pass the line-numbered source code of its assigned `relevantFiles` + the `repoSkeleton` to the user's selected chat model.
   - **Strict DeepWiki System Prompt Requirements for Each Page:**
     - Write comprehensive, senior-level architectural documentation in clean Markdown.
     - Include **1 to 3 valid Mermaid.js diagrams** (`flowchart TD`, `sequenceDiagram`, `classDiagram`, or `erDiagram`) illustrating component interactions, data flow, and control flow.
     - Include structured Markdown comparison/summary tables where appropriate.
     - **Mandatory Inline Source Citations:** Every technical claim, class reference, or architectural explanation MUST cite its exact source file and line range using the syntax `[[path/to/file.ext:startLine-endLine]]` (e.g., `[[README.md:70-84]]` or `[[src/server/app.ts:14-42]]`).
   - Extract all `h2` and `h3` headings from the generated Markdown into `WikiPage.headings` for the right-hand `On this page` table of contents, and save the `WikiPage` record to Postgres.

---

## 4. Phase 4 — DeepWiki Q&A Engine & Split-Pane Code Inspector

**Goal:** Replicate the exact 2-column DeepWiki investigation flow shown in the reference screenshots when a user asks a question in the bottom floating dock.

### 4.1 Access Control on Public vs. Own Wikis
- Anyone can read a Public Wiki's pages and diagrams for free (zero tokens spent).
- When a user clicks or submits a question in the bottom floating dock (`Ask about owner/repo`):
  - **If unauthenticated:** Show a clean prompt/modal: *"Sign in and configure your API key to ask interactive questions on this repository."*
  - **If authenticated but visiting someone else's Public Wiki without having their own valid API keys configured:** Prompt them to add their API key in Settings or index their own workspace.
  - **If authenticated with valid keys:** Execute the DeepWiki Q&A flow using the **asking user's** API keys.

### 4.2 Two-Stage SSE Streaming Flow (`POST /projects/:id/qa`)
1. **Thread Persistence Fix:**
   - If `threadId` is omitted (first question asked from the Wiki view), create a single `QaThread` record and return its `threadId` in the first SSE event.
   - When the user asks a follow-up question in the bottom bar (`Ask a follow-up question`), pass the active `threadId` so all follow-up messages append to the **same** `QaThread` and never spawn duplicate threads.
2. **Stage 1 — Live File Scanning Events (`type: "scanning"`):**
   - Embed the user's question and query `SourceCodeEmbedding` for the top 10–12 matching code chunks (plus check `WikiPage` content).
   - Immediately stream SSE events for each matched file before LLM generation begins:
     ```json
     { "type": "scanning", "filePath": "docs/source/en/philosophy.md", "startLine": 17, "endLine": 55 }
     ```
   - On the frontend, the layout transitions to the **2-Column Investigation View**:
     - **Left Column:** Back link (`← owner/repo`), the user's question as a large heading, the selected model/speed badge, and a clean 5-bar skeleton shimmer while waiting for the first text tokens.
     - **Right Column:** Renders the live card listing `> Scanning philosophy.md`, `> Scanning add_new_model.md`, etc.
3. **Stage 2 — Paced Answer Streaming with Citations (`type: "token"`):**
   - Stream the LLM answer at a smooth, natural reading cadence (buffer/pace token chunks smoothly at ~15–25ms intervals on the client so responses never dump all at once).
   - Enforce inline citations in the format `[[filePath:startLine-endLine]]` (rendered as light-blue/accent clickable pills like `philosophy.md:17-24`).
   - Once streaming starts/completes, the **Right Column** automatically transitions from the `> Scanning ...` list into the **Interactive File & Line Viewer**:
     - Displays the primary cited file (`owner/repo  docs/source/en/philosophy.md` with a copy button) and full line-numbered source code.
     - Clicking any citation pill (`philosophy.md:32-36` or `add_new_model.md:51-68`) in the answer on the left immediately loads that file into the right-hand viewer, scrolls smoothly to `startLine`, and highlights lines `startLine` through `endLine`.

---

## 5. Phase 5 — UI, Sidebar, Header & Theme Revamp

**Goal:** Implement the clean, hover-triggered app sidebar, the 3-column DeepWiki reader layout, the simplified Repository Creation modal/page, the single-purpose API Keys page, and fix Light/Dark mode code formatting.

### 5.1 App Sidebar (Clean Vercel-Inspired Layout + Hover Trigger on Wiki Pages)
- **Visual Style (Match Reference Screenshot 4 while keeping existing color palette):**
  - Top header inside sidebar: RepoSense brand logo (ensure favicon & OpenGraph metadata in `layout.tsx` also use the new logo from `public/`), workspace title, and "+ New Repository Wiki" button.
  - Primary navigation items with clean Lucide icons:
    - **Explore Public Wikis** (`/explore`)
    - **New Repository** (`/create`)
    - **Pull Requests** (`/pulls`)
    - **Meetings** (`/meetings`)
    - **API Keys & Models** (`/settings`)
  - **Converted Wikis List (`Repositories`):**
    - Lists all repositories converted by the user with status dot indicators (green = ready, amber = indexing, red = failed).
    - Each item has a compact `⋯` menu for basic actions ("Rename", "Toggle Public/Private", "Delete Wiki").
  - **Bottom Profile Bar:**
    - Shows Clerk user avatar, user's name, and a Settings gear icon button that opens a clean popover for Clerk profile management and Sign Out.
    - **Strictly Removed:** Remove the `"Pro"` badge, remove `"Manage subscription"`, and remove `"Usage limits"`.
- **Auto-Collapse / Hover Behavior on DeepWiki View:**
  - When the user clicks a converted repository to view its DeepWiki, the main app sidebar collapses automatically so the DeepWiki interface gets the full viewport width.
  - Moving the cursor to the top-left RepoSense logo / left edge smoothly opens the app sidebar as a floating overlay drawer so the user can switch wikis or jump to Pull Requests / Meetings / Settings in one click (ensure zero click latency—use direct Next.js `<Link>` or instant router state transitions).

### 5.2 DeepWiki Main Interface (`/wiki/[projectId]`)
- **Minimal Top Header Bar:**
  - **Left:** RepoSense logo (triggers app sidebar drawer on hover/click) + `RepoSense` title + `owner/repo` link + Public/Private badge.
  - **Right:**
    1. **`Pull Requests` button** (navigates directly to `/projects/[projectId]/pulls` for this specific repository).
    2. **`Share` button** (copies the URL and allows the owner to toggle Public/Private visibility if the underlying GitHub repo is public).
    3. **Light/Dark Theme Toggle**.
  - **Strictly Removed from Header:** No branch selector dropdown, no GitHub octocat clutter, no profile icon, no pin thread button, no "Invite Member / Archive" ⋯ menu, no "Index with Devin" or "Edit Wiki" buttons.
- **3-Column Body Layout (Reading Mode):**
  1. **Left Column (Wiki Navigation Tree, `w-64`):**
     - Displays `Last indexed: {date} ({shortCommitSha})` at the top.
     - Renders all generated `WikiPage` items grouped under their `sectionTitle` headers (`Overview`, `Core Architecture`, etc.). Clicking any item switches the center article instantly.
  2. **Center Column (Article & Diagrams Canvas, `flex-1 max-w-4xl`):**
     - Page `title` (`h1`).
     - Collapsible `> Relevant source files` accordion right below the title showing the file pills used for this chapter.
     - Rich Markdown renderer supporting:
       - Interactive **Mermaid.js** diagrams (with zoom/pan or clean responsive SVG rendering).
       - Clickable inline source citation pills (`README.md 70-84`, `src/transformers/__init__.py 141-173`). Clicking a pill opens the file in a slide-over code sheet or split pane scrolled to those exact lines.
       - **Light & Dark Mode Syntax Highlighting Fix:** Configure code blocks (`shiki` or `rehype-pretty-code` / `prism`) with dual-theme CSS variables (`github-light` in light mode, `github-dark` in dark mode) so code blocks and inline code badges are 100% legible with high contrast in both light and dark themes.
  3. **Right Column (`On this page` TOC, `w-60`):**
     - Sticky scroll-spy table of contents listing all `h2` and `h3` headings of the active wiki page.
- **Bottom Floating Q&A Dock:**
  - Centered floating glassmorphic bar at the bottom of the viewport:
    - Input placeholder: `Ask about {owner}/{repo}...`
    - Bottom-left inside dock: T3-style **Model Selector chip** (shows active provider logo from `public/models/`, model name, and `$`–`$$$+` tier badge from `binary.md`).
    - Bottom-right inside dock: Submit arrow button.
  - Remove all prompt suggestion chips ("Ask about a prompt", "Use T3", "Composer", "Architecture overview", "Get tips").

### 5.3 Project / Wiki Creation Flow (`/create`)
1. **No Manual Repository Name Field:**
   - Only ask for the **GitHub Repository URL** (and optional GitHub Personal Access Token for private repos). Automatically parse `owner` and `repo` from the URL.
2. **Strict GitHub URL Validation:**
   - Validate input with strict regex (`^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$`) and verify via a lightweight backend check (`POST /projects/verify-repo`) that the repository actually exists on GitHub **before** running any token/cost estimation.
   - Block random or non-GitHub URLs immediately with an inline error: *"Please enter a valid GitHub repository URL (https://github.com/owner/repo)."*
3. **Duplicate Public Wiki Check:**
   - When a valid GitHub URL is entered, check if a `Project` with the same `repoOwner`/`repoName` and `isPublicWiki = true` already exists in the database.
   - If it exists, display an inline banner: *"This repository has already been converted into a Public DeepWiki!"* with two actions:
     - **[View Existing Wiki]** (routes directly to `/wiki/[existingProjectId]`)
     - **[Convert Again with My Key & Model]** (continues creation flow)
4. **Public vs. Private Wiki Toggle:**
   - If the GitHub repo is public (and no private token was required), allow the user to choose **Public Wiki** (visible in Explore) or **Private Wiki** (only visible to them).
   - If the GitHub repo is private, lock the selection to **Private Wiki**.
5. **Default Model & Cost/Time Estimate Card:**
   - Pre-select the user's default provider and model (**OpenAI** by default).
   - Show the estimated filtered file count, token range, estimated USD cost (from `binary.md`), and **Estimated Generation Time** (e.g., `~2–4 minutes`).

### 5.4 API Keys Configuration Page (`/settings`)
- **Single-Purpose Page:** Remove the `"API & Models (BYOK)"` and `"Profile"` tabs completely. This page is dedicated exclusively to API Key configuration and default model preferences.
- **Remove Clutter & Dead Space:** Remove the technical subtitle (`"Hardware-isolated AES-256-GCM..."`), remove the `"The Dual-Key Embedding Rule"` blue banner, and remove the `"Hardware-isolated Vault"` badge. Tighten vertical spacing.
- **Fix xAI Logo:** Ensure the xAI row points to the valid logo file in `public/models/` (verify exact filename and SVG stroke/fill visibility in light mode).
- **Smart Embedding Notification:** When a user adds a key for `ANTHROPIC`, `META`, `DEEPSEEK`, `XAI`, or `GROQ`, check if they have an active `OPENAI` or `GEMINI` key. If not, trigger a clear toast notification (`sonner`): *"Please also add an OpenAI or Gemini API key for vector embeddings."*
- **OpenAI Defaults:** In the "Default Model Preferences" card, set the initial defaults to:
  - Default Chat Provider: `OpenAI`
  - Default Chat Model: `GPT-5` (or `GPT-6.1 Sol`)
  - Default Embedding Provider: `OpenAI (text-embedding-3-small · 1536 dim)`

### 5.5 Dynamic Native Pull Requests Page (`/projects/[projectId]/pulls` or `/pulls`)
- **Fix Hardcoded Repo Bug:** Never fall back to a hardcoded test repository. Always read the active `projectId` (from route params or selected project switcher) and look up its `repoOwner`, `repoName`, and decrypted `gitHubToken` from the `Project` record.
- **Native GitHub PR Extraction (Zero AI Summarization):**
  - Fetch open and closed Pull Requests directly from GitHub via `octokit.rest.pulls.list({ owner, repo, state: "all", per_page: 30 })`.
  - Render the PR title, PR number (`#142`), state badge (`Open`, `Merged`, `Closed`), author avatar & username, creation/merge date, labels, and the **native PR body/description** written by the developer in an expandable row or sheet.
  - Ensure the `"View on GitHub"` button links dynamically to `https://github.com/${project.repoOwner}/${project.repoName}/pull/${pr.number}`.

---

## 6. Phase 6 — Cloudflare Workers Protection, Traffic Scaling & Emergency Circuit Breaker

**Goal:** Guarantee that viral traffic spikes, abusive bots, or slow upstream LLM APIs never cause high Cloudflare Worker billing, CPU limit crashes, or database connection exhaustion.

### 6.1 Cloudflare Edge Caching for Public Wikis (`0` Worker Invocations on Read Spikes)
- On `GET /api/projects/:id/wiki` and `GET /api/explore`:
  - When `project.isPublicWiki === true` and `status === "COMPLETED"`, set HTTP response headers:
    `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
  - Also cache the serialized Wiki JSON in Cloudflare's `caches.default` (Edge Cache API) keyed by `projectId`, and purge that cache key only when the owner re-indexes or toggles visibility.
  - **Result:** If 50,000 visitors view a Public Wiki from `/explore` or a shared link, Cloudflare serves the response directly from edge cache with **zero Postgres queries** and minimal Worker execution.

### 6.2 Replace Polling Loops with Lightweight Status Checks
- **Problem:** Long-lived SSE polling loops (`while(true)` querying Postgres every 1 second for 4 minutes) inside a Worker hold open connections and multiply Neon database queries under heavy traffic.
- **Fix:**
  - For indexing progress (`GET /projects/:id/indexing/status`), use lightweight client polling every `3 seconds` (with `Cache-Control: no-store`) or return a short-lived SSE stream that closes after 30 seconds and reconnects automatically.
  - Only run real-time SSE streaming during active Q&A token generation (`POST /projects/:id/qa`), where the Worker simply pipes the upstream LLM `ReadableStream` directly to the browser with `<5ms` of CPU time.

### 6.3 Per-User Concurrency & Rate Guard (No Extra Paid Infrastructure Needed)
- Enforce directly via Postgres before dispatching any expensive Worker task:
  1. **Max 1 Active Indexing Job per User:** Before creating a new `IndexingJob`, check `prisma.indexingJob.count({ where: { project: { userToProjects: { some: { userId } } }, status: { in: ["QUEUED", "RUNNING"] } } })`. If `>= 1`, reject with HTTP `429`: *"You already have a repository being indexed. Please wait for it to finish."*
  2. **Global Active Indexing Cap:** If total concurrent `RUNNING` jobs across the entire platform exceed `MAX_GLOBAL_INDEXING_JOBS` (default `25`), queue or reject new indexing requests gracefully so Worker instances cannot be flooded.
  3. **Strict Upstream Fetch Timeouts:** Every external `fetch` / AI SDK call must pass an `AbortSignal.timeout(90_000)` (90s max for wiki page generation, 15s for key verification, 20s for GitHub API calls) so hung upstream connections never leave Workers dangling.

### 6.4 Emergency Kill-Switch & `wrangler.toml` Hard Limits
1. **Emergency Environment Variable (`EMERGENCY_MODE`):**
   - Support an environment flag `EMERGENCY_MODE = "OFF" | "READ_ONLY" | "MAINTENANCE"` in `wrangler.toml` / Cloudflare dashboard variables (changeable in 2 seconds without redeploying code):
     - `"OFF"` (Default): All features active.
     - `"READ_ONLY"`: Blocks new repository indexing (`POST /projects`) and interactive Q&A (`POST /projects/:id/qa`) with a clean banner (*"High traffic mode: Reading existing Public & Private DeepWikis is active, new indexing is temporarily paused"*), reducing Worker & DB load by 95% instantly.
     - `"MAINTENANCE"`: Immediately returns HTTP `503` at the top of the Hono middleware before touching Clerk or Postgres.
2. **Hard CPU Limit in `wrangler.toml`:**
   - Configure explicit Worker limits in `wrangler.toml` so a runaway loop can never rack up CPU charges:
     ```toml
     [limits]
     cpu_ms = 50
     ```
     *(Note: `cpu_ms = 50` caps actual JavaScript computation time at 50ms per invocation while still allowing unlimited wall-clock wait time for external OpenAI/Anthropic/GitHub network I/O).*

---

## 7. Execution Order Checklist for Anti-Gravity

1. **Step 1 — Prisma Schema & Neon Serverless Adapter:** Apply Phase 1 schema updates (`WikiPage`, `QaThread`, `QaMessage`, line-numbered `SourceCodeEmbedding`, `isPublicWiki` on `Project`, OpenAI defaults, and drop `Commit` / `StripeTransactions`) and ensure Prisma uses `@neondatabase/serverless` HTTP/WebSocket adapter for Cloudflare Workers.
2. **Step 2 — Provider Verification & OpenAI Defaults:** Fix `/keys/:provider/test` so valid OpenAI keys pass via `GET /v1/models`, enforce provider-to-model matching, and update `/settings` UI (remove tabs/metadata, fix xAI logo, set OpenAI defaults, add toast when embedding key is missing).
3. **Step 3 — Ingestion, Line-Aware Chunker & Upfront Wiki Generator:** Replace sequential file/commit summaries with `repo-filter.ts`, `chunker.ts` (`startLine`/`endLine` + `repoSkeleton`), and `wiki-generator.ts` (multi-page Markdown + Mermaid diagrams + `[[file:start-end]]` citations + live time-remaining progress).
4. **Step 4 — DeepWiki Reader & Split-Pane Q&A UI:** Build the 3-column `/wiki/[projectId]` view, Mermaid renderer, light/dark syntax highlighting fix, bottom floating Q&A dock, and 2-column `> Scanning ...` + line-highlighted Code Viewer.
5. **Step 5 — Explore Public Wikis, Create Flow & Native Pull Requests:** Add strict GitHub URL validation, automatic `owner/repo` naming, duplicate Public Wiki detection, the `/explore` directory, hover-collapsible sidebar, and dynamic native Pull Requests fetching.
6. **Step 6 — Cloudflare Workers Hardening & Emergency Controls:** Add Edge Caching (`Cache-Control` + `caches.default`) on Public Wikis, per-user concurrency caps (`max 1 active indexing job`), `EMERGENCY_MODE` middleware (`OFF` / `READ_ONLY` / `MAINTENANCE`), and `cpu_ms = 50` cap in `wrangler.toml`.