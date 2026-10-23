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


### P0 Deep-Dive: Advanced RAG Evolution, Architectural Trade-offs & Agentic RAG

#### Q13: "What RAG architecture does RepoSense currently use, and what are the different types of RAG strategies you could have chosen?"
- **Answer:** We categorize RAG architectures into four distinct evolutionary tiers:
  1. **Naive RAG (Single-hop retrieval):** Query -> Single Vector Search -> LLM generates answer. Fast and cheap, but fails on complex questions requiring information scattered across multiple files.
  2. **Advanced RAG (Pre/Post-retrieval enhancements):**
     - *Pre-retrieval:* Query rewriting, query expansion, HyDE (Hypothetical Document Embeddings).
     - *Post-retrieval:* Re-ranking with Cross-Encoders (e.g., Cohere Rerank), contextual compression, and hybrid search (BM25 lexical + vector semantic).
  3. **Modular / Hybrid RAG (What RepoSense currently implements):**
     - Combines dense vector retrieval from `SourceCodeEmbedding` with structural high-level context from generated `WikiPage` summaries.
     - Constrains search by relational boundaries (`projectId` and `branch`).
     - Injects explicit line numbers and enforces strict citation syntax (`[[file:lines]]`).
  4. **Agentic / Multi-hop RAG:** Treats the LLM as an autonomous reasoning agent equipped with retrieval tools (search, file reading, AST traversal, symbol lookups). It dynamically decides whether it has enough context or needs to fetch more across multi-turn reasoning loops.

#### Q14: "Why didn'''t you start with Agentic RAG, and how would you implement it when a user selects a Frontier Model (e.g. Claude 3.7 Sonnet, GPT-4.5, Gemini 2.0 Pro)?"
- **Answer:**
  - **Why not for all models by default?**
    - **Latency:** Agentic RAG requires multiple LLM round-trips (tool call -> retrieve -> evaluate -> tool call -> answer), turning a 1-2 second streaming response into a 15-30 second wait.
    - **Cost & Token Burn:** Running 4-5 reasoning cycles burns 10x-20x more tokens per question, quickly draining users''' BYOK API quotas.
    - **Smaller Models Flake:** Smaller or high-speed models (e.g., Llama 3 8B, GPT-4o-mini) often hallucinate tool calls or get stuck in cyclic reasoning loops.
  - **How we enable Agentic RAG dynamically for Frontier Models:**
    When the user selects a capable frontier model with deep reasoning and tool capabilities, we activate a ReAct (Reason + Act) loop equipped with four discrete agent tools:
    1. `vector_search(query: string, scope?: string)`: Runs semantic vector similarity search on code chunks.
    2. `fetch_file_symbol(filePath: string, symbol: string)`: Navigates directly to function or class definitions across file boundaries using the RepoSkeleton.
    3. `fetch_raw_lines(filePath: string, startLine: number, endLine: number)`: Pulls exact code blocks if the initial chunk truncated an imported utility or parent class.
    4. `verify_citations(answer: string, citations: Citation[])`: A reflection step that checks that cited line numbers actually contain the claimed logic before returning the final response to the UI.
  - **The Iterative Multi-Cycle Flow:**
    ```
    User Query -> Agent Step 1: Broad Vector Search
                     �
                     ?
    Agent Evaluates: "I see the auth middleware, but it calls verifyToken() in another file."
                     �
                     ?
    Agent Step 2: Tool Call -> fetch_file_symbol("src/lib/jwt.ts", "verifyToken")
                     �
                     ?
    Agent Evaluates: "Context complete. Synthesizing answer with verified citations."
                     �
                     ?
    Final Grounded Response Streamed to Client
    ```


### P0 Deep-Dive: Durable Background Execution & Queue Architectures (Scale & Reliability)

#### Q15: "Why do giant repositories (5,000+ files) break in serverless environments, and how would you build a bulletproof indexing pipeline using durable background job queues (Inngest / BullMQ / Cloudflare Workflows)?"
- **The Core Problem:**
  - **Hard Execution Timeouts:** Serverless HTTP functions have strict execution ceilings (Cloudflare Workers: 30s CPU time, Vercel Serverless: 15s-60s). Indexing 5,000 files requires downloading trees, slicing 15,000+ chunks, making batched embedding calls, and generating multi-page wikis�a process taking 2 to 5 minutes.
  - **Memory & Concurrency Limits:** Buffering thousands of file ASTs in memory risks Out-Of-Memory (OOM) crashes in serverless containers (128MB-256MB).
  - **Catastrophic Failures:** In a single HTTP request, if file #4,990 fails due to a rate limit or transient network hiccup, the entire HTTP connection drops, aborts uncommitted database transactions, and forces the user to start completely over from 0%.
- **The Solution: Durable Event-Driven Workflow Architecture:**
  We split monolithic ingestion into an asynchronous, idempotent, stateful pipeline using a durable queue engine (such as Inngest, Redis-backed BullMQ, or native Cloudflare Workflows in `src/server/workflows/indexing.ts`):
  1. **Immediate HTTP Return (202 Accepted):** When the user clicks "Index", the HTTP handler validates permissions, inserts an `IndexingJob` record with status `QUEUED`, enqueues a root job event `repo/index.started`, and returns immediately with a tracking `jobId` in <200ms.
  2. **Fan-Out / Map-Reduce Step Decomposition:**
     - **Step 1: Manifest & Tree Fetch:** Lightweight job fetches Git tree, runs ignore filters, and commits the file manifest to Postgres.
     - **Step 2: Fan-Out Chunk & Embed:** Instead of one worker processing 5,000 files, the queue engine fans out files into deterministic batches (e.g., 50 files per batch). 100 queue workers process batches in parallel.
     - **Step 3: Stateful Checkpointing:** Each batch independently writes its vectors to `SourceCodeEmbedding` and updates its batch counter atomically.
     - **Step 4: Fan-In Wiki Generation:** Once all batch jobs emit completion events, a final aggregation step triggers the two-phase DeepWiki generator.
  3. **Automatic Exponential Backoff & Dead-Letter Queues (DLQ):**
     - If OpenAI or GitHub returns a `429 Rate Limit`, the durable queue pauses that specific step, sleeps for the `Retry-After` header duration, and retries automatically up to 5 times without failing the entire repository.
     - Poison pills (malformed binary files) are caught, dumped to a Dead-Letter Queue (DLQ) with error telemetry, and the pipeline continues gracefully.
  4. **Client Progress Synchronization:**
     - The browser doesn'''t hold a blocking connection; it listens via Server-Sent Events (SSE) (`/api/projects/:id/indexing/stream`) or lightweight polling (`/indexing/status`), displaying real-time percentage progress bar updates directly from the job state.


### P0 Deep-Dive: System Scale, Cost Economics, Security & Deployment (Q16 - Q19)

#### Q16: "Scale: What breaks if RepoSense grows 10x or 100x in concurrent users and repositories?"
- **Answer:**
  1. **Neon PostgreSQL Vector Query Latency (10x -> 100x):**
     - *Bottleneck:* Sequential scans or un-indexed cosine distance queries (`<=>`) across millions of chunk vectors will saturate Postgres CPU.
     - *Fix:* Create an **HNSW (Hierarchical Navigable Small World)** vector index on `SourceCodeEmbedding (embeddingOpenAI vector_cosine_ops)` with parameters `m = 16, ef_construction = 64`. This changes vector search from $O(N)$ linear scans to $O(\log N)$ graph traversals.
  2. **Database Connection Pool Exhaustion:**
     - *Bottleneck:* Neon serverless connections spike under concurrent user traffic.
     - *Fix:* Enforce PgBouncer connection pooling via Neon's pooler endpoint, paired with `@prisma/adapter-neon` over WebSockets.
  3. **Edge Cache Thundering Herd:**
     - *Bottleneck:* If a popular open-source repository's public wiki is accessed by 10,000 users simultaneously, cache misses hit the database.
     - *Fix:* Cloudflare Cache API with `stale-while-revalidate=86400` (`src/lib/cache.ts`) ensures the edge serves cached HTML/JSON immediately while asynchronously refreshing stale content in the background.

#### Q17: "Cost: How much does it cost to index a repository, and what strategies reduce model and hosting bills?"
- **Answer:**
  - **Unit Economics Breakdown:**
    - *Embedding Cost:* OpenAI `text-embedding-3-small` costs $0.02 per 1M tokens. A typical 50,000-line repo contains ~400k tokens -> Embedding costs **$0.008 (less than one cent)**.
    - *Wiki Planning & Generation:* ~50k input tokens + ~15k output tokens across 5-8 pages using `gpt-4o-mini` or `gemini-1.5-flash` -> Costs **$0.02 - $0.04**.
    - *Total per Repository:* Under **$0.05 per full repository indexing**.
  - **Optimization & Reduction Strategies:**
    1. **Pre-flight Ignore Rules:** Discarding lockfiles, dependencies, and build artifacts prevents wasting 70-80% of embedding tokens.
    2. **BYOK (Bring Your Own Key) Architecture:** Users provide their own OpenAI/Gemini/Anthropic API keys, shifting AI compute costs away from our infrastructure.
    3. **Incremental Git Diff Updates:** Calling GitHub's Compare API on webhook pushes to delete and re-embed only modified files, rather than re-indexing from scratch.
    4. **Dual-Column Support:** Offering Google Gemini embeddings (`gemini-embedding-001`) allows free-tier indexing for hobbyist developers.

#### Q18: "Deployment: Where does RepoSense run, and how do you manage environment secrets across runtimes?"
- **Answer:**
  - **Hosting Split:**
    - **Frontend:** Cloudflare Pages / Next.js (built via `@cloudflare/next-on-pages`), globally distributed across 300+ edge PoPs with near-zero latency.
    - **Backend API & Workflows:** Cloudflare Workers (`src/server/worker.ts`) and durable workflows (`src/server/workflows/indexing.ts`).
    - **Database:** Neon Serverless PostgreSQL in the `ap-southeast-1` / `us-east-1` region with native `pgvector`.
  - **Secret Management:**
    - Local development: `.env` file loaded via dotenv / Next.js.
    - Production runtime: Cloudflare Worker encrypted secrets injected via `wrangler secret put <NAME>` (`ENCRYPTION_KEY`, `DATABASE_URL`, `CLERK_SECRET_KEY`).
    - Secret integrity: Zero secrets are hardcoded in Git. BYOK user keys are encrypted with AES-256-GCM using a cryptographically derived key before touching the database.

#### Q19: "Can you walk through your own code in the repository and explain why things are structured this way?"
- **Answer:**
  - **`src/lib/chunker.ts`:** The core chunking engine. Kept independent of database models or framework runtimes so it can run anywhere (browser, server, edge, CLI).
  - **`src/server/db.ts`:** The database abstraction layer. Uses a runtime proxy and environment sniffer (`isCloudflareOrEdge`) to cleanly switch between `PrismaNeon` (for serverless/worker runtimes with WebSockets) and native `PrismaClient` (for local Node.js development).
  - **`src/server/routes/public.ts`:** Dedicated unauthenticated routes for public wikis and explore pages. Completely detached from Clerk auth middleware to enable blazing fast cold starts and zero-auth read access for incognito users.
  - **`src/components/wiki/wiki-reader.tsx`:** The primary UI orchestrator. Manages split-screen state, handles public-to-private API fallback for QA queries, and wires token streaming into `useSmoothStream`.


### P0 Deep-Dive: Runtime Selection (Hono vs Node.js) & 60 FPS Token Smoothing (Q20 - Q21)

#### Q20: "Why pick Hono over a traditional Node.js/Express framework? How do you answer this beyond 'it is modern and runs on Cloudflare'?"
- **The Senior Engineering Answer:**
  - **Clarification first:** *Node.js* is a JavaScript runtime, while *Hono* is a web standards-based server framework (like Express or Fastify). The exact comparison is **Hono on Edge/V8 isolates (Cloudflare Workers)** vs **Express/Fastify on Node.js containers (AWS ECS/EC2/Heroku)**.
  - **1. Zero-Cold-Start V8 Isolates vs Container Boot Latency:**
    - A standard Node.js/Express container takes **1.5s to 4s** to boot up (Node runtime initialization, dependency parsing, memory allocation).
    - Hono running on Cloudflare Workers runs on **V8 isolates** with a cold start of **< 5ms** globally across 300+ edge locations.
  - **2. Web Standards Compliance (Fetch API & Request/Response):**
    - Express relies on legacy Node.js-specific objects (`req`, `res`, `res.send()`, Node `http.IncomingMessage`).
    - Hono is built natively on modern **W3C Web Standards** (`Request`, `Response`, `ReadableStream`, `Fetch API`). This allows the exact same Hono codebase to run identically in Cloudflare Workers, Next.js Edge route handlers, Deno, Bun, or Node.js without rewriting route handlers.
  - **3. Native Streaming & Server-Sent Events (SSE):**
    - Streaming LLM tokens via SSE in Express requires manual header management, chunk flushing, and keeping long-lived Node sockets alive.
    - Hono provides first-class streaming primitives (`streamSSE`, `streamText`) that pipe directly into web standard ReadableStreams.
  - **4. Memory Footprint & Throughput:**
    - Hono has zero dependencies and weighs **< 15KB**. Its RegExp-based router (RegExpRouter) compiles all routes into a single regular expression, outperforming Express's sequential linear route matching by over **10x in throughput**.

#### Q21: "Explain how `useSmoothStream` (src/hooks/use-smooth-stream.ts) achieves a locked 60 FPS streaming experience. What problem does it solve?"
- **The Problem with Naive Streaming:**
  - Modern LLM providers (Groq, Cerebras, OpenAI) stream tokens at 50 to 100+ tokens per second.
  - If a React component calls `setText(prev => prev + chunk)` on every arriving token chunk, React triggers **50 to 100 reconciliation and re-render cycles every second**.
  - Because each chunk alters the DOM, recalculates text layout, and re-renders heavy syntax highlighters / Markdown parsers, the main thread saturates. This causes **layout thrashing, jank, skipped frames, and browser UI freezes**.
- **How `useSmoothStream` Solves It (Under the Hood):**
  1. **Ref-Based Decoupled Buffer (`pending.current`):**
     - When a token arrives via `push(chunk)`, it is appended to a synchronous JavaScript string ref (`pending.current += chunk`).
     - Appending to a `useRef` does **not** trigger a React re-render.
  2. **Frame Synchronization via `requestAnimationFrame` (rAF):**
     - `push()` checks if an animation frame is already scheduled (`if (frame.current === null)`). If not, it requests an animation frame from the browser: `requestAnimationFrame(flush)`.
     - The browser ensures `flush` executes exactly once per display refresh cycle (every **16.6ms at 60 FPS**).
  3. **Batch Flushing:**
     - When `flush()` executes on the next tick, it grabs the accumulated string delta, resets the pending ref, and triggers **one single state update** (`setText(value => value + chunk)`).
  4. **Clean Lifecycle & Unmount Safety:**
     - The hook tracks the animation frame ID (`frame.current`) and cancels any scheduled frame on unmount (`cancelAnimationFrame`) or stream reset, preventing memory leaks and state updates on unmounted components.
