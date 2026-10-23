# RepoSense - Comprehensive Technical Interview Guide

This guide is designed for technical deep-dive interviews where interviewers test whether you truly designed, built, and understand every layer of RepoSense down to the code level. It maps directly to the evaluation rubric (P0: Past Projects, P0: Using AI Effectively, P1: Frontend Fundamentals).

---

## 1. Project Overview & Exact Role (P0: Past Projects - 10-15 min)

### The Problem
Traditional documentation tools (Wiki.js, Docusaurus, Confluence) require manual writing and quickly become outdated. Large Language Models can generate docs, but naive single-prompt generation on whole repositories fails due to context window limits, catastrophic hallucination, lost-in-the-middle phenomena, and lack of line-level grounding.

### The Solution: RepoSense
RepoSense is an autonomous repository intelligence platform that:
1. Connects directly to GitHub via lightweight REST APIs (no local git clones).
2. Performs symbol-aware AST/regex chunking and builds a structural **RepoSkeleton**.
3. Employs a two-phase documentation engine (Plan first, write in parallel with blueprint enforcement).
4. Provides grounded code QA with interactive line-level citation pills that link directly to an in-browser code viewer.

### Your Exact Role & Architecture Ownership
- **Architecture & Pipeline:** Designed the multi-tier ingestion workflow, tree estimation, dual embedding pipeline (OpenAI 1536-dim / Gemini 768-dim), and branch-scoped storage.
- **Backend / Edge Runtime:** Built the Hono API server mounted inside Next.js edge routes and Cloudflare Workers, integrating Clerk JWT validation, Neon Serverless PostgreSQL with pgvector, and AES-256-GCM BYOK key encryption.
- **Frontend & Streaming UI:** Built the interactive WikiReader, smooth token streaming hook (`useSmoothStream`), citation pill parser, collapsible Git file viewer, and dark-mode aesthetic UI.
- **Third-Party Libraries Used:** Next.js 15 App Router, React 19, Hono, Octokit, Vercel AI SDK (`ai`), Prisma ORM + `@prisma/adapter-neon`, Tailwind CSS v4, Lucide React, Radix UI.

---

## 2. In-Depth Architecture & End-to-End Data Flow

```
                                  [ User Browser ]
                                         �
                   +-------------------------------------------+
                   �                                           �
         [ Next.js App Router ]                     [ Hono API / Workers ]
        (WikiReader, CodeViewer)                   (Auth, Indexing, Search)
                   �                                           �
                   ?                                           ?
      [ Clerk Auth Middleware ]                   [ Octokit / GitHub API ]
     (Session Cookies & Bearers)                 (Git Trees, Blobs, Commits)
                   �                                           �
                   ?                                           ?
          [ Neon PostgreSQL ]                        [ Vercel AI SDK ]
     (pgvector, Chunks, Wikis, QA)             (OpenAI, Gemini, Anthropic, Groq)
```

### 1. Ingestion & Pre-flight Verification Flow
- **URL Verification (`src/server/routes/projects.ts`):** Checks format, resolves GitHub default branch / commit SHA using `getRepoMetadata` and `resolveRepoRef`. Reuses resolved metadata to avoid redundant round-trips.
- **Estimate Cost & Token Count (`src/server/routes/estimate.ts`):** Hits GitHub's `/git/trees/{sha}?recursive=1` with fallback to `HEAD`, filters non-code assets, and calculates estimated tokens and embedding cost without downloading raw code blobs.

### 2. Chunking & RepoSkeleton Flow (`src/lib/chunker.ts`)
- **Sliding Window:** For files <= 800 lines: 120-line chunks with 20-line overlap so cross-boundary logic is never cut in half.
- **Symbol-Aware Splitting:** For files > 800 lines: identifies top-level functions, classes, and route handlers. Grabs 8 lines of preceding context (`SYMBOL_CONTEXT_LINES = 8`) to preserve decorators, types, and docstrings.
- **RepoSkeleton Structure:**
  - Extracts imports (up to 60/file) and exported signatures (up to 120/file).
  - Groups directory trees and feeds the topological map into `src/lib/wiki/analyzer.ts` to categorize files into 5 tiers (`entry`, `core`, `integrations`, `data`, `utilities`).

### 3. Vector Embeddings & Storage Flow (`src/lib/embeddings.ts`)
- Code chunks are converted to vectors via OpenAI (`text-embedding-3-small`, 1536-dim) or Gemini (`gemini-embedding-001`, 768-dim).
- Upserted into Neon PostgreSQL via raw parameterized SQL using the `pgvector` extension. Every row is scoped by `(projectId, branch)` for clean multi-branch isolation.

### 4. DeepWiki Generation Flow (`src/lib/wiki-generator.ts`)
- **Phase 1 (Planning):** LLM receives Architecture Brief + Skeleton and returns a JSON section/page manifest. Blueprint pages (System Architecture, Runtime Lifecycle, Data Storage) are enforced even if the LLM skips them.
- **Phase 2 (Concurrent Page Generation):** Pages are written in parallel (concurrency limit = 3 via `p-limit` to prevent 429 rate limits). Numbered lines (`1 | import...`) are injected for exact citation grounding.

### 5. Grounded QA & Line-Level Citations Flow (`src/lib/qa-engine.ts`)
- User question -> Vector embedding -> Cosine distance query (`<=>`) in PostgreSQL filtered by project and branch.
- LLM receives retrieved code snippets and system prompts requiring `[[path/to/file.ts:start-end]]` syntax.
- Frontend Markdown parser catches citation tokens and turns them into clickable `CitationPill` components that trigger the split-screen `CodeViewer` with auto-scroll.

---

## 3. Deep-Dive Interview Question & Answer Bank

### P0: Technical Depth & System Design

#### Q1: "Walk me through what would break if 10x or 100x more repositories were indexed simultaneously."
- **Database Connection Exhaustion:** Neon serverless connections would saturate. **Mitigation:** We use Neon WebSocket pooling with `@prisma/adapter-neon` and connection limits; at 100x we would introduce a dedicated message queue (Cloudflare Queues or Inngest) to throttle concurrent indexing jobs (`MAX_GLOBAL_INDEXING_JOBS = 25`).
- **GitHub API Rate Limits:** Unauthenticated requests hit 60 req/hr. Authenticated tokens hit 5,000 req/hr. **Mitigation:** User BYOK GitHub tokens or system token rotation, plus tree caching.
- **Serverless Timeout:** Processing 10,000 files in a single HTTP request exceeds Cloudflare Worker (30s) / Vercel (60s) limits. **Mitigation:** Multi-step Cloudflare Workflows (`src/server/workflows/indexing.ts`) that break ingestion, embedding, and wiki writing into discrete durable steps.

#### Q2: "Why did you use pgvector inside Postgres instead of Pinecone, Weaviate, or Qdrant?"
- **Single Database Simplicity:** Joining vector distance with relational metadata (e.g. `WHERE projectId = $1 AND branch = $2 AND deletedAt IS NULL`) happens in one query.
- **Zero Synchronization Lag:** When a project or branch is deleted or re-indexed, relational cascade deletes all vectors atomically in a transaction. No orphaned vectors in an external DB.
- **Cost:** Free tier included with Neon; no extra $50-100/mo vector SaaS billing.
- **Trade-off:** Pure vector QPS on pgvector without HNSW indexing is slower at >10M rows than specialized C++ vector engines.

#### Q3: "Explain how you securely handle and store user API keys (BYOK)."
- **Encryption Algorithm:** AES-256-GCM via the Web Crypto API (`src/lib/providers/crypto.ts`).
- **IV / Nonce Handling:** Every key encryption generates a fresh, cryptographically secure 12-byte initialization vector (`crypto.getRandomValues(new Uint8Array(12))`).
- **Storage:** Ciphertext and IV are concatenated (base64) and stored in the database. The `ENCRYPTION_KEY` is kept strictly as a server environment secret.
- **Validation:** When added, the key is tested against the provider's lightweight validation endpoint before being committed to the database.

#### Q4: "What was the hardest bug you ran into, and how did you debug it?"
- **The Issue:** Cloudflare Worker crashed with 500 Internal Server Error on public endpoints, and the frontend showed `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- **Root Cause Analysis:** In `src/server/db.ts`, the check for Node.js used `Boolean(process.versions?.node)`. In Cloudflare Workers with `nodejs_compat`, `process.versions.node` is defined! This caused the Worker to bypass `PrismaNeon` and attempt to run pure Node PrismaClient without an adapter, failing immediately.
- **Fix:** Switched to inspecting runtime identifiers: checking `WebSocketPair`, `navigator.userAgent` for Cloudflare, and `process.release?.name === "workerd"`. If on Cloudflare/Edge, it strictly uses `PrismaNeon` with global WebSocket; if pure Node, it uses native PrismaClient.

---

### P0: Using AI Effectively (~40 min)

#### Q5: "How do you prevent the LLM from hallucinating file paths or code logic?"
1. **Line-Numbered Context Injection:** Code is passed with explicit line numbers (`14 | export function ...`).
2. **Strict Citation Grammar:** System prompt instructs: *"You must only answer using facts directly demonstrated by the provided code. Every claim must cite `[[filepath:startLine-endLine]]`"*.
3. **Frontend Citation Verification:** The frontend validates cited files against the loaded file tree; if a cited file does not exist, the badge reflects an invalid citation.

#### Q6: "Why plan the wiki first instead of generating docs on the fly?"
- In single-pass generation, LLMs run out of output tokens (typically 4k or 8k tokens) mid-documentation.
- Planning extracts an architectural blueprint with global context (via RepoSkeleton).
- Each page is then generated with scoped file context, preventing shallow generic summaries and ensuring every major subsystem gets a dedicated deep-dive page.

#### Q7: "How does the UI deliver smooth streaming without layout thrashing?"
- Standard `onChunk` React state updates re-render on every token (up to 50-100 times per second), causing browser layout thrashing and stutter.
- RepoSense uses `useSmoothStream` (`src/hooks/use-smooth-stream.ts`): tokens are buffered in a ref and drained smoothly using `requestAnimationFrame` at a locked 60 FPS.

---

### P1: Frontend Fundamentals (~10 min)

#### Q8: "How does the split-screen CodeViewer synchronize with the Markdown text?"
- The custom Markdown component parses citations like `[[src/lib/auth.ts:25-40]]`.
- Clicking a pill triggers `onCitation`, setting `activeFile = { filePath, startLine, endLine }`.
- `CodeViewer` fetches the raw file content via `getApiBaseUrl()/api/public/projects/:id/file?path=...` and auto-scrolls to the line range using DOM `scrollIntoView({ behavior: 'smooth', block: 'center' })`.

#### Q9: "Explain your CORS and cross-origin authentication strategy."
- Dynamic CORS origin resolution in `src/server/app.ts`: permits configured `APP_URL`, `*.pages.dev`, `*.workers.dev`, and custom domains (`aash7.xyz`).
- Public endpoints (`/api/public/*`) allow any origin so public wikis can be viewed without friction in incognito or external embeds.
- Protected endpoints require Bearer tokens or Clerk cookies with `credentials: 'include'`.

---

## 4. Key File Architecture Index (Quick Reference)

| Path | Purpose |
|---|---|
| `src/lib/chunker.ts` | Sliding window chunking, symbol-boundary chunking, and `buildRepoSkeleton` |
| `src/lib/wiki/analyzer.ts` | Manifest parsing and 5-tier architecture categorization |
| `src/lib/wiki-generator.ts` | Two-phase wiki generation (Planning + Concurrent Page Generation) |
| `src/lib/qa-engine.ts` | RAG vector search, cosine distance ranking, and grounded citations |
| `src/server/db.ts` | Edge-compatible Neon adapter initialization vs Pure Node fallback |
| `src/server/routes/projects.ts` | Repository verification, branch resolution, and project settings |
| `src/server/routes/public.ts` | Public unauthenticated wiki reader, explore page, and file fetcher |
| `src/components/wiki/wiki-reader.tsx` | Primary documentation reader with public/private fallback and QA |
| `src/components/wiki/code-viewer.tsx` | Interactive code viewer panel with line highlighting |
| `src/hooks/use-smooth-stream.ts` | `requestAnimationFrame` 60 FPS token buffer stream smoother |


### P0 Deep-Dive: Exactly How RAG Chunking, Line Tracking & Citations Work

#### Q10: "Do you index single lines, whole files, or chunks? What exactly is stored in the vector database?"
- **Answer:** We index **contiguous blocks (chunks)** of code, typically **120 lines at a time with a 20-line overlap** (or at symbol boundaries for files > 800 lines). We do **not** index individual lines, nor do we index only 'relevant' sections.
- **Why?**
  - Indexing line-by-line destroys semantic context (a line like `return token;` means nothing in isolation) and would increase database row count by 100x.
  - Indexing entire multi-thousand line files dilutes the semantic embedding vector, making similarity matching blunt and inaccurate.
- **What is saved per row in `SourceCodeEmbedding`:**
  1. `fileName`: File path (e.g., `src/server/auth.ts`).
  2. `sourceCode`: The exact block of text spanning those lines.
  3. `embeddingOpenAI` (1536-dim) or `embeddingGemini` (768-dim): A single dense vector generated from that entire chunk.
  4. `projectId` & `branch`: For strict multi-tenant and multi-branch data isolation.

#### Q11: "Do you chunk the entire file or only sections you find relevant?"
- **Answer:** We chunk the **entire file from line 1 to the end**.
- **Why?** At indexing time, the system cannot predict what questions future developers will ask. Pre-filtering lines or trying to guess what is "important" leads to blind spots. Instead, the whole file is sliced into consecutive, overlapping chunks (`0-120`, `100-220`, etc.). Only at query time does pgvector select the specific chunks relevant to the user's question.

#### Q12: "If you index 120-line chunks, how does the system know the exact line numbers (e.g. lines 21-25) where the answer lives?"
- **Answer:** Through a 3-step line-grounding pipeline:
  1. **Line Number Injection:** During indexing, each chunk records its `startLine` and `endLine`. When retrieved chunks are assembled into the LLM context, RepoSense physically prepends line numbers to every line (`formatChunkContent` in `src/lib/chunker.ts`):
     ```text
     File: src/server/auth.ts (Lines 20-35)
     20 | export async function clerkAuthMiddleware(c, next) {
     21 |   const authHeader = c.req.header("Authorization");
     22 |   if (authHeader?.startsWith("Bearer ")) { ... }
     ```
  2. **LLM Pinpointing & Strict Citation Syntax:** The LLM reads the numbered lines and identifies the precise lines that execute the logic. The system prompt mandates the exact syntax: `[[filePath:startLine-endLine]]` (e.g., `[[src/server/auth.ts:21-22]]`).
  3. **Frontend Parsing & Interactive CodeViewer:** The client Markdown parser converts the citation token into a clickable `CitationPill` badge. Clicking the badge opens the `CodeViewer` panel, fetches the raw file from `/api/public/projects/:id/file`, highlights lines 21-22 in gold/blue, and auto-scrolls to them via `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
