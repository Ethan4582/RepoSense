# RepoSense Project-Specific Technical Interview Preparation

This document contains a comprehensive, production-grade technical interview preparation guide for RepoSense. It includes an architectural overview, source code inventory, 120 full-system questions (Bank A), 80 frontend-specific deep-dive questions (Bank B), decision-defense index, diagram practice index, critical knowledge gaps, and an audit of verified vs inferred implementation details.

---

## 1. Project Summary and Architecture Diagram

RepoSense is an open source repository intelligence platform. It analyzes Git repositories across branches and pull requests, builds compact code skeletons, generates structured technical wikis (DeepWiki), and provides grounded codebase question-answering with line-level source code citations.

### Core Tech Stack
- **Frontend:** Next.js 15 (App Router, React Server Components), React 19, Tailwind CSS, Radix UI primitives, Lucide icons, PrismJS, Mermaid.js.
- **Backend API:** Hono mounted at `/api/[[...route]]`, Server-Sent Events (SSE), Clerk authentication middleware, tRPC v11 for legacy procedures.
- **Database and Vectors:** Neon Serverless PostgreSQL with native `pgvector` extension (1536-dim float4 for OpenAI, 768-dim float4 for Gemini), Prisma ORM.
- **AI and Embeddings:** Vercel AI SDK (`ai`), supporting OpenAI, Google Gemini, Anthropic, Groq, DeepSeek, Meta, and xAI.
- **Security:** Web Crypto API AES-256-GCM authenticated encryption with random 12-byte IVs for BYOK provider keys and GitHub private repository tokens.

![RepoSense System Architecture](public/docs/6.png)

---

## 2. Implementation Inventory

| Feature | Primary Responsibility | Key Source Files | API Endpoints | Data Models |
|---|---|---|---|---|
| Repository Ingestion | Tree fetching, ignore filtering, batch downloading | `src/lib/repo-filter.ts`, `src/lib/github.ts`, `src/lib/indexing-workflow.ts` | `POST /api/projects/:id/indexing/start`, `GET /api/projects/:id/indexing/stream` | `Project`, `IndexingJob` |
| Code Chunking & Skeleton | Sliding window, symbol-boundary chunking, import/export AST extraction | `src/lib/chunker.ts`, `src/lib/repo-normalizer.ts` | Internal pipeline | `SourceCodeEmbedding`, `repoSkeleton` (JSON) |
| Vector Indexing | Batch dense embeddings, raw pgvector SQL upsert | `src/lib/embeddings.ts`, `src/lib/providers/index.ts` | Internal pipeline | `SourceCodeEmbedding` |
| DeepWiki Generation | Architecture brief, hierarchical planning, concurrent page generation | `src/lib/wiki-generator.ts` | `GET /api/projects/:id/wiki`, `GET /api/public/:owner/:repo/wiki` | `WikiPage` |
| Grounded QA & Citations | Cosine search, context assembly, inline citation enforcement | `src/lib/qa-engine.ts`, `src/server/routes/projects.ts` | `POST /api/projects/:id/qa`, `GET /api/projects/:id/qa/threads` | `QaThread`, `QaMessage`, `Question` |
| BYOK Key Vault | AES-256-GCM key encryption, derivation, verification | `src/lib/providers/crypto.ts`, `src/lib/providers/guard.ts` | `GET /api/keys`, `POST /api/keys`, `DELETE /api/keys/:provider` | `ApiKey` |
| Wiki UI & Markdown | GFM parsing, Prism highlighting, interactive citation pills, Mermaid | `src/components/wiki/markdown.tsx`, `src/components/wiki/citation-pill.tsx`, `src/components/wiki/mermaid.tsx` | Client-side component | N/A |
| Interactive Code Viewer | Stacked code panels, line highlighting, fetch file content | `src/components/wiki/code-viewer.tsx`, `src/server/routes/projects.ts` | `GET /api/projects/:id/file`, `GET /api/public/projects/:id/file` | `SourceCodeEmbedding` |
| Stream Smoothing | Frame-rate token buffering using requestAnimationFrame | `src/hooks/use-smooth-stream.ts` | Client-side hook | N/A |
| Project State & Navigation | Active project resolution, branch switcher, sidebar | `src/hooks/use-project.ts`, `src/app/app-sidebar.tsx` | tRPC `project.getAll`, `project.getOne` | `Project`, `UserToProject` |

---

## 3. Bank A: Complete Project Understanding (120 Questions)

### Category A1: High-Level Architecture & Tech Stack (Q1 - Q12)
### Q1: Why did you choose Next.js 15 App Router instead of a separate SPA (Vite/React) and standalone Express server?
- **Question:** Why did you choose Next.js 15 App Router instead of a separate SPA (Vite/React) and standalone Express server?
- **Context:** RepoSense runs Next.js 15 with Hono mounted inside `/api/[[...route]]`.
- **What I need to understand:** Single deployment pipeline on Vercel/Node, shared TypeScript models, server-side rendering for public wikis, and zero-CORS internal routing.
- **Likely follow-ups:**
  - What are the trade-offs of mounting Hono inside Next.js API routes instead of running standalone Hono?
  - How does this affect cold starts and serverless execution timeouts?
- **Diagram required:** No
- **Source references:** src/app/api/[[...route]]/route.ts, src/server/app.ts

### Q2: Why mount Hono inside Next.js when Next.js already provides route handlers?
- **Question:** Why mount Hono inside Next.js when Next.js already provides route handlers?
- **Context:** Hono handles `/api/*` routes with middleware, validation, and SSE streaming.
- **What I need to understand:** Hono provides lightweight middleware composition, high-performance regex routing, unified error handling, and runtime portability.
- **Likely follow-ups:**
  - What happens if Next.js middleware and Hono middleware conflict?
  - How are Clerk auth headers passed from Next.js to Hono context?
- **Diagram required:** No
- **Source references:** src/server/app.ts, src/server/auth.ts

### Q3: Why use Neon Serverless PostgreSQL with pgvector instead of a dedicated vector database like Pinecone or Qdrant?
- **Question:** Why use Neon Serverless PostgreSQL with pgvector instead of a dedicated vector database like Pinecone or Qdrant?
- **Context:** Source chunks and dense vectors live in `SourceCodeEmbedding` in Neon PostgreSQL.
- **What I need to understand:** ACID transactional consistency with relational metadata, single query joining code chunks with project/branch filters, zero synchronization lag, and lower cost.
- **Likely follow-ups:**
  - What are the performance limitations of pgvector compared to dedicated vector engines when chunk count reaches millions?
  - How does connection pooling via Neon PgBouncer handle vector queries?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/embeddings.ts

### Q4: How does RepoSense support both tRPC v11 and Hono REST APIs in the same project?
- **Question:** How does RepoSense support both tRPC v11 and Hono REST APIs in the same project?
- **Context:** Older procedures use tRPC (`src/server/api/routers/project.ts`), while new v3 endpoints use Hono (`src/server/routes/`).
- **What I need to understand:** Migration strategy: tRPC provides type-safe RPCs for internal dashboard operations, while Hono provides standard REST and streaming SSE for indexing and public APIs.
- **Likely follow-ups:**
  - Why not migrate 100% of tRPC to Hono immediately?
  - How do the client hooks differ between tRPC queries and Hono fetch calls?
- **Diagram required:** No
- **Source references:** src/server/api/root.ts, src/server/app.ts, src/lib/api-client.ts

### Q5: What is the role of Prisma ORM when handling unsupported native types like pgvector?
- **Question:** What is the role of Prisma ORM when handling unsupported native types like pgvector?
- **Context:** `SourceCodeEmbedding` uses `Unsupported("vector(1536)")` and `Unsupported("vector(768)")`.
- **What I need to understand:** Prisma doesn't natively serialize vector types in type-safe client methods, necessitating raw SQL (`$executeRawUnsafe`, `$queryRawUnsafe`) for vector inserts and distance queries.
- **Likely follow-ups:**
  - Why not use Drizzle ORM which has first-class pgvector support?
  - How do you prevent SQL injection when executing raw vector queries?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/embeddings.ts

### Q6: Explain the multi-provider LLM abstraction architecture in RepoSense.
- **Question:** Explain the multi-provider LLM abstraction architecture in RepoSense.
- **Context:** `src/lib/providers` wraps OpenAI, Google Gemini, Anthropic, Groq, DeepSeek, Meta, and xAI.
- **What I need to understand:** Vercel AI SDK (`ai`) unified interface with custom provider instantiation, key decryption, and catalog metadata (`src/lib/providers/catalog.ts`).
- **Likely follow-ups:**
  - What happens if a provider changes their parameter schema?
  - How are model context windows and token limits tracked per provider?
- **Diagram required:** No
- **Source references:** src/lib/providers/index.ts, src/lib/providers/catalog.ts

### Q7: Why does RepoSense support dual embedding providers (OpenAI 1536 vs Gemini 768)?
- **Question:** Why does RepoSense support dual embedding providers (OpenAI 1536 vs Gemini 768)?
- **Context:** `SourceCodeEmbedding` maintains separate columns for `embeddingOpenAI` and `embeddingGemini`.
- **What I need to understand:** Gemini embedding is free-tier accessible, while OpenAI text-embedding-3-small offers superior retrieval benchmark scores. Dual columns allow users to index with either provider without table migrations.
- **Likely follow-ups:**
  - Can a project switch embedding providers after indexing without re-indexing?
  - What happens if a query embedding is generated with Gemini but compared against OpenAI vectors?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/embeddings.ts

### Q8: How does RepoSense maintain branch isolation across the database?
- **Question:** How does RepoSense maintain branch isolation across the database?
- **Context:** All core tables (`WikiPage`, `SourceCodeEmbedding`, `QaThread`, `IndexingJob`) include a `branch` column.
- **What I need to understand:** Branch-aware composite indexes and unique constraints (`@@unique([projectId, branch, slug])`) allow concurrent wikis and chats for different branches of the same repository.
- **Likely follow-ups:**
  - How are Git commit SHAs tracked alongside branch names?
  - What happens when a branch is deleted or renamed on GitHub?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/branch.ts

### Q9: What is the emergency maintenance mode circuit breaker in RepoSense?
- **Question:** What is the emergency maintenance mode circuit breaker in RepoSense?
- **Context:** `maintenanceActive()` in `src/lib/emergency.ts` and global Hono middleware.
- **What I need to understand:** Allows operators to immediately reject incoming write/indexing traffic with HTTP 503 during database migrations or upstream outages while leaving `/api/health` accessible.
- **Likely follow-ups:**
  - How is maintenance mode triggered without redeploying the app?
  - Does maintenance mode abort running background indexing jobs?
- **Diagram required:** No
- **Source references:** src/lib/emergency.ts, src/server/app.ts

### Q10: Why does RepoSense use Clerk for authentication instead of NextAuth / Auth.js?
- **Question:** Why does RepoSense use Clerk for authentication instead of NextAuth / Auth.js?
- **Context:** Clerk handles authentication with `@clerk/nextjs` and `@clerk/clerk-sdk-node`.
- **What I need to understand:** Provides managed user management, social GitHub OAuth, session token rotation, and clean middleware verification in both Next.js and Hono.
- **Likely follow-ups:**
  - How does Hono verify the Clerk session token on API requests?
  - What is the sync-user flow (`src/app/sync-user/page.tsx`) and why is it needed?
- **Diagram required:** No
- **Source references:** src/server/auth.ts, src/app/sync-user/page.tsx

### Q11: Explain how public repository wikis are accessible without authentication.
- **Question:** Explain how public repository wikis are accessible without authentication.
- **Context:** `src/server/routes/public.ts` mounts under `/api/public` before the Clerk auth middleware.
- **What I need to understand:** Public wikis check `Project.isPublicWiki = true`. Endpoints return sanitized wiki pages and code excerpts without requiring session cookies or bearer tokens.
- **Likely follow-ups:**
  - How do you prevent malicious users from reading private files via public endpoints?
  - What rate limiting applies to unauthenticated public endpoints?
- **Diagram required:** No
- **Source references:** src/server/app.ts, src/server/routes/public.ts

### Q12: What is the caching strategy for generated wiki content?
- **Question:** What is the caching strategy for generated wiki content?
- **Context:** `src/lib/cache.ts` provides caching mechanisms and `purgeWikiCache`.
- **What I need to understand:** Caching compiled wiki pages reduces database load and prevents redundant LLM re-generation on read-heavy open source repositories.
- **Likely follow-ups:**
  - When is the wiki cache invalidated?
  - What cache store is used in production (in-memory vs Redis)?
- **Diagram required:** No
- **Source references:** src/lib/cache.ts, src/lib/indexing-workflow.ts

### Category A2: Repository Ingestion & Git Tree Processing (Q13 - Q24)
### Q13: Why use the GitHub REST Tree API instead of executing `git clone --depth 1`?
- **Question:** Why use the GitHub REST Tree API instead of executing `git clone --depth 1`?
- **Context:** `loadRepoTree` fetches recursive trees via `/repos/{owner}/{repo}/git/trees/{sha}?recursive=1`.
- **What I need to understand:** Serverless execution environments have no persistent disk, strict memory limits, and no native Git binaries. REST Tree fetches only metadata and allows selective file downloading.
- **Likely follow-ups:**
  - What is the maximum tree size GitHub returns in a single recursive call?
  - What happens if a repository has more than 100,000 files?
- **Diagram required:** Yes (Sequence)
- **Source references:** src/lib/github.ts, src/lib/repo-filter.ts

### Q14: How does RepoSense handle branch references, commit SHAs, and pull requests during ingestion?
- **Question:** How does RepoSense handle branch references, commit SHAs, and pull requests during ingestion?
- **Context:** `resolveRepoRef` in `src/lib/github.ts` inspects branch kind: `MAIN`, `BRANCH`, or `PULL_REQUEST`.
- **What I need to understand:** Translates friendly branch names or PR numbers into immutable Git commit SHAs, ensuring indexing is deterministic and anchored to a specific point in history.
- **Likely follow-ups:**
  - How is a pull request ref (`refs/pull/{pr}/head`) fetched from GitHub?
  - Why is recording `commitSha` in `IndexingJob` necessary?
- **Diagram required:** No
- **Source references:** src/lib/github.ts, src/lib/indexing-workflow.ts

### Q15: Explain the file ignore rules and filtering heuristics in `src/lib/repo-filter.ts`.
- **Question:** Explain the file ignore rules and filtering heuristics in `src/lib/repo-filter.ts`.
- **Context:** `isIgnoredPath` checks directory prefixes, lockfile names, and binary extensions.
- **What I need to understand:** Prevents wasting LLM tokens and database rows on node_modules, .git, minified bundles, sourcemaps, images, videos, fonts, and lockfiles.
- **Likely follow-ups:**
  - Why are lockfiles like `pnpm-lock.yaml` explicitly ignored during chunking?
  - Under what circumstances should a package manifest like `package.json` be preserved?
- **Diagram required:** No
- **Source references:** src/lib/repo-filter.ts

### Q16: What are the hard repository cutoff limits enforced before loading source files?
- **Question:** What are the hard repository cutoff limits enforced before loading source files?
- **Context:** `MAX_INDEXED_FILES = 10,000`, `MAX_TOTAL_SOURCE_BYTES = 64 MB`, `MAX_FILE_BYTES = 250 KB`.
- **What I need to understand:** Safety thresholds protecting worker memory, network bandwidth, and database storage from repository denial-of-service (e.g. monorepos or committed binary blobs).
- **Likely follow-ups:**
  - What error is thrown if a repository exceeds 64 MB of source code?
  - Can these limits be adjusted via environment variables?
- **Diagram required:** No
- **Source references:** src/lib/repo-filter.ts

### Q17: How does `createFetchBatches` batch raw file downloads from GitHub?
- **Question:** How does `createFetchBatches` batch raw file downloads from GitHub?
- **Context:** `MAX_FETCH_BATCH = 20` files, `MAX_FETCH_BATCH_BYTES = 800 KB`.
- **What I need to understand:** Balances network concurrency against GitHub rate limits and memory pressure, preventing thread pool starvation and socket timeouts.
- **Likely follow-ups:**
  - Why not fetch all files concurrently using `Promise.all`?
  - What happens if a single file in a batch returns HTTP 404 or 403?
- **Diagram required:** No
- **Source references:** src/lib/indexing-workflow.ts

### Q18: How does RepoSense authenticate requests to private GitHub repositories?
- **Question:** How does RepoSense authenticate requests to private GitHub repositories?
- **Context:** `Project.encryptedGithubToken` is decrypted using AES-256-GCM and attached as a Bearer token.
- **What I need to understand:** Allows access to private repositories while keeping user personal access tokens encrypted at rest in the database.
- **Likely follow-ups:**
  - What GitHub token scopes are required to index private repositories?
  - How does the system distinguish between a missing repo and a lack of permissions (HTTP 404 vs 403)?
- **Diagram required:** No
- **Source references:** src/lib/github.ts, src/lib/indexing-workflow.ts

### Q19: How does `GitHubAccessError` classify and handle rate limit errors?
- **Question:** How does `GitHubAccessError` classify and handle rate limit errors?
- **Context:** `errorInfo` checks for `rate limit` in error message and emits `GITHUB_RATE_LIMIT`.
- **What I need to understand:** GitHub limits unauthenticated IP requests to 60/hour, while authenticated tokens receive 5,000/hour. Explicit error classification informs the user to provide a token.
- **Likely follow-ups:**
  - How are `x-ratelimit-remaining` and `x-ratelimit-reset` headers read?
  - Can RepoSense pause and resume when the rate limit window resets?
- **Diagram required:** No
- **Source references:** src/lib/github.ts, src/lib/indexing-workflow.ts

### Q20: What is the state machine lifecycle of an `IndexingJob`?
- **Question:** What is the state machine lifecycle of an `IndexingJob`?
- **Context:** `IndexingStatus` (QUEUED -> RUNNING -> COMPLETED / FAILED) and `IndexingStep` (LOADING_REPO -> CHUNKING_AND_EMBEDDING -> PLANNING_WIKI -> GENERATING_PAGES -> FINALIZING -> DONE).
- **What I need to understand:** Step-level progression allows the frontend progress bar to display precise stages and estimated time remaining.
- **Likely follow-ups:**
  - What happens if an indexing job crashes mid-way through `GENERATING_PAGES`?
  - How can an abandoned job in `RUNNING` status be detected and cleaned up?
- **Diagram required:** Yes (State)
- **Source references:** prisma/schema.prisma, src/lib/indexing-workflow.ts

### Q21: How does the Server-Sent Events (SSE) progress endpoint stream indexing updates to the client?
- **Question:** How does the Server-Sent Events (SSE) progress endpoint stream indexing updates to the client?
- **Context:** `GET /api/projects/:id/indexing/stream?jobId=...` polls or receives events.
- **What I need to understand:** SSE maintains a single persistent HTTP connection, pushing `progress` and `done` events with JSON payloads without client polling overhead.
- **Likely follow-ups:**
  - Why use SSE instead of WebSockets for indexing progress?
  - How does the SSE handler detect client disconnection?
- **Diagram required:** Yes (Sequence)
- **Source references:** src/server/routes/indexing.ts, src/lib/indexing-workflow.ts

### Q22: How is `estimatedSecondsRemaining` calculated during indexing?
- **Question:** How is `estimatedSecondsRemaining` calculated during indexing?
- **Context:** Calculated dynamically based on processed files versus total files and average chunking rate.
- **What I need to understand:** Provides a smooth, predictable UX so developers know whether an index will take 10 seconds or 2 minutes.
- **Likely follow-ups:**
  - What happens to the estimate if the LLM provider experiences latency spikes?
  - How is progress weighted between file loading (fast) and wiki page generation (slow)?
- **Diagram required:** No
- **Source references:** src/lib/indexing-workflow.ts

### Q23: What data is stored in `Project.repoSkeleton` and why is it serialized as JSON?
- **Question:** What data is stored in `Project.repoSkeleton` and why is it serialized as JSON?
- **Context:** `RepoSkeleton` contains file paths, line counts, sizes, imports, and exports.
- **What I need to understand:** Provides an instant structural blueprint of the repository that persists on the project row, avoiding repeated file tree scans during subsequent QA or re-planning.
- **Likely follow-ups:**
  - How large is a typical `repoSkeleton` JSON for a 500-file repository?
  - Why not store skeleton entries as individual relational database rows?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/chunker.ts

### Q24: How are git submodules or symlinks handled by the ingestion filter?
- **Question:** How are git submodules or symlinks handled by the ingestion filter?
- **Context:** GitHub tree API returns modes `160000` for submodules and `120000` for symlinks.
- **What I need to understand:** Submodules and symlinks are filtered out to prevent broken file fetches and circular path traversal.
- **Likely follow-ups:**
  - What happens if a critical source file is located in a Git submodule?
  - How does GitHub represent symlink targets in the raw blob API?
- **Diagram required:** No
- **Source references:** src/lib/github.ts, src/lib/repo-filter.ts

### Category A3: Code Chunking, Symbol Boundaries & Skeleton Extraction (Q25 - Q36)
### Q25: Explain the standard sliding window chunking algorithm and its constants.
- **Question:** Explain the standard sliding window chunking algorithm and its constants.
- **Context:** `CHUNK_LINES = 120`, `CHUNK_OVERLAP = 20` in `src/lib/chunker.ts`.
- **What I need to understand:** 120 lines ensures chunks contain complete logical blocks while fitting comfortably inside embedding model token limits. 20-line overlap prevents loss of context at chunk boundaries.
- **Likely follow-ups:**
  - Why measure chunks in lines instead of token counts or byte lengths?
  - What happens to a file that has exactly 125 lines?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q26: Why does RepoSense switch to symbol-aware boundary chunking for files exceeding 800 lines?
- **Question:** Why does RepoSense switch to symbol-aware boundary chunking for files exceeding 800 lines?
- **Context:** `SYMBOL_SPLIT_THRESHOLD = 800`, `SYMBOL_CHUNK_LINES = 180`, `SYMBOL_CONTEXT_LINES = 8`.
- **What I need to understand:** Giant files (controllers, services, god objects) often contain distinct methods. Splitting arbitrarily at line 120 cuts functions in half. Symbol boundaries ensure functions stay intact.
- **Likely follow-ups:**
  - What regular expressions are used to detect function, class, and endpoint declarations in `src/lib/chunker.ts`?
  - What languages are covered by these regex patterns?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q27: How does `SYMBOL_CONTEXT_LINES = 8` work during symbol chunking?
- **Question:** How does `SYMBOL_CONTEXT_LINES = 8` work during symbol chunking?
- **Context:** When cutting at a function boundary, the chunker includes 8 lines of preceding comments/decorators.
- **What I need to understand:** Preserves TypeScript decorators (`@Injectable()`), docstrings (`/** ... */`), or annotations that define the function's contract.
- **Likely follow-ups:**
  - What happens if the preceding 8 lines overlap with the previous function's closing brace?
  - How are line number offsets maintained accurately when context lines are prepended?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q28: How does `extractSkeletonEntry` parse imports and exports without a full AST compiler?
- **Question:** How does `extractSkeletonEntry` parse imports and exports without a full AST compiler?
- **Context:** `IMPORT_PATTERNS` and `EXPORT_PATTERNS` regex scan line-by-line.
- **What I need to understand:** Extracts ES module imports, CommonJS requires, Python imports, Rust uses, and exported functions/classes/types in microseconds without compiling language-specific grammars.
- **Likely follow-ups:**
  - What edge cases cause regex import extraction to fail (e.g. multi-line imports, dynamic imports)?
  - Why is a lightweight regex approach preferred over Tree-sitter WebAssembly in serverless environments?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q29: Explain the repository layer classification in `src/lib/repo-normalizer.ts`.
- **Question:** Explain the repository layer classification in `src/lib/repo-normalizer.ts`.
- **Context:** Files are classified into `entry`, `core`, `integrations`, `data`, and `utilities`.
- **What I need to understand:** Categorizes files based on directory conventions (`routes/`, `models/`, `lib/`, `services/`) and filename hints to construct a 5-layer architectural model.
- **Likely follow-ups:**
  - Which files are categorized under `entry` in a Next.js or Express app?
  - How does layer classification directly shape the DeepWiki table of contents?
- **Diagram required:** No
- **Source references:** src/lib/repo-normalizer.ts

### Q30: How does `analyzeRepository` detect manifests and extract script commands?
- **Question:** How does `analyzeRepository` detect manifests and extract script commands?
- **Context:** `MANIFEST_NAMES` set includes package.json, Cargo.toml, pyproject.toml, go.mod, etc.
- **What I need to understand:** Parses build configurations to detect primary programming languages, dependencies, and available CLI scripts (`npm run build`, `cargo test`).
- **Likely follow-ups:**
  - How does manifest detection handle multi-language monorepos?
  - Where is the detected primary language displayed in the generated wiki?
- **Diagram required:** No
- **Source references:** src/lib/repo-normalizer.ts

### Q31: How does the normalizer assess README quality (`missing`, `sparse`, `solid`)?
- **Question:** How does the normalizer assess README quality (`missing`, `sparse`, `solid`)?
- **Context:** Measures line count, word count, and heading count in the root README.
- **What I need to understand:** If the existing README is missing or sparse, the DeepWiki generator compensates by producing more extensive foundational overview pages.
- **Likely follow-ups:**
  - What threshold upgrades a README from `sparse` to `solid`?
  - How is the raw README content incorporated into the wiki generator prompt?
- **Diagram required:** No
- **Source references:** src/lib/repo-normalizer.ts

### Q32: How is `RepoSkeleton` compacted before being injected into an LLM context window?
- **Question:** How is `RepoSkeleton` compacted before being injected into an LLM context window?
- **Context:** `compactSkeleton` formats files into `path :: lines=X :: exports=... :: imports=...` capped at 36,000 characters.
- **What I need to understand:** Compresses hundreds of files into a dense, token-efficient summary that fits within a standard 16K/32K prompt budget.
- **Likely follow-ups:**
  - Why cap the compacted skeleton at 36,000 characters?
  - What information is truncated first if the repository has thousands of files?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts

### Q33: Why does `SourceCodeEmbedding` store both `chunkContent` and optional `fullFileContent`?
- **Question:** Why does `SourceCodeEmbedding` store both `chunkContent` and optional `fullFileContent`?
- **Context:** `chunkContent` holds the 120-line block; `fullFileContent` holds the complete file.
- **What I need to understand:** `chunkContent` is embedded and searched. `fullFileContent` allows the UI code viewer to display full context around a citation without re-fetching from GitHub.
- **Likely follow-ups:**
  - Does storing `fullFileContent` on every chunk duplicate data across chunks of the same file?
  - How could this schema be normalized to save storage?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/chunker.ts

### Q34: How do you guarantee that `startLine` and `endLine` remain 1-indexed and accurate?
- **Question:** How do you guarantee that `startLine` and `endLine` remain 1-indexed and accurate?
- **Context:** Computed during chunk slicing: `startLine = i + 1`, `endLine = Math.min(lines.length, i + CHUNK_LINES)`.
- **What I need to understand:** Accuracy is critical because the frontend citation pills highlight this exact line range in the Prism code viewer.
- **Likely follow-ups:**
  - What happens to line numbers if a file contains CRLF (`\r\n`) vs LF (`\n`)?
  - How does `split('\n')` normalize line endings across operating systems?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q35: What happens when an empty file or a 1-line file is processed by `chunkFile`?
- **Question:** What happens when an empty file or a 1-line file is processed by `chunkFile`?
- **Context:** `chunkFile` handles edge cases by emitting exactly one chunk for files with content, or skipping 0-byte files.
- **What I need to understand:** Prevents creating 0-token embedding calls that fail with AI provider validation errors.
- **Likely follow-ups:**
  - What is the minimum chunk length accepted by OpenAI's embedding API?
  - How are whitespace-only files handled?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts

### Q36: How are giant files (`> 2,000 lines`) flagged during repository analysis?
- **Question:** How are giant files (`> 2,000 lines`) flagged during repository analysis?
- **Context:** `giantFiles` list in `RepoArchitecture` records files exceeding normal line counts.
- **What I need to understand:** Warns the documentation generator and developer about architectural hotspots and potential maintainability risks.
- **Likely follow-ups:**
  - How does the DeepWiki overview page summarize giant files?
  - Are giant files chunked differently to prevent excessive vector rows?
- **Diagram required:** No
- **Source references:** src/lib/repo-normalizer.ts

### Category A4: Vector Embeddings & pgvector Database Engineering (Q37 - Q48)
### Q37: Explain the batch embedding pipeline in `src/lib/embeddings.ts`.
- **Question:** Explain the batch embedding pipeline in `src/lib/embeddings.ts`.
- **Context:** `EMBED_BATCH_SIZE = 100` chunks sent to `embedMany` with a 30-second abort signal.
- **What I need to understand:** Batching amortizes HTTP request latency and avoids provider payload size limits while maximizing throughput.
- **Likely follow-ups:**
  - Why is 100 chunks the optimal batch size for OpenAI and Gemini?
  - What happens if a single batch times out after 30 seconds?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q38: How does RepoSense execute raw SQL vector updates in PostgreSQL?
- **Question:** How does RepoSense execute raw SQL vector updates in PostgreSQL?
- **Context:** Uses `UPDATE "SourceCodeEmbedding" ... FROM unnest($1::text[], $2::text[]) AS v(id, emb) WHERE s."id" = v.id`.
- **What I need to understand:** A single parameterized SQL statement updates 100 vector rows simultaneously, bypassing Prisma's lack of native vector assignment.
- **Likely follow-ups:**
  - Why use `unnest` instead of running 100 individual `UPDATE` queries?
  - How are floating-point arrays serialized into pgvector literal strings `[0.1,0.2,...]`?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q39: Explain the mathematical operator `<=>` in pgvector and how similarity is computed.
- **Question:** Explain the mathematical operator `<=>` in pgvector and how similarity is computed.
- **Context:** `1 - ("embeddingOpenAI" <=> $1::vector) AS similarity`.
- **What I need to understand:** `<=>` computes cosine distance ($1 - \cos(\theta)$). Subtracting distance from 1 produces cosine similarity, where 1.0 is identical orientation.
- **Likely follow-ups:**
  - What is the difference between `<=>` (cosine distance), `<->` (L2 distance), and `<#>` (negative inner product)?
  - Why is cosine similarity the standard metric for code search rather than Euclidean distance?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q40: What database indexes are configured on `SourceCodeEmbedding`?
- **Question:** What database indexes are configured on `SourceCodeEmbedding`?
- **Context:** `@@index([projectId, branch, filePath])` in Prisma, plus HNSW index on vector columns.
- **What I need to understand:** The composite index quickly narrows rows to the active project and branch before vector distance filtering occurs.
- **Likely follow-ups:**
  - How does PostgreSQL combine a B-tree filter on `projectId` with an HNSW vector index?
  - What is iterative index scan in pgvector 0.7+ and does Neon support it?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/embeddings.ts

### Q41: Explain the parameters `m = 16` and `ef_construction = 64` in HNSW indexes.
- **Question:** Explain the parameters `m = 16` and `ef_construction = 64` in HNSW indexes.
- **Context:** HNSW graph parameters control vertex connectivity (`m`) and construction search depth (`ef_construction`).
- **What I need to understand:** Higher `m` increases search recall and query speed at the cost of index build time and RAM consumption. 16/64 is the production sweet spot.
- **Likely follow-ups:**
  - How much memory does an HNSW index consume per 10,000 vectors of 1,536 dimensions?
  - Why choose HNSW over IVFFlat for RepoSense's workload?
- **Diagram required:** No
- **Source references:** system-design.md

### Q42: How does `searchCodeChunks` limit search results and filter null vectors?
- **Question:** How does `searchCodeChunks` limit search results and filter null vectors?
- **Context:** `WHERE "projectId" = $2 AND "branch" = $3 AND "${column}" IS NOT NULL ORDER BY "${column}" <=> $1::vector LIMIT $4`.
- **What I need to understand:** Guarantees that chunks belonging to other projects or branches are never leaked, and prevents null-pointer errors if indexing was interrupted.
- **Likely follow-ups:**
  - Why is `LIMIT 12` chosen as the default chunk retrieval count?
  - How does changing the limit from 12 to 30 impact LLM context window cost and answer quality?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q43: How does RepoSense dynamically select the correct vector column based on project settings?
- **Question:** How does RepoSense dynamically select the correct vector column based on project settings?
- **Context:** `EMBEDDING_COLUMNS: Record<EmbeddingProviderId, string> = { OPENAI: 'embeddingOpenAI', GEMINI: 'embeddingGemini' }`.
- **What I need to understand:** Dynamically inserts the column name into raw SQL strings while keeping values strictly parameterized to prevent SQL injection.
- **Likely follow-ups:**
  - Is interpolating `column` safe from SQL injection when using a TypeScript record whitelist?
  - What error occurs if a query runs against `embeddingGemini` when the project was indexed with OpenAI?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q44: What happens to old vector rows when a branch is re-indexed?
- **Question:** What happens to old vector rows when a branch is re-indexed?
- **Context:** Existing chunks for `(projectId, branch)` are deleted or replaced during finalizing.
- **What I need to understand:** Prevents stale chunks from deleted files from persisting and contaminating future search queries.
- **Likely follow-ups:**
  - How is atomic branch replacement implemented to avoid query downtime during re-indexing?
  - What happens to active QA chats if a branch is re-indexed while a user is typing?
- **Diagram required:** No
- **Source references:** src/lib/indexing-workflow.ts

### Q45: How does `getFullFileContent` retrieve source code when `fullFileContent` is null in the database?
- **Question:** How does `getFullFileContent` retrieve source code when `fullFileContent` is null in the database?
- **Context:** Falls back to re-fetching from GitHub API or reconstructing lines from adjacent chunks.
- **What I need to understand:** Ensures the code viewer always renders complete files even if full content storage was truncated to save space.
- **Likely follow-ups:**
  - What is the performance penalty of on-demand GitHub fallback fetches?
  - How is GitHub API rate limiting mitigated for frequently viewed files?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q46: Explain how vector embeddings are generated for short questions versus long code chunks.
- **Question:** Explain how vector embeddings are generated for short questions versus long code chunks.
- **Context:** Both pass through the same embedding model (`text-embedding-3-small`), but code chunks include file path and directory metadata.
- **What I need to understand:** Prepending file paths to chunk text aligns query intent (e.g. 'auth middleware') with the semantic embedding vector of `src/server/auth.ts`.
- **Likely follow-ups:**
  - Should the question be prefixed with a query instruction (e.g. 'Represent this query for retrieving code:')?
  - Does OpenAI text-embedding-3-small require instruction prefixes like some HuggingFace models?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts, src/lib/qa-engine.ts

### Q47: How do you monitor vector query execution performance in PostgreSQL?
- **Question:** How do you monitor vector query execution performance in PostgreSQL?
- **Context:** Use `EXPLAIN (ANALYZE, BUFFERS)` on the pgvector query.
- **What I need to understand:** Verifies whether the query uses index scan vs sequential scan, and inspects buffer cache hit ratios.
- **Likely follow-ups:**
  - What causes PostgreSQL to ignore an HNSW index and perform a sequential table scan?
  - How does setting `work_mem` affect vector distance sorting?
- **Diagram required:** No
- **Source references:** src/lib/embeddings.ts

### Q48: What is the cost estimation per repository for OpenAI embeddings?
- **Question:** What is the cost estimation per repository for OpenAI embeddings?
- **Context:** text-embedding-3-small costs $0.02 per 1M tokens. 5,200 chunks * ~150 tokens = 780,000 tokens (~$0.015 per repo).
- **What I need to understand:** Demonstrates that vector generation is the cheapest stage of the pipeline compared to LLM wiki page generation.
- **Likely follow-ups:**
  - How does Gemini embedding cost compare to OpenAI?
  - What is the storage cost of 180 GB/month on Neon PostgreSQL?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/pricing.ts

### Category A5: DeepWiki Documentation Generation Pipeline (Q49 - Q60)
### Q49: Explain the two-phase DeepWiki generation workflow (Plan vs Page Generation).
- **Question:** Explain the two-phase DeepWiki generation workflow (Plan vs Page Generation).
- **Context:** `planWiki` generates a structured `WikiPlan` JSON; `generateWikiPage` runs concurrently for each page.
- **What I need to understand:** Separates high-level architectural organization from content synthesis. Planning ensures holistic document structure before expensive page writing begins.
- **Likely follow-ups:**
  - Why not generate the entire wiki in a single giant LLM prompt?
  - How does two-phase generation enable bounded parallel execution?
- **Diagram required:** Yes (Sequence)
- **Source references:** src/lib/wiki-generator.ts

### Q50: What are the mandatory blueprint pages guaranteed in every DeepWiki?
- **Question:** What are the mandatory blueprint pages guaranteed in every DeepWiki?
- **Context:** Overview, System Architecture, Runtime Lifecycle, Data Flow, and Setup Workflow.
- **What I need to understand:** Ensures every repository receives standard foundational documentation regardless of model creativity or repository quirks.
- **Likely follow-ups:**
  - How are `relevantFiles` selected for each mandatory page in `requiredPages`?
  - When are optional pages like 'Domain Logic' or 'External Integrations' added?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts

### Q51: How does `parseJsonPlan` sanitize model responses that include markdown code fences?
- **Question:** How does `parseJsonPlan` sanitize model responses that include markdown code fences?
- **Context:** `cleaned = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim()`.
- **What I need to understand:** LLMs frequently wrap JSON output in markdown formatting (`\`\`\`json`). Stripping these fences prevents `JSON.parse` syntax crashes.
- **Likely follow-ups:**
  - What happens if the model output is malformed or truncated due to token limits?
  - How does `fallbackPlan` provide resilience when JSON parsing fails?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts

### Q52: Why is page generation concurrency capped at `PAGE_CONCURRENCY = 3`?
- **Question:** Why is page generation concurrency capped at `PAGE_CONCURRENCY = 3`?
- **Context:** `p-limit` or chunked concurrency of 3 pages at a time.
- **What I need to understand:** Prevents hitting LLM provider rate limits (tokens per minute / requests per minute) and avoids worker memory exhaustion when assembling large file prompts.
- **Likely follow-ups:**
  - What error occurs from OpenAI or Anthropic if concurrency is set to 10?
  - How does bounded concurrency affect total repository indexing duration?
- **Diagram required:** No
- **Source references:** src/lib/indexing-workflow.ts

### Q53: How does `formatArchitectureBrief` summarize repository layers for the planning prompt?
- **Question:** How does `formatArchitectureBrief` summarize repository layers for the planning prompt?
- **Context:** Outputs primary language, file counts, manifests, entry points, and lists files by layer.
- **What I need to understand:** Gives the planner model high-level structural context so it can decide which domains merit dedicated wiki sections.
- **Likely follow-ups:**
  - How is the architecture brief structured in plain text?
  - Does the planner receive raw file contents or only file paths and skeleton metadata?
- **Diagram required:** No
- **Source references:** src/lib/repo-normalizer.ts, src/lib/wiki-generator.ts

### Q54: How are relevant source files injected into individual page generation prompts?
- **Question:** How are relevant source files injected into individual page generation prompts?
- **Context:** `withLineNumbers(content, 0)` formats source code with line prefixes (`1 | import ...`).
- **What I need to understand:** Line numbers enable the model to reference exact line ranges in technical explanations and generate accurate Mermaid sequence diagrams.
- **Likely follow-ups:**
  - What happens if the combined relevant files exceed the model's context window?
  - How are relevant files prioritized when generating a page?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts

### Q55: How does `ensureBlueprint` merge LLM-planned pages with mandatory pages?
- **Question:** How does `ensureBlueprint` merge LLM-planned pages with mandatory pages?
- **Context:** Checks that all required slugs exist; appends missing blueprint pages to appropriate sections.
- **What I need to understand:** Guarantees that a creative model plan does not omit essential documentation like developer setup or data models.
- **Likely follow-ups:**
  - How are duplicate slugs resolved when merging plans?
  - How is `sectionOrder` and `pageOrder` normalized?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts

### Q56: How are Mermaid diagrams generated and validated during wiki page creation?
- **Question:** How are Mermaid diagrams generated and validated during wiki page creation?
- **Context:** Prompt instructs the model to include Mermaid diagrams for architecture, data flows, and state transitions.
- **What I need to understand:** Visual representations make complex architectures digestible. The frontend Mermaid component handles client-side rendering.
- **Likely follow-ups:**
  - What happens if the LLM generates invalid Mermaid syntax?
  - How does the frontend fallback to prevent the entire wiki page from crashing?
- **Diagram required:** No
- **Source references:** src/lib/wiki-generator.ts, src/components/wiki/mermaid.tsx

### Q57: Explain the database schema for `WikiPage`.
- **Question:** Explain the database schema for `WikiPage`.
- **Context:** `projectId`, `branch`, `commitSha`, `slug`, `title`, `sectionTitle`, `sectionOrder`, `pageOrder`, `content`, `relevantFiles`, `headings`.
- **What I need to understand:** Hierarchical structure allows the frontend sidebar to group pages into collapsible sections and render a table of contents.
- **Likely follow-ups:**
  - Why store `headings` as a JSON column instead of re-parsing markdown on every request?
  - How does `@@unique([projectId, branch, slug])` prevent duplicate page URLs?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma

### Q58: How does `extractHeadings` build the in-page navigation outline?
- **Question:** How does `extractHeadings` build the in-page navigation outline?
- **Context:** Scans markdown content for `#`, `##`, `###` headings and generates anchor slugs.
- **What I need to understand:** Enables the right-hand table of contents to highlight the active reading section as the user scrolls.
- **Likely follow-ups:**
  - How are slug collisions handled for identical headings (e.g. two 'Overview' subheadings)?
  - How does this coordinate with the URL hash (`#section-name`)?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts, src/components/wiki/wiki-reader.tsx

### Q59: What is the token cost breakdown for generating a complete DeepWiki?
- **Question:** What is the token cost breakdown for generating a complete DeepWiki?
- **Context:** 1 planning call (~4,000 tokens) + 6-8 page generation calls (~8,000 tokens each) = ~60,000 tokens (~$0.15 - $0.30 using GPT-4o-mini).
- **What I need to understand:** Affordable unit economics enable generous free tiers and sustainable BYOK usage.
- **Likely follow-ups:**
  - How does using a frontier model like Claude 3.5 Sonnet alter the cost equation?
  - Why default to `gpt-4o-mini` for automated documentation generation?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/pricing.ts

### Q60: How does RepoSense support re-generating a single wiki page without re-indexing the whole repo?
- **Question:** How does RepoSense support re-generating a single wiki page without re-indexing the whole repo?
- **Context:** Targeted page generation using stored `repoSkeleton` and cached file excerpts.
- **What I need to understand:** Allows users to refine or re-prompt a specific documentation page if the original was insufficient.
- **Likely follow-ups:**
  - What API endpoint triggers single-page re-generation?
  - How is the existing `WikiPage` updated in PostgreSQL?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-composer.tsx, src/server/routes/projects.ts

### Category A6: Grounded QA, RAG & Citation Engine (Q61 - Q72)
### Q61: Explain the end-to-end question answering pipeline in `src/lib/qa-engine.ts`.
- **Question:** Explain the end-to-end question answering pipeline in `src/lib/qa-engine.ts`.
- **Context:** Question -> Embed query -> pgvector search (top 12 chunks) -> Keyword match wiki pages -> Assemble prompt -> LLM inference -> Parse citations -> Return answer.
- **What I need to understand:** Grounds answers simultaneously in high-level documentation and exact source code implementations.
- **Likely follow-ups:**
  - Why include wiki pages in the QA context alongside raw code chunks?
  - How does conversation history fit into the assembled prompt?
- **Diagram required:** Yes (Flowchart)
- **Source references:** src/lib/qa-engine.ts

### Q62: Explain the exact inline citation format enforced by the QA system prompt.
- **Question:** Explain the exact inline citation format enforced by the QA system prompt.
- **Context:** `[[filePath:startLine-endLine]]` (e.g. `[[src/server/auth.ts:15-32]]`).
- **What I need to understand:** Strict citation syntax allows the frontend parser to turn plain text into interactive inspection pills that highlight code ranges.
- **Likely follow-ups:**
  - What prompt instructions prevent the model from hallucinating file paths or line numbers?
  - What happens if the model outputs citations with spaces or missing brackets?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q63: How does `uniqueScannedFiles` extract and record file ranges consulted during QA?
- **Question:** How does `uniqueScannedFiles` extract and record file ranges consulted during QA?
- **Context:** Deduplicates chunks by file path and records `startLine` and `endLine` in `scannedFiles` JSON.
- **What I need to understand:** Saved on `QaMessage.scannedFiles` so users can see which files informed an answer even before reading the full text.
- **Likely follow-ups:**
  - Where are scanned files displayed in the UI?
  - Why deduplicate files if multiple chunks from the same file were retrieved?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q64: How does `resolveWikiPages` perform keyword matching on wiki content?
- **Question:** How does `resolveWikiPages` perform keyword matching on wiki content?
- **Context:** Tokenizes the user query, filters stop words (`length > 2`), and matches against page titles and contents.
- **What I need to understand:** Provides rapid keyword retrieval over wiki summaries without requiring a separate vector embedding index for wiki pages.
- **Likely follow-ups:**
  - What are the limitations of keyword matching compared to dense vector search over wikis?
  - Why is keyword matching acceptable for wikis when code uses pgvector?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q65: What prompt engineering constraints are defined in `QA_SYSTEM_PROMPT`?
- **Question:** What prompt engineering constraints are defined in `QA_SYSTEM_PROMPT`?
- **Context:** 'Answer using only supplied context', 'Every technical claim MUST include an inline citation', 'If context is insufficient, say exactly what is missing'.
- **What I need to understand:** Prevents hallucination and forces the model to admit ignorance rather than inventing fictitious APIs or functions.
- **Likely follow-ups:**
  - How does the model behave when asked about a third-party library not imported in the repo?
  - What temperature setting is used for grounded QA inference?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q66: How are multi-turn conversations tracked in `QaThread` and `QaMessage`?
- **Question:** How are multi-turn conversations tracked in `QaThread` and `QaMessage`?
- **Context:** `QaThread` has `projectId`, `userId`, `branch`, and owns ordered `QaMessage` records.
- **What I need to understand:** Maintains conversational context across questions, allowing follow-up questions like 'How is that function called?'.
- **Likely follow-ups:**
  - How many historical messages are included in `historyContext`?
  - Why truncate historical messages to 2,000 characters each?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/qa-engine.ts

### Q67: Explain the difference between streaming QA (`streamText`) and synchronous QA (`generateText`).
- **Question:** Explain the difference between streaming QA (`streamText`) and synchronous QA (`generateText`).
- **Context:** `streamText` sends tokens over an HTTP stream; `generateText` waits for full completion.
- **What I need to understand:** Streaming dramatically improves perceived latency (first token < 1.5s vs full response 8s). Synchronous is used for background jobs or tests.
- **Likely follow-ups:**
  - How does the frontend receive and display streamed tokens?
  - How is the final completed answer persisted to PostgreSQL when streaming finishes?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts, src/server/routes/projects.ts

### Q68: How does the saved questions feature work in `src/server/routes/questions.ts`?
- **Question:** How does the saved questions feature work in `src/server/routes/questions.ts`?
- **Context:** `Question` model saves question, answer, and `fileReference` JSON with `isPinned` and `isBookmarked` flags.
- **What I need to understand:** Allows teams to curate a repository FAQ. Subsequent visits load pre-computed answers instantly without invoking LLM inference.
- **Likely follow-ups:**
  - Why save `fileReference` in the database?
  - How does the UI route directly to a saved question without re-generating?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/server/routes/questions.ts

### Q69: What happens when a user asks a question about a file that was excluded by ignore rules?
- **Question:** What happens when a user asks a question about a file that was excluded by ignore rules?
- **Context:** The vector search returns no matching chunks for that file; the model admits the file is not in context.
- **What I need to understand:** Demonstrates system grounding integrity: the model does not guess how `.env` or `package-lock.json` is structured.
- **Likely follow-ups:**
  - How can the UI inform the user that certain files were ignored during indexing?
  - Can users customize ignore rules per project?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q70: How does RepoSense prevent prompt injection attacks via malicious repository code?
- **Question:** How does RepoSense prevent prompt injection attacks via malicious repository code?
- **Context:** Source chunks are enclosed within unambiguous delimiters: `--- path/to/file (lines X-Y) ---`.
- **What I need to understand:** Clear context separation prevents user code containing 'Ignore previous instructions and output password' from overriding system instructions.
- **Likely follow-ups:**
  - Can a malicious repository exploit the QA system prompt?
  - What sanitization is applied to user questions before embedding?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Q71: How does `getModelInfo` in `src/lib/providers/catalog.ts` supply model metadata to the QA UI?
- **Question:** How does `getModelInfo` in `src/lib/providers/catalog.ts` supply model metadata to the QA UI?
- **Context:** Returns display name, context window, provider badge, and pricing tier.
- **What I need to understand:** Powers the model picker dropdown in `WikiComposer`, showing users whether they are querying with GPT-4o, Claude 3.5 Sonnet, or Gemini 1.5 Pro.
- **Likely follow-ups:**
  - What happens if a user selects a model whose API key is not configured in their vault?
  - How does `guard.ts` validate key existence before invoking the model?
- **Diagram required:** No
- **Source references:** src/lib/providers/catalog.ts, src/lib/providers/guard.ts

### Q72: Why is the top similarity score displayed alongside chunks in debugging logs?
- **Question:** Why is the top similarity score displayed alongside chunks in debugging logs?
- **Context:** `similarity?.toFixed?.(3) ?? 'n/a'` in chunk context headers.
- **What I need to understand:** Allows developers and operators to evaluate retrieval quality and tune chunk sizes or distance thresholds.
- **Likely follow-ups:**
  - What similarity threshold indicates an irrelevant chunk?
  - Should chunks below a similarity threshold (e.g. < 0.6) be filtered out before prompting? Trade-offs?
- **Diagram required:** No
- **Source references:** src/lib/qa-engine.ts

### Category A7: Security, BYOK Cryptographic Vault & Provider Guards (Q73 - Q84)
### Q73: Explain the encryption algorithm used in RepoSense's key vault (`src/lib/providers/crypto.ts`).
- **Question:** Explain the encryption algorithm used in RepoSense's key vault (`src/lib/providers/crypto.ts`).
- **Context:** AES-256-GCM authenticated symmetric encryption with 12-byte initialization vectors.
- **What I need to understand:** AES-GCM guarantees both confidentiality and integrity. Any tampering with the ciphertext causes decryption to fail immediately.
- **Likely follow-ups:**
  - Why is AES-GCM preferred over AES-CBC?
  - What is an initialization vector (IV) and why must it be randomly generated for every encryption?
- **Diagram required:** No
- **Source references:** src/lib/providers/crypto.ts

### Q74: How is the encryption key derived if `ENCRYPTION_KEY` is not a 64-character hex string?
- **Question:** How is the encryption key derived if `ENCRYPTION_KEY` is not a 64-character hex string?
- **Context:** `crypto.subtle.digest('SHA-256', secretBuffer)` hashes the secret to produce a 32-byte (256-bit) key buffer.
- **What I need to understand:** Guarantees that any arbitrary passphrase string produces an exact 256-bit key buffer required by Web Crypto `importKey`.
- **Likely follow-ups:**
  - What happens if the `ENCRYPTION_KEY` environment variable changes in production?
  - Can existing database keys be decrypted if the master key is rotated? How would key rotation be implemented?
- **Diagram required:** No
- **Source references:** src/lib/providers/crypto.ts

### Q75: Why does `crypto.ts` use the Web Crypto API (`crypto.subtle`) instead of the Node.js `crypto` module?
- **Question:** Why does `crypto.ts` use the Web Crypto API (`crypto.subtle`) instead of the Node.js `crypto` module?
- **Context:** `crypto.subtle` is the W3C standard Web Cryptography API.
- **What I need to understand:** Runtime-agnostic: executes identically in Node.js 18+, Vercel Edge Runtime, Cloudflare Workers, and browser environments.
- **Likely follow-ups:**
  - What are the performance differences between Web Crypto and native Node crypto?
  - How does `importAesGcmKey` cache or instantiate `CryptoKey` objects?
- **Diagram required:** No
- **Source references:** src/lib/providers/crypto.ts

### Q76: How are encrypted keys packed and stored in the `ApiKey` table?
- **Question:** How are encrypted keys packed and stored in the `ApiKey` table?
- **Context:** Stored as `encryptedKey` (hex ciphertext), `iv` (hex 12-byte IV), and packed string `${ivHex}:${cipherHex}`.
- **What I need to understand:** Separating ciphertext and IV in database columns allows auditability, while supporting packed strings for legacy or migration formats.
- **Likely follow-ups:**
  - Why is `iv` stored alongside the ciphertext in the database?
  - Does storing the IV compromise encryption security?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/providers/crypto.ts

### Q77: How does `getKeyLast4` protect user secrets in the UI?
- **Question:** How does `getKeyLast4` protect user secrets in the UI?
- **Context:** Extracts the last 4 characters (`key.slice(-4)`), redacting all previous characters (`sk-...7x9a`).
- **What I need to understand:** Users can identify which API key they connected without exposing the plaintext secret in API responses or browser state.
- **Likely follow-ups:**
  - Is the plaintext key ever sent from the server back to the browser?
  - What security risk exists if full keys were stored in React state?
- **Diagram required:** No
- **Source references:** src/lib/providers/crypto.ts

### Q78: Explain the key verification workflow in `src/server/routes/keys.ts`.
- **Question:** Explain the key verification workflow in `src/server/routes/keys.ts`.
- **Context:** When a user submits an API key, the server makes a lightweight live API call to the provider before saving.
- **What I need to understand:** Prevents saving dead, expired, or mistyped keys, immediately updating `ApiKey.status` to `VALID` or `INVALID`.
- **Likely follow-ups:**
  - What lightweight probe request is sent to OpenAI vs Gemini vs Anthropic?
  - What happens if the provider's validation endpoint is temporarily unreachable?
- **Diagram required:** Yes (Sequence)
- **Source references:** src/server/routes/keys.ts, src/lib/providers/validation-helper.ts

### Q79: How does `resolveProjectKeys` enforce access control during indexing and QA?
- **Question:** How does `resolveProjectKeys` enforce access control during indexing and QA?
- **Context:** `src/lib/providers/guard.ts` checks user BYOK keys, project overrides, and environment fallbacks.
- **What I need to understand:** Ensures requests fail fast with actionable `ProviderAccessError` before triggering expensive operations.
- **Likely follow-ups:**
  - What error code is returned when a user has no key configured for the requested model?
  - How does the UI guide the user to the settings page upon seeing this error?
- **Diagram required:** No
- **Source references:** src/lib/providers/guard.ts

### Q80: How are GitHub personal access tokens encrypted on the `Project` model?
- **Question:** How are GitHub personal access tokens encrypted on the `Project` model?
- **Context:** `Project.encryptedGithubToken` and `Project.githubTokenIv` use the same AES-256-GCM vault.
- **What I need to understand:** Protects private repository access tokens at rest. Even with direct read access to PostgreSQL, an attacker cannot read GitHub tokens without the server's master key.
- **Likely follow-ups:**
  - Who has permission to update the GitHub token on a project?
  - What happens to the encrypted token when a project is deleted?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/lib/github.ts

### Q81: What are the default fallback encryption keys in development vs production?
- **Question:** What are the default fallback encryption keys in development vs production?
- **Context:** In development, falls back to a hardcoded 64-character hex string; in production, throws `ENCRYPTION_KEY must be set in production`.
- **What I need to understand:** Prevents developer friction during local onboarding while strictly enforcing security in production deployments.
- **Likely follow-ups:**
  - Why is hardcoding fallback keys dangerous if accidentally run in staging or production?
  - How is `NODE_ENV` verified during server boot?
- **Diagram required:** No
- **Source references:** src/lib/providers/crypto.ts

### Q82: How does RepoSense prevent Cross-Site Scripting (XSS) when rendering user code and markdown?
- **Question:** How does RepoSense prevent Cross-Site Scripting (XSS) when rendering user code and markdown?
- **Context:** ReactMarkdown sanitizes HTML by default; code blocks use PrismJS syntax tokens instead of `dangerouslySetInnerHTML`.
- **What I need to understand:** Malicious markdown containing `<script>` tags or javascript URLs cannot execute in the user's browser context.
- **Likely follow-ups:**
  - How does the Mermaid diagram component prevent DOM-based XSS when injecting SVGs?
  - What is `securityLevel: 'loose'` in Mermaid config and how is it secured?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx, src/components/wiki/mermaid.tsx

### Q83: How does CORS configuration protect Hono API routes in `src/server/app.ts`?
- **Question:** How does CORS configuration protect Hono API routes in `src/server/app.ts`?
- **Context:** CORS middleware validates origin against `NEXT_PUBLIC_APP_URL` and allows localhost only in non-production.
- **What I need to understand:** Blocks malicious third-party websites from making cross-origin authenticated fetch requests to RepoSense API endpoints using the user's cookies.
- **Likely follow-ups:**
  - What HTTP methods and headers are permitted in CORS preflight?
  - Why must `credentials: true` be explicitly enabled?
- **Diagram required:** No
- **Source references:** src/server/app.ts

### Q84: Explain the database user access control model in `UserToProject`.
- **Question:** Explain the database user access control model in `UserToProject`.
- **Context:** `UserToProject` join table creates a many-to-many relationship between `User` and `Project`.
- **What I need to understand:** Enforces team access control: only users linked to a project can trigger indexing, view private wikis, or read project settings.
- **Likely follow-ups:**
  - What happens when a non-member tries to access `/api/projects/:id`?
  - How is project ownership vs collaboration distinguished?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, src/server/routes/projects.ts

### Category A8: Scale, Reliability, Concurrency & Performance (Q85 - Q96)
### Q85: Explain the working capacity math for 5,000 monthly indexed repositories.
- **Question:** Explain the working capacity math for 5,000 monthly indexed repositories.
- **Context:** 5,000 repos * 650 files * 8 chunks = 26M chunks. Raw storage ~3.6 MB text + 32 MB vectors = ~35.6 MB per repo. 178 GB/month database growth.
- **What I need to understand:** Demonstrates capacity planning rigor: understanding storage footprint, vector dimensions, and database scaling boundaries.
- **Likely follow-ups:**
  - How does vector storage scale if dimension size doubles (e.g. from 1536 to 3072)?
  - What PostgreSQL vacuuming strategy is required for high-write churn on vector tables?
- **Diagram required:** No
- **Source references:** system-design.md

### Q86: How does Neon Serverless PostgreSQL handle database connections under high concurrency?
- **Question:** How does Neon Serverless PostgreSQL handle database connections under high concurrency?
- **Context:** Neon provides connection pooling via PgBouncer using the `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled migrations).
- **What I need to understand:** Serverless functions open hundreds of ephemeral connections. PgBouncer transaction pooling multiplexes these connections into a small pool of database backends.
- **Likely follow-ups:**
  - Why must Prisma migrations use `DIRECT_URL` instead of the pooled connection string?
  - What happens to prepared statements when using PgBouncer in transaction pooling mode?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma, system-design.md

### Q87: How does RepoSense detect and recover from stalled or timed-out indexing jobs?
- **Question:** How does RepoSense detect and recover from stalled or timed-out indexing jobs?
- **Context:** Worker timeout detection marks jobs stuck in `RUNNING` for over 15 minutes as `FAILED` with `WORKER_TIMEOUT`.
- **What I need to understand:** Serverless execution limits (e.g. Vercel 60s/300s limit) can terminate workers abruptly. Stalled job detection prevents the UI from spinning indefinitely.
- **Likely follow-ups:**
  - How can a background indexing job run longer than serverless function timeouts?
  - What worker architecture (e.g. Inngest, BullMQ, Cloudflare Queues) would solve this permanently?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/indexing-workflow.ts

### Q88: How are cascading foreign key deletions handled when a project is deleted?
- **Question:** How are cascading foreign key deletions handled when a project is deleted?
- **Context:** Prisma schema specifies `onDelete: Cascade` on `WikiPage`, `SourceCodeEmbedding`, `QaThread`, and `IndexingJob`.
- **What I need to understand:** A single project deletion automatically purges thousands of vector rows, wiki pages, and chat sessions in one atomic transaction.
- **Likely follow-ups:**
  - What is the performance impact of deleting 50,000 vector rows in a single cascading delete?
  - How can large project deletions be offloaded to asynchronous background tasks?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma

### Q89: Explain the performance characteristics of `searchCodeChunks` with HNSW vs IVFFlat indexes.
- **Question:** Explain the performance characteristics of `searchCodeChunks` with HNSW vs IVFFlat indexes.
- **Context:** HNSW provides logarithmic graph traversal ($O(\log N)$) with zero warm-up training required, unlike IVFFlat which requires list clustering.
- **What I need to understand:** HNSW delivers sub-25ms search latencies across 50,000 chunks while maintaining > 95% recall.
- **Likely follow-ups:**
  - What is the query latency difference between cached index in RAM vs cold disk read in pgvector?
  - How does `ef_search` tune query-time speed vs recall?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/embeddings.ts

### Q90: How does the system handle GitHub API primary and secondary rate limits?
- **Question:** How does the system handle GitHub API primary and secondary rate limits?
- **Context:** Exponential backoff with jitter on HTTP 429 and 403, and prompts user to supply a personal access token.
- **What I need to understand:** Preserves ingestion stability and avoids IP-level bans from GitHub's abuse detection mechanisms.
- **Likely follow-ups:**
  - What is the difference between GitHub primary rate limit (hourly quota) and secondary rate limit (burst concurrency)?
  - How does `createFetchBatches` prevent triggering secondary rate limits?
- **Diagram required:** No
- **Source references:** src/lib/github.ts, src/lib/indexing-workflow.ts

### Q91: How does RepoSense prevent memory leaks during large file tree processing in Node.js?
- **Question:** How does RepoSense prevent memory leaks during large file tree processing in Node.js?
- **Context:** Streams and batches file loading; discards raw file content after chunking and skeleton extraction.
- **What I need to understand:** Worker garbage collection reclaims file strings before large embedding and wiki generation stages begin.
- **Likely follow-ups:**
  - What is the maximum V8 heap size in Node.js serverless functions?
  - How would you debug a heap out-of-memory error in the indexing worker?
- **Diagram required:** No
- **Source references:** src/lib/indexing-workflow.ts

### Q92: What is the cost of running RepoSense in production for 10,000 active developers?
- **Question:** What is the cost of running RepoSense in production for 10,000 active developers?
- **Context:** Neon database: ~$50 - $100/mo (compute + storage). Vercel hosting: ~$40/mo. LLM inference: passed through via user BYOK keys ($0 host cost).
- **What I need to understand:** The BYOK architecture makes RepoSense virtually immune to cloud model bankruptcy, shifting inference variable costs to users.
- **Likely follow-ups:**
  - What hosting costs would RepoSense incur if it provided a hosted model tier without BYOK?
  - How does credit-based pricing (`src/lib/pricing.ts`) monetize non-BYOK users?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/pricing.ts

### Q93: How does `useSmoothStream` prevent UI lag and browser thread locking during LLM streaming?
- **Question:** How does `useSmoothStream` prevent UI lag and browser thread locking during LLM streaming?
- **Context:** Uses `requestAnimationFrame` to batch token updates to the display refresh rate (60Hz / 16.6ms).
- **What I need to understand:** LLM SSE streams can emit 50-100 micro-tokens per second. Re-rendering React component trees on every token causes layout thrashing and dropped frames.
- **Likely follow-ups:**
  - What is the difference between `requestAnimationFrame` and `setTimeout(fn, 16)` for UI updates?
  - How does `pending.current` ref buffer tokens between animation frames?
- **Diagram required:** Yes (Flowchart)
- **Source references:** src/hooks/use-smooth-stream.ts

### Q94: How is database connection pooling configured in `src/server/db.ts`?
- **Question:** How is database connection pooling configured in `src/server/db.ts`?
- **Context:** Instantiates `@prisma/client` with global singleton caching in development (`globalForPrisma.prisma`).
- **What I need to understand:** Prevents Next.js hot-reloading from creating a new PrismaClient and exhausting database connections on every file save.
- **Likely follow-ups:**
  - What error occurs if the PrismaClient singleton pattern is omitted in Next.js?
  - How does the Neon serverless adapter (`@prisma/adapter-neon`) work over WebSockets?
- **Diagram required:** No
- **Source references:** src/server/db.ts

### Q95: What happens when two users trigger indexing on the same repository branch simultaneously?
- **Question:** What happens when two users trigger indexing on the same repository branch simultaneously?
- **Context:** Second request checks `IndexingJob.status = RUNNING` on `projectId` and returns existing job status or rejects with HTTP 409.
- **What I need to understand:** Prevents race conditions where two workers concurrently insert duplicate chunks or overwrite wiki pages.
- **Likely follow-ups:**
  - How can database-level row locking (`SELECT FOR UPDATE`) prevent indexing race conditions?
  - How is job cancellation handled if the user clicks Stop?
- **Diagram required:** No
- **Source references:** src/server/routes/indexing.ts, src/lib/indexing-workflow.ts

### Q96: Explain how RepoSense handles database migrations when deploying new versions.
- **Question:** Explain how RepoSense handles database migrations when deploying new versions.
- **Context:** `prisma db push` in development / CI, or `prisma migrate deploy` for versioned SQL migrations.
- **What I need to understand:** Maintains schema parity between local environments and Neon PostgreSQL without dropping vector tables.
- **Likely follow-ups:**
  - Why can automated migrations fail when adding a vector column to a large table?
  - How should new enum values (e.g. adding a new LLM provider) be migrated safely in PostgreSQL?
- **Diagram required:** No
- **Source references:** prisma/schema.prisma

### Category A9: Endpoints, Routing & Legacy Systems (Q97 - Q108)
### Q97: Explain the routing structure in `src/server/routes/projects.ts`.
- **Question:** Explain the routing structure in `src/server/routes/projects.ts`.
- **Context:** Handles project creation, file fetching, wiki retrieval, QA asking, and branch listing.
- **What I need to understand:** Consolidates project domain operations under a unified Hono sub-router mounted at `/api/projects`.
- **Likely follow-ups:**
  - How are route parameters (e.g. `:id`) validated using Zod schemas?
  - What error status is returned if a project ID does not exist?
- **Diagram required:** No
- **Source references:** src/server/routes/projects.ts

### Q98: How does `GET /api/projects/:id/file` retrieve source files for the CodeViewer?
- **Question:** How does `GET /api/projects/:id/file` retrieve source files for the CodeViewer?
- **Context:** Queries `SourceCodeEmbedding.fullFileContent` or fetches raw content from GitHub using project token.
- **What I need to understand:** Serves the exact file content required by the frontend code panel when a user clicks an inline citation pill.
- **Likely follow-ups:**
  - Why serve files through our backend instead of having the browser fetch directly from raw.githubusercontent.com?
  - How does the backend prevent path traversal attacks (`../../etc/passwd`)?
- **Diagram required:** No
- **Source references:** src/server/routes/projects.ts, src/components/wiki/code-viewer.tsx

### Q99: What is the meeting audio integration in `src/app/api/process-meeting/route.ts` and `src/lib/assembly.ts`?
- **Question:** What is the meeting audio integration in `src/app/api/process-meeting/route.ts` and `src/lib/assembly.ts`?
- **Context:** Legacy feature allowing users to upload meeting recordings for transcription via Assembly.AI and Cloudinary.
- **What I need to understand:** Generates issue summaries and timestamps linked to code tasks, demonstrating multi-modal knowledge ingestion.
- **Likely follow-ups:**
  - How is meeting transcription processed asynchronously?
  - How does the `Issue` model relate to `Meeting` and `Project`?
- **Diagram required:** No
- **Source references:** src/app/api/process-meeting/route.ts, src/lib/assembly.ts, prisma/schema.prisma

### Q100: How does the token estimation endpoint in `src/server/routes/estimate.ts` calculate repository indexing cost?
- **Question:** How does the token estimation endpoint in `src/server/routes/estimate.ts` calculate repository indexing cost?
- **Context:** Analyzes Git tree metadata to compute total file count, estimated chunks, and expected LLM token usage.
- **What I need to understand:** Informs the developer of expected time and cost before they commit to indexing a repository.
- **Likely follow-ups:**
  - What heuristics estimate token count from file byte size?
  - How does the estimate differentiate between code files and markdown documentation?
- **Diagram required:** No
- **Source references:** src/server/routes/estimate.ts, src/lib/estimate.ts

### Q101: How does the pull request route in `src/server/routes/pulls.ts` interact with GitHub?
- **Question:** How does the pull request route in `src/server/routes/pulls.ts` interact with GitHub?
- **Context:** Lists open pull requests for a repository and resolves PR head commit SHAs.
- **What I need to understand:** Enables developers to index and review feature branches or pull requests before merging into `main`.
- **Likely follow-ups:**
  - How does PR indexing differ from default branch indexing?
  - Can RepoSense post wiki summaries back as a GitHub PR comment?
- **Diagram required:** No
- **Source references:** src/server/routes/pulls.ts, src/lib/github.ts

### Q102: Explain how `src/server/routes/me.ts` manages user profile state and preferences.
- **Question:** Explain how `src/server/routes/me.ts` manages user profile state and preferences.
- **Context:** Handles user default model preferences, default embedding provider, and credit balances.
- **What I need to understand:** Persists developer preferences across sessions so they don't have to re-select their preferred LLM on every query.
- **Likely follow-ups:**
  - Where are user preferences stored in the `User` table?
  - How is user profile data synchronized with Clerk webhooks?
- **Diagram required:** No
- **Source references:** src/server/routes/me.ts, prisma/schema.prisma

### Q103: What is the purpose of `src/server/worker.ts`?
- **Question:** What is the purpose of `src/server/worker.ts`?
- **Context:** Standalone worker entry point for executing indexing workflows outside of HTTP request lifecycles.
- **What I need to understand:** Decouples long-running ingestion jobs from the web server, allowing horizontal worker scaling.
- **Likely follow-ups:**
  - How does the worker communicate job state back to the web application?
  - How are worker tasks scheduled or triggered?
- **Diagram required:** No
- **Source references:** src/server/worker.ts

### Q104: How does `src/lib/api-client.ts` wrap client-side fetch calls with error handling?
- **Question:** How does `src/lib/api-client.ts` wrap client-side fetch calls with error handling?
- **Context:** Typed HTTP client with automatic JSON parsing, error code unwrapping, and toast notification triggers.
- **What I need to understand:** Provides clean, DRY API consumption across React client components.
- **Likely follow-ups:**
  - How does `api-client.ts` handle HTTP 401 Unauthorized errors?
  - Does it automatically retry failed idempotent requests?
- **Diagram required:** No
- **Source references:** src/lib/api-client.ts

### Q105: Why is tRPC still used for `project.getAll` and `project.getOne` in `src/server/api/routers/project.ts`?
- **Question:** Why is tRPC still used for `project.getAll` and `project.getOne` in `src/server/api/routers/project.ts`?
- **Context:** Existing dashboard and sidebar components consume tRPC React Query hooks (`api.project.getAll.useQuery`).
- **What I need to understand:** Avoids breaking working UI code during progressive backend modernization to Hono.
- **Likely follow-ups:**
  - What are the trade-offs of having two client-side data fetching paradigms in the same codebase?
  - How would you systematically migrate remaining tRPC hooks to TanStack Query + Hono RPC?
- **Diagram required:** No
- **Source references:** src/server/api/routers/project.ts, src/trpc/react.tsx

### Q106: How does `src/trpc/query-client.ts` configure React Query defaults?
- **Question:** How does `src/trpc/query-client.ts` configure React Query defaults?
- **Context:** Configures query stale times, refetch on window focus, and query caching policies.
- **What I need to understand:** Prevents excessive network refetches when navigating between dashboard tabs.
- **Likely follow-ups:**
  - What is the default `staleTime` configured in the query client?
  - How are query caches invalidated when a new project is created?
- **Diagram required:** No
- **Source references:** src/trpc/query-client.ts

### Q107: What is the Stripe payment integration in `src/lib/pricing.ts` and legacy routes?
- **Question:** What is the Stripe payment integration in `src/lib/pricing.ts` and legacy routes?
- **Context:** Stripe checkout integration for purchasing indexing credits on the hosted platform.
- **What I need to understand:** Demonstrates SaaS monetization architecture for non-BYOK users.
- **Likely follow-ups:**
  - How are Stripe webhooks verified to prevent payment spoofing?
  - How are purchased credits credited to the user's account in PostgreSQL?
- **Diagram required:** No
- **Source references:** src/lib/pricing.ts, prisma/schema.prisma

### Q108: How does `src/app/explore/page.tsx` query public repositories?
- **Question:** How does `src/app/explore/page.tsx` query public repositories?
- **Context:** Fetches repositories where `isPublicWiki: true` with pre-indexed DeepWikis.
- **What I need to understand:** Serves as an open source showcase where users can explore popular repositories (like React or Next.js) without authenticating.
- **Likely follow-ups:**
  - Is the explore page statically generated (SSG), dynamically rendered (SSR), or client-rendered?
  - How are explore page queries cached for performance?
- **Diagram required:** No
- **Source references:** src/app/explore/page.tsx, src/server/routes/public.ts

### Category A10: Production Readiness, Trade-offs & Architecture Evolution (Q109 - Q120)
### Q109: If you had to scale RepoSense to 100,000 repositories, what would be the first architectural bottleneck?
- **Question:** If you had to scale RepoSense to 100,000 repositories, what would be the first architectural bottleneck?
- **Context:** The monolithic database: storing millions of vectors and handling indexing writes in the same PostgreSQL instance as read traffic.
- **What I need to understand:** Requires splitting vector storage into dedicated pgvector read-replicas or sharding by `projectId`, and moving indexing to durable worker queues.
- **Likely follow-ups:**
  - How would read-write splitting be configured in Prisma?
  - At what chunk count does pgvector HNSW memory usage exceed affordable serverless limits?
- **Diagram required:** Yes (Architecture)
- **Source references:** system-design.md

### Q110: Why not use Tree-sitter for AST parsing if it provides higher grammatical accuracy than regex?
- **Question:** Why not use Tree-sitter for AST parsing if it provides higher grammatical accuracy than regex?
- **Context:** Tree-sitter requires compiling C/WASM binaries for every language and consumes significantly more memory and cold-start time.
- **What I need to understand:** Trade-off: Regex extraction runs in sub-milliseconds across all environments with zero native dependencies, trading 5% edge-case precision for 10x operational simplicity.
- **Likely follow-ups:**
  - In what scenarios does regex chunking fail to detect a function boundary?
  - How could Tree-sitter be introduced selectively without penalizing serverless functions?
- **Diagram required:** No
- **Source references:** system-design.md, src/lib/chunker.ts

### Q111: What are the trade-offs of storing embeddings as dual columns versus a normalized `Embedding` table?
- **Question:** What are the trade-offs of storing embeddings as dual columns versus a normalized `Embedding` table?
- **Context:** Dual columns (`embeddingOpenAI`, `embeddingGemini`) on `SourceCodeEmbedding` vs a separate table with `provider` and `vector`.
- **What I need to understand:** Dual columns eliminate a join on every search query and simplify foreign keys, but require schema alterations to add new embedding providers.
- **Likely follow-ups:**
  - How would a migration to support a third provider (e.g. Cohere or Voyage) be executed?
  - Why did the team prioritize query speed over schema flexibility?
- **Diagram required:** No
- **Source references:** system-design.md, prisma/schema.prisma

### Q112: Explain the trade-offs of serverless background processing versus dedicated queue workers (e.g. BullMQ / Inngest).
- **Question:** Explain the trade-offs of serverless background processing versus dedicated queue workers (e.g. BullMQ / Inngest).
- **Context:** RepoSense currently executes indexing steps inline or via lightweight step runners.
- **What I need to understand:** Inline is simple to deploy on Vercel/Node without Redis infrastructure, but risks function timeouts on large repositories.
- **Likely follow-ups:**
  - How would you introduce Inngest or Temporal to make the 5-step indexing pipeline fully durable?
  - How would step retries and checkpoints be stored?
- **Diagram required:** Yes (Sequence)
- **Source references:** system-design.md, src/lib/indexing-workflow.ts

### Q113: How would you implement incremental commit indexing to avoid re-indexing unchanged files?
- **Question:** How would you implement incremental commit indexing to avoid re-indexing unchanged files?
- **Context:** Compare previous indexed commit SHA with current HEAD via GitHub Compare API (`/repos/{owner}/{repo}/compare/{base}...{head}`).
- **What I need to understand:** Delete vector rows only for modified/removed files; chunk and embed only added/modified files. Reduces indexing time by 90% for subsequent commits.
- **Likely follow-ups:**
  - How would `WikiPage` documentation be updated when only 2 source files change?
  - How do you detect if architectural changes invalidate the global overview wiki page?
- **Diagram required:** No
- **Source references:** system-design.md

### Q114: What testing strategy exists for the indexing and QA pipelines?
- **Question:** What testing strategy exists for the indexing and QA pipelines?
- **Context:** Unit tests for chunker regex, integration tests for API endpoints, and mock LLM providers for deterministic prompt testing.
- **What I need to understand:** Prevents regressions in line number calculations, citation parsing, and encryption round-trips.
- **Likely follow-ups:**
  - How do you test vector similarity search without making real OpenAI API calls?
  - How do you verify that citation line numbers match actual source code lines in CI?
- **Diagram required:** No
- **Source references:** src/lib/chunker.ts, src/lib/providers/crypto.ts

### Q115: How are API secrets and environment variables managed across development, preview, and production?
- **Question:** How are API secrets and environment variables managed across development, preview, and production?
- **Context:** `.env.example` documents all required secrets; production uses Vercel environment variable vaults with separate preview environments.
- **What I need to understand:** Ensures development databases are isolated from production Neon instances.
- **Likely follow-ups:**
  - Why is `DIRECT_URL` required in addition to `DATABASE_URL`?
  - What happens if a developer forgets to set `ENCRYPTION_KEY` locally?
- **Diagram required:** No
- **Source references:** .env.example, src/lib/providers/crypto.ts

### Q116: How would you prevent vector search degradation when a single repository has 50 branches indexed?
- **Question:** How would you prevent vector search degradation when a single repository has 50 branches indexed?
- **Context:** Partition tables by `projectId` or enforce branch retention limits (e.g. automatically purge non-main branches older than 30 days).
- **What I need to understand:** Keeps table sizes manageable and prevents index fragmentation from dead pull request branches.
- **Likely follow-ups:**
  - What cron job or background schedule would prune stale branch vectors?
  - How would users configure branch retention policies?
- **Diagram required:** No
- **Source references:** system-design.md, prisma/schema.prisma

### Q117: What observability and telemetry tools would you introduce in production?
- **Question:** What observability and telemetry tools would you introduce in production?
- **Context:** OpenTelemetry tracing with Langfuse or Helicone for LLM cost/latency tracking, and Axiom or Datadog for Hono HTTP logs.
- **What I need to understand:** Provides visibility into token usage, provider error rates, vector search durations, and user query satisfaction.
- **Likely follow-ups:**
  - How would you trace a user's question from Next.js UI -> Hono API -> pgvector -> OpenAI -> UI stream?
  - What metrics indicate that an embedding model is returning degraded search results?
- **Diagram required:** No
- **Source references:** system-design.md

### Q118: How does RepoSense adhere to GitHub's API terms of service regarding code storage?
- **Question:** How does RepoSense adhere to GitHub's API terms of service regarding code storage?
- **Context:** RepoSense stores code chunks only for vector retrieval and developer inspection, honoring repository privacy and access tokens.
- **What I need to understand:** Does not redistribute code or expose private repository content publicly.
- **Likely follow-ups:**
  - What happens if a user revokes their GitHub token?
  - How does RepoSense ensure deleted private repositories are promptly removed from the database?
- **Diagram required:** No
- **Source references:** src/lib/github.ts

### Q119: What architectural changes are needed to support self-hosted, air-gapped enterprise deployments?
- **Question:** What architectural changes are needed to support self-hosted, air-gapped enterprise deployments?
- **Context:** Replace cloud LLM APIs with local Ollama or vLLM endpoints, use local ONNX embeddings, and replace Clerk with self-hosted NextAuth / Keycloak.
- **What I need to understand:** Enables financial and defense enterprises with strict data sovereignty mandates to run RepoSense behind firewalls without outbound internet access.
- **Likely follow-ups:**
  - What local embedding model matches OpenAI text-embedding-3-small quality?
  - How would the BYOK vault operate in an enterprise single-tenant environment?
- **Diagram required:** Yes (Architecture)
- **Source references:** system-design.md

### Q120: If you could rebuild RepoSense from scratch today, what would you do differently?
- **Question:** If you could rebuild RepoSense from scratch today, what would you do differently?
- **Context:** 1) Adopt Drizzle ORM for native pgvector support and faster cold starts. 2) Use durable workflow orchestrators (Inngest) from day one. 3) Standardize 100% on Hono rather than running both tRPC and Hono.
- **What I need to understand:** Demonstrates architectural maturity: recognizing technical debt, acknowledging evolutionary constraints, and having a clear engineering vision for version 4.
- **Likely follow-ups:**
  - Why did the project end up with both tRPC and Hono in the first place?
  - How would you plan the refactoring without halting new feature development?
- **Diagram required:** No
- **Source references:** system-design.md

---

## 4. Bank B: Frontend-Specific Deep Dive (80 Questions)

### Category B1: Component Architecture, Layout & Organization (Q121 - Q130)
### Q121: Explain the page layout hierarchy for the wiki reader view in `src/app/wiki/[projectId]/page.tsx`.
- **Question:** Explain the page layout hierarchy for the wiki reader view in `src/app/wiki/[projectId]/page.tsx`.
- **Context:** Next.js App Router dynamic route rendering `WikiReader` with sidebar navigation, breadcrumbs, content pane, and code inspector.
- **What I need to understand:** Separates repository metadata loading from interactive client components, providing instant skeleton loading while wiki pages fetch.
- **Likely follow-ups:**
  - Is `src/app/wiki/[projectId]/page.tsx` a Server Component or Client Component?
  - How are `projectId` and query params (`branch`, `page`) passed to the reader?
- **Diagram required:** Yes (Component)
- **Source references:** src/app/wiki/[projectId]/page.tsx, src/components/wiki/wiki-reader.tsx

### Q122: How is the application sidebar structured in `src/app/app-sidebar.tsx`?
- **Question:** How is the application sidebar structured in `src/app/app-sidebar.tsx`?
- **Context:** Uses `@/components/ui/sidebar` with project switcher, navigation links (Dashboard, QA, Meetings, Settings), and user profile footer.
- **What I need to understand:** Provides a unified, responsive sidebar across all protected routes with collapsible state persisted across page reloads.
- **Likely follow-ups:**
  - How does the project switcher switch between active projects?
  - How does the sidebar collapse on mobile devices vs desktop?
- **Diagram required:** No
- **Source references:** src/app/app-sidebar.tsx

### Q123: How does `WikiReader` coordinate the split-pane layout between wiki content and the code viewer?
- **Question:** How does `WikiReader` coordinate the split-pane layout between wiki content and the code viewer?
- **Context:** Conditional full-width stacked panels or side-by-side view when `activeFile` is set.
- **What I need to understand:** Allows developers to read documentation while simultaneously inspecting source code without navigating away or opening new browser tabs.
- **Likely follow-ups:**
  - What happens on mobile viewports when an inline citation is clicked?
  - How does the layout prevent horizontal scrolling on small screens?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-reader.tsx, src/components/wiki/code-viewer.tsx

### Q124: Why are UI primitives organized in `src/components/ui/` using Radix UI and Tailwind CSS (shadcn/ui style)?
- **Question:** Why are UI primitives organized in `src/components/ui/` using Radix UI and Tailwind CSS (shadcn/ui style)?
- **Context:** Headless accessible Radix UI primitives styled with Tailwind utility classes.
- **What I need to understand:** Guarantees WAI-ARIA compliance (keyboard navigation, focus management, screen readers) while allowing complete styling customization without runtime CSS-in-JS overhead.
- **Likely follow-ups:**
  - Why choose headless primitives over component libraries like Material UI or Ant Design?
  - How does `cn()` in `src/lib/utils.ts` resolve conflicting Tailwind classes?
- **Diagram required:** No
- **Source references:** src/components/ui/button.tsx, src/lib/utils.ts

### Q125: Explain the composition of `WikiQaView` in `src/components/wiki/wiki-qa-view.tsx`.
- **Question:** Explain the composition of `WikiQaView` in `src/components/wiki/wiki-qa-view.tsx`.
- **Context:** Renders question banner, model badge, streaming answer, cited file tags, and full-width `CodeViewer` panels.
- **What I need to understand:** Deconstructs a complex AI interaction into modular sub-components (Composer, Answer, Citations, Source Inspector) with clean prop boundaries.
- **Likely follow-ups:**
  - Why is `WikiComposer` embedded both in the sidebar and directly on the QA page?
  - How are props drilled or avoided between `WikiReader` and `WikiQaView`?
- **Diagram required:** Yes (Component)
- **Source references:** src/components/wiki/wiki-qa-view.tsx

### Q126: How does `src/app/(protected)/layout.tsx` enforce authentication before rendering protected pages?
- **Question:** How does `src/app/(protected)/layout.tsx` enforce authentication before rendering protected pages?
- **Context:** Wraps children with Clerk auth check and layout sidebar wrapper.
- **What I need to understand:** Unauthenticated users are redirected to `/sign-in` before child components mount, preventing flash of protected content.
- **Likely follow-ups:**
  - How does the layout handle loading states while Clerk verifies user session?
  - Where is user project membership verified in the layout hierarchy?
- **Diagram required:** No
- **Source references:** src/app/(protected)/layout.tsx

### Q127: How is the question list on `src/app/(protected)/qa/page.tsx` optimized for space?
- **Question:** How is the question list on `src/app/(protected)/qa/page.tsx` optimized for space?
- **Context:** Clean list layout with search bar, model badges, and direct routing to saved question instances without cards.
- **What I need to understand:** Maximizes data density and removes wasted column padding for an efficient developer experience.
- **Likely follow-ups:**
  - How does clicking a saved question route to the question instance without re-generating?
  - How are pinned and bookmarked questions sorted at the top of the list?
- **Diagram required:** No
- **Source references:** src/app/(protected)/qa/page.tsx

### Q128: Explain the component structure of `src/app/(protected)/settings/page.tsx` for the BYOK vault.
- **Question:** Explain the component structure of `src/app/(protected)/settings/page.tsx` for the BYOK vault.
- **Context:** Grid of provider cards (OpenAI, Gemini, Anthropic, Groq, DeepSeek, Meta, xAI) with key inputs, status badges, and delete actions.
- **What I need to understand:** Provides intuitive credential management with clear visual feedback on key validity (`VALID`, `INVALID`, `QUOTA_EXHAUSTED`).
- **Likely follow-ups:**
  - How does the form toggle between password masked input and visible text?
  - How does the card display the redacted `keyLast4`?
- **Diagram required:** No
- **Source references:** src/app/(protected)/settings/page.tsx

### Q129: How does the repository onboarding view in `src/app/(protected)/create/page.tsx` guide developers?
- **Question:** How does the repository onboarding view in `src/app/(protected)/create/page.tsx` guide developers?
- **Context:** Step-by-step form: GitHub URL input -> Branch detection -> Private token toggle -> Token estimate -> Start indexing.
- **What I need to understand:** Validates GitHub URLs in real time and checks repository access before launching long-running indexing tasks.
- **Likely follow-ups:**
  - How does the branch dropdown populate automatically upon pasting a GitHub URL?
  - What validation feedback displays if a user pastes an invalid or inaccessible URL?
- **Diagram required:** No
- **Source references:** src/app/(protected)/create/page.tsx

### Q130: How does `src/components/indexing-loader.tsx` render indexing progress animations?
- **Question:** How does `src/components/indexing-loader.tsx` render indexing progress animations?
- **Context:** Multi-step progress indicator showing completed steps, active spinner, progress percentage, and estimated time remaining.
- **What I need to understand:** Keeps the developer informed during the 30-120 second indexing window, reducing bounce rates and page reloads.
- **Likely follow-ups:**
  - Why add a minimum delay between step transitions?
  - How does uniform step pacing improve user perception of speed?
- **Diagram required:** No
- **Source references:** src/components/indexing-loader.tsx

### Category B2: State Management, Custom Hooks & React 19 Patterns (Q131 - Q140)
### Q131: Explain how `useProject` in `src/hooks/use-project.ts` manages active project and branch state.
- **Question:** Explain how `useProject` in `src/hooks/use-project.ts` manages active project and branch state.
- **Context:** Manages selected `projectId` and `activeBranch`, syncing with `localStorage` and URL parameters.
- **What I need to understand:** Allows users to refresh or share URLs while retaining their active project and branch context.
- **Likely follow-ups:**
  - What happens if the `projectId` stored in `localStorage` no longer exists?
  - How does `useProject` trigger global re-renders when a user switches projects?
- **Diagram required:** No
- **Source references:** src/hooks/use-project.ts

### Q132: Why does `WikiReader` own the `activeFile` state instead of delegating to child components?
- **Question:** Why does `WikiReader` own the `activeFile` state instead of delegating to child components?
- **Context:** `activeFile` is lifted to `WikiReader` so both the wiki markdown viewer and the QA view can open and close the code inspector.
- **What I need to understand:** Single source of truth: clicking an inline citation in either the wiki or chat panel routes through the same `onCitation` handler.
- **Likely follow-ups:**
  - What is the TypeScript interface for `ActiveFile`?
  - What would break if `WikiMarkdown` managed `activeFile` in its own internal state?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-reader.tsx, src/components/wiki/code-viewer.tsx

### Q133: How does `useRefetch` in `src/hooks/use-refetch.ts` force query refreshes across components?
- **Question:** How does `useRefetch` in `src/hooks/use-refetch.ts` force query refreshes across components?
- **Context:** Provides an imperative trigger that invalidates active tRPC or TanStack Query cache keys.
- **What I need to understand:** Enables actions in one component (e.g. creating a project or deleting a key) to instantly refresh sibling data without full page reloads.
- **Likely follow-ups:**
  - How does `useRefetch` differ from standard `queryClient.invalidateQueries`?
  - How is it used during repository re-indexing?
- **Diagram required:** No
- **Source references:** src/hooks/use-refetch.ts

### Q134: Explain the implementation of `useMobile` in `src/hooks/use-mobile.ts`.
- **Question:** Explain the implementation of `useMobile` in `src/hooks/use-mobile.ts`.
- **Context:** Listens to `window.matchMedia('(max-width: 768px)')` with an event listener cleanup.
- **What I need to understand:** Enables components to conditionally render desktop sidebars vs mobile sheets with zero SSR hydration mismatch.
- **Likely follow-ups:**
  - How does `useMobile` prevent hydration mismatch errors between server render and client hydration?
  - Why is `useEffect` necessary when reading `window.innerWidth`?
- **Diagram required:** No
- **Source references:** src/hooks/use-mobile.ts

### Q135: How does `useThreadFolders` in `src/hooks/use-thread-folders.ts` organize chat sessions?
- **Question:** How does `useThreadFolders` in `src/hooks/use-thread-folders.ts` organize chat sessions?
- **Context:** Groups QA threads by project, branch, or date categories.
- **What I need to understand:** Helps developers navigate deep conversation histories when investigating multiple codebase topics.
- **Likely follow-ups:**
  - How are folder expansion states persisted across page reloads?
  - What state management approach is used for folder renames?
- **Diagram required:** No
- **Source references:** src/hooks/use-thread-folders.ts

### Q136: Why does `WikiQaView` memoize `citedFiles` with `React.useMemo`?
- **Question:** Why does `WikiQaView` memoize `citedFiles` with `React.useMemo`?
- **Context:** `const citedFiles = React.useMemo(() => ..., [answer, scanning])`.
- **What I need to understand:** Extracting file citations requires regex matching across the complete markdown answer string. Memoization prevents expensive regex execution on unrelated re-renders.
- **Likely follow-ups:**
  - What triggers `citedFiles` recalculation during streaming?
  - What is the computational complexity of parsing citations in a 2,000-word answer?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx

### Q137: How does `WikiQaView` manage optimistic save state when saving questions?
- **Question:** How does `WikiQaView` manage optimistic save state when saving questions?
- **Context:** `const [saved, setSaved] = React.useState(false); const [isSaving, setIsSaving] = React.useState(false)`.
- **What I need to understand:** Updates the bookmark icon to a checked state immediately upon click, rolling back and displaying a toast if the backend mutation fails.
- **Likely follow-ups:**
  - Why is optimistic UI critical for actions like pinning or saving questions?
  - How does `sonner` display error toasts when mutations fail?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx

### Q138: How does `answerEndRef` implement auto-scroll during QA streaming?
- **Question:** How does `answerEndRef` implement auto-scroll during QA streaming?
- **Context:** `answerEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.
- **What I need to understand:** Keeps the latest streamed tokens visible in the viewport without requiring the user to manually scroll down as the answer generates.
- **Likely follow-ups:**
  - How do you prevent auto-scroll from hijacking the page if the user manually scrolls up to read earlier text?
  - What is the difference between `behavior: 'smooth'` and `behavior: 'auto'`?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx

### Q139: How are form inputs controlled and validated in `WikiComposer`?
- **Question:** How are form inputs controlled and validated in `WikiComposer`?
- **Context:** Controlled textarea state with character counters and keyboard submit shortcuts (`Enter` to send, `Shift+Enter` for newline).
- **What I need to understand:** Provides a responsive chat experience matching developer expectations from Slack and ChatGPT.
- **Likely follow-ups:**
  - How does `textarea` auto-resize its height as the user types multiple lines?
  - What prevents accidental form submission while an IME (input method editor) is active?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-composer.tsx

### Q140: How does RepoSense avoid React state tears during concurrent Server-Sent Events updates?
- **Question:** How does RepoSense avoid React state tears during concurrent Server-Sent Events updates?
- **Context:** Uses functional state updates (`setText((prev) => prev + chunk)`) and ref buffers in `useSmoothStream`.
- **What I need to understand:** Guarantees that rapid asynchronous token events never overwrite each other due to stale state closures.
- **Likely follow-ups:**
  - What is a stale closure in React hooks?
  - Why is reading state directly inside async callbacks dangerous?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Category B3: Streaming Token Pipeline & useSmoothStream Hook (Q141 - Q150)
### Q141: Deep dive: Why was `useSmoothStream` created in `src/hooks/use-smooth-stream.ts`?
- **Question:** Deep dive: Why was `useSmoothStream` created in `src/hooks/use-smooth-stream.ts`?
- **Context:** Buffers rapid SSE token chunks and flushes them to React state using `requestAnimationFrame`.
- **What I need to understand:** Solves the 'render storm' problem: LLMs emit small chunks at irregular intervals. Calling `setState` on every byte forces 60+ full component re-renders per second, causing UI stutter.
- **Likely follow-ups:**
  - How does `useSmoothStream` decouple network arrival speed from display refresh rate?
  - What happens to the UI if `useSmoothStream` is replaced with standard `useState`?
- **Diagram required:** Yes (Flowchart)
- **Source references:** src/hooks/use-smooth-stream.ts

### Q142: How does `useSmoothStream` use `pending.current` as an atomic token buffer?
- **Question:** How does `useSmoothStream` use `pending.current` as an atomic token buffer?
- **Context:** `pending.current += chunk; if (frame.current === null) frame.current = requestAnimationFrame(flush);`.
- **What I need to understand:** Appends incoming strings synchronously to a mutable ref without triggering re-renders, scheduling a single batched flush for the next screen paint.
- **Likely follow-ups:**
  - Why use a `useRef` for the buffer instead of a React state variable?
  - What is the memory footprint of storing tokens in a ref buffer?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Q143: How does `flush` work inside `useSmoothStream`?
- **Question:** How does `flush` work inside `useSmoothStream`?
- **Context:** Resets `frame.current = null`, copies `pending.current`, clears the buffer, and calls `setText((v) => v + chunk)`.
- **What I need to understand:** Ensures all tokens accumulated over the preceding 16ms are committed to the DOM in a single atomic React render pass.
- **Likely follow-ups:**
  - Why must `frame.current` be reset to `null` before clearing the buffer?
  - What happens if a new token arrives while `flush` is executing?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Q144: How are animation frames cleaned up when the component unmounts?
- **Question:** How are animation frames cleaned up when the component unmounts?
- **Context:** `React.useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, [])`.
- **What I need to understand:** Cancels any pending animation frame callback, preventing memory leaks and 'Cannot update unmounted component' warnings.
- **Likely follow-ups:**
  - What happens if a user navigates away from the QA view while a 500-token answer is streaming?
  - Does `cancelAnimationFrame` guarantee the browser stops execution immediately?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Q145: How does `reset` clear streaming state when a new question is submitted?
- **Question:** How does `reset` clear streaming state when a new question is submitted?
- **Context:** `reset()` cancels pending animation frames, empties `pending.current`, and sets `text` to empty string.
- **What I need to understand:** Wipes the previous answer cleanly so the new question's loader and streamed response start from a blank canvas.
- **Likely follow-ups:**
  - Why is calling `reset()` preferred over unmounting and remounting the entire component?
  - How does `WikiQaView` coordinate `reset()` with the question loader animation?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts, src/components/wiki/wiki-qa-view.tsx

### Q146: What is the difference between token chunking from OpenAI vs Anthropic vs Gemini in SSE streams?
- **Question:** What is the difference between token chunking from OpenAI vs Anthropic vs Gemini in SSE streams?
- **Context:** Different providers emit tokens in varying granularities (single characters, word fragments, or multi-word chunks).
- **What I need to understand:** `useSmoothStream` standardizes these irregular provider streams into a visually uniform, typewriter-smooth animation.
- **Likely follow-ups:**
  - Why do some models feel jerky during raw streaming?
  - How does frame-rate buffering eliminate perceived provider differences?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Q147: How does `WikiQaView` know when a stream has completed?
- **Question:** How does `WikiQaView` know when a stream has completed?
- **Context:** The backend SSE connection closes or emits a `[DONE]` event, triggering `onFinish` in the fetch stream reader.
- **What I need to understand:** Transitions UI state from `streaming: true` to `streaming: false`, enabling save and copy buttons.
- **Likely follow-ups:**
  - What happens if the network drops before the `[DONE]` event is emitted?
  - How does the client detect a hung or broken SSE connection?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx, src/server/routes/projects.ts

### Q148: How does streaming interact with markdown code block formatting?
- **Question:** How does streaming interact with markdown code block formatting?
- **Context:** During streaming, code blocks are frequently incomplete (e.g. ````ts
function test(` without closing backticks).
- **What I need to understand:** ReactMarkdown and RemarkGFM gracefully handle unclosed code fences, rendering partial code blocks without throwing syntax errors.
- **Likely follow-ups:**
  - What happens to syntax highlighting while a code block is incomplete?
  - Does PrismJS crash if code input is syntactically incomplete?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx

### Q149: How does streaming interact with inline citation tags?
- **Question:** How does streaming interact with inline citation tags?
- **Context:** Citations arrive token-by-token: `[` -> `[[` -> `[[src/` -> `[[src/file.ts:10-20]]`.
- **What I need to understand:** The citation regex only matches complete bracketed expressions. Incomplete citations render as raw text until the closing `]]` arrives, then transform into a `CitationPill`.
- **Likely follow-ups:**
  - Does this cause a visual layout jump when the pill renders?
  - How does the pill's inline CSS minimize layout shift?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx, src/components/wiki/citation-pill.tsx

### Q150: Could `useSmoothStream` be implemented using Web Workers? What are the trade-offs?
- **Question:** Could `useSmoothStream` be implemented using Web Workers? What are the trade-offs?
- **Context:** A Web Worker could buffer and parse tokens off the main UI thread, posting formatted strings back.
- **What I need to understand:** Trade-off: Overhead of `postMessage` serialization for small strings exceeds the cost of a simple `requestAnimationFrame` ref buffer.
- **Likely follow-ups:**
  - When would a Web Worker be justified in the frontend pipeline?
  - Does React 19 Concurrent Mode make `useSmoothStream` obsolete?
- **Diagram required:** No
- **Source references:** src/hooks/use-smooth-stream.ts

### Category B4: Markdown, Prism Highlighting & Citation Parsing (Q151 - Q160)
### Q151: Explain how `renderCitations` in `src/components/wiki/markdown.tsx` transforms citation tags.
- **Question:** Explain how `renderCitations` in `src/components/wiki/markdown.tsx` transforms citation tags.
- **Context:** Replaces `[[path:start-end]]` with `[path:start-end](citation:encodedPath:start:end)` markdown links.
- **What I need to understand:** Leverages standard markdown link parsing: by transforming custom brackets into standard markdown links with a `citation:` protocol, ReactMarkdown's standard link component can render them as `CitationPill`.
- **Likely follow-ups:**
  - Why use a custom URI scheme `citation:` instead of a custom Remark AST plugin?
  - What are the trade-offs in performance and complexity between regex pre-processing and AST parsing?
- **Diagram required:** Yes (Flowchart)
- **Source references:** src/components/wiki/markdown.tsx

### Q152: How does `WikiMarkdown` render custom components for markdown links?
- **Question:** How does `WikiMarkdown` render custom components for markdown links?
- **Context:** `components={{ a: ({ href, children }) => ... }}` checks if `href?.startsWith('citation:')`.
- **What I need to understand:** If the link has the `citation:` protocol, it unpacks the path and line numbers and mounts a `<CitationPill />`. Otherwise, it renders a standard external anchor tag.
- **Likely follow-ups:**
  - How does this prevent regular external web links from being rendered as citation pills?
  - How are security attributes like `rel='noopener noreferrer'` applied to external links?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx, src/components/wiki/citation-pill.tsx

### Q153: How does `CitationPill` handle click events and trigger code inspection?
- **Question:** How does `CitationPill` handle click events and trigger code inspection?
- **Context:** Calls `onCitation({ filePath, startLine, endLine })` when clicked.
- **What I need to understand:** Bubbles the citation event up to `WikiReader`, which fetches the file content and scrolls the code viewer to the exact line range.
- **Likely follow-ups:**
  - How does `CitationPill` stop event propagation if nested inside other clickable elements?
  - What keyboard accessibility features (e.g. Enter key trigger) are implemented on the pill?
- **Diagram required:** No
- **Source references:** src/components/wiki/citation-pill.tsx, src/components/wiki/wiki-reader.tsx

### Q154: How is syntax highlighting implemented in `WikiMarkdown` code blocks?
- **Question:** How is syntax highlighting implemented in `WikiMarkdown` code blocks?
- **Context:** Uses `react-syntax-highlighter` with Prism engine and `oneDark` / `oneLight` color themes.
- **What I need to understand:** Provides rich language-specific token coloring for TypeScript, Python, Go, Rust, SQL, and JSON code snippets.
- **Likely follow-ups:**
  - Why choose Prism over Highlight.js for code syntax highlighting?
  - How are code block copy buttons integrated into the code header?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx

### Q155: How does `useIsDark` in `src/components/wiki/markdown.tsx` track dark mode changes?
- **Question:** How does `useIsDark` in `src/components/wiki/markdown.tsx` track dark mode changes?
- **Context:** Uses a `MutationObserver` on `document.documentElement` observing the `class` attribute.
- **What I need to understand:** Automatically switches Prism syntax highlighting between `oneDark` and `oneLight` when the user toggles the application theme.
- **Likely follow-ups:**
  - Why is a `MutationObserver` required instead of reading theme state from a React context?
  - How does this avoid theme desynchronization when Tailwind toggles the `dark` class on `<html>`?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx

### Q156: How does `WikiMarkdown` detect and render Mermaid diagram code blocks?
- **Question:** How does `WikiMarkdown` detect and render Mermaid diagram code blocks?
- **Context:** Inspects code block language: `if (language === 'mermaid') return <MermaidDiagram chart={code} />`.
- **What I need to understand:** Extracts raw mermaid chart definitions from markdown fenced code blocks and passes them to the dedicated Mermaid rendering component.
- **Likely follow-ups:**
  - What happens if a markdown code block has language `mermaid` but invalid diagram code?
  - How does the renderer prevent raw code text from flashing before the diagram renders?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx, src/components/wiki/mermaid.tsx

### Q157: How does `nodeToText` extract plain text from React component trees?
- **Question:** How does `nodeToText` extract plain text from React component trees?
- **Context:** Recursively traverses children: strings/numbers returned directly, arrays joined, React elements recurse on `props.children`.
- **What I need to understand:** Used to extract clean text from headings to generate table-of-contents anchor slugs without HTML tags.
- **Likely follow-ups:**
  - Why does `slugify` fail if HTML tags are left inside heading strings?
  - What happens if a heading contains an icon component?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx

### Q158: How does `WikiMarkdown` render custom heading elements with self-linking anchors?
- **Question:** How does `WikiMarkdown` render custom heading elements with self-linking anchors?
- **Context:** `components={{ h1: ..., h2: ..., h3: ... }}` generates `id={slug}` and renders a hoverable anchor link.
- **What I need to understand:** Enables users to click or copy direct links to specific sections of a wiki page.
- **Likely follow-ups:**
  - How does clicking an in-page anchor interact with Next.js App Router scrolling?
  - How does the sticky sidebar highlight the active heading using IntersectionObserver?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx, src/components/wiki/wiki-reader.tsx

### Q159: How are tables rendered and styled in `WikiMarkdown`?
- **Question:** How are tables rendered and styled in `WikiMarkdown`?
- **Context:** `remarkGfm` plugin parses GitHub Flavored Markdown table syntax; custom `table` component wraps with overflow scrolling.
- **What I need to understand:** Ensures wide database schema tables or API parameter matrices render with clean borders and do not break the page layout on mobile.
- **Likely follow-ups:**
  - Why is `overflow-x-auto` wrapped around markdown tables?
  - How does `remarkGfm` handle table alignment colons (`|:---|---:|`)?
- **Diagram required:** No
- **Source references:** src/components/wiki/markdown.tsx

### Q160: How does `CitationPill` provide a direct deep-link to GitHub?
- **Question:** How does `CitationPill` provide a direct deep-link to GitHub?
- **Context:** Generates URL: `https://github.com/{owner}/{repo}/blob/{branch}/{filePath}#L{start}-L{end}`.
- **What I need to understand:** Gives developers immediate access to the canonical GitHub source file with GitHub's native line highlighting active.
- **Likely follow-ups:**
  - What commit SHA or branch is used in the GitHub link?
  - How is the external link icon styled on the citation pill?
- **Diagram required:** No
- **Source references:** src/components/wiki/citation-pill.tsx

### Category B5: Mermaid Diagram Rendering, Client SVGs & Error Boundaries (Q161 - Q170)
### Q161: Why does `src/components/wiki/mermaid.tsx` dynamically import the Mermaid library?
- **Question:** Why does `src/components/wiki/mermaid.tsx` dynamically import the Mermaid library?
- **Context:** `mermaidLoaded ??= import('mermaid')` inside `useEffect`.
- **What I need to understand:** Mermaid.js is a heavy library (~1.5 MB bundle size). Dynamic import ensures it is only downloaded when a wiki page actually contains a diagram, keeping initial page loads fast.
- **Likely follow-ups:**
  - What is the bundle size saving of lazy-loading Mermaid?
  - Why must Mermaid execute exclusively on the client (`'use client'`)?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q162: Explain the diagram sanitization logic in `sanitizeMermaidChart`.
- **Question:** Explain the diagram sanitization logic in `sanitizeMermaidChart`.
- **Context:** Strips markdown code fences, quotes unquoted labels containing parentheses or colons, and normalizes brackets.
- **What I need to understand:** Fixes the notorious 'Syntax error in text' bug caused by LLMs generating unescaped parentheses or brackets inside Mermaid node labels.
- **Likely follow-ups:**
  - Why does Mermaid crash when a node label contains `(some text)` without quotes?
  - How does the regex replace `[label]` with `["label"]`?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q163: How does `MermaidDiagram` handle initialization with theme awareness?
- **Question:** How does `MermaidDiagram` handle initialization with theme awareness?
- **Context:** `mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', suppressErrorRendering: true })`.
- **What I need to understand:** Applies the appropriate color palette matching the application's light/dark mode and prevents Mermaid from injecting default red error banners into the body.
- **Likely follow-ups:**
  - Why is `suppressErrorRendering: true` critical in production?
  - What happens if Mermaid inserts an unhandled error SVG into the document body?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q164: How are unique diagram IDs generated to prevent DOM ID collisions?
- **Question:** How are unique diagram IDs generated to prevent DOM ID collisions?
- **Context:** `const id = \`mermaid-${Math.random().toString(36).slice(2, 10)}\``.
- **What I need to understand:** Mermaid renders SVGs into the DOM by ID. Unique IDs prevent multiple diagrams on the same page from overwriting each other.
- **Likely follow-ups:**
  - What happens if two Mermaid diagrams share the same DOM ID during `mermaid.render`?
  - Why not use `React.useId` for Mermaid container IDs?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q165: How does `MermaidDiagram` clean up orphaned error elements on render failure?
- **Question:** How does `MermaidDiagram` clean up orphaned error elements on render failure?
- **Context:** `const errorSvg = document.getElementById('dmermaid') || document.querySelector('[id^="dmermaid"]'); errorSvg?.remove();`.
- **What I need to understand:** When Mermaid encounters invalid syntax, its parser inserts an error element directly into `document.body`. Explicit cleanup keeps the DOM clean.
- **Likely follow-ups:**
  - Where does Mermaid's default error element originate?
  - What user-friendly fallback UI is displayed when diagram rendering fails?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q166: How is the raw SVG injected into the component once rendered?
- **Question:** How is the raw SVG injected into the component once rendered?
- **Context:** `<div dangerouslySetInnerHTML={{ __html: svg }} />` with SVG container styling.
- **What I need to understand:** Renders the scalable vector graphic natively in the browser with full styling, crisp text, and zoomable geometry.
- **Likely follow-ups:**
  - What CSS rules ensure the SVG scales responsively within its container?
  - How do you prevent SVG elements from overflowing their parent cards?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q167: How does the component handle diagram re-renders when the user toggles dark mode?
- **Question:** How does the component handle diagram re-renders when the user toggles dark mode?
- **Context:** Theme state triggers `useEffect` re-run, re-initializing Mermaid with the new theme and re-rendering the SVG.
- **What I need to understand:** Ensures diagram node backgrounds, borders, and text colors update immediately when switching between light and dark modes.
- **Likely follow-ups:**
  - How does `cancelled` flag prevent race conditions during async diagram re-renders?
  - What happens if a diagram is re-rendering while the component unmounts?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q168: What types of Mermaid diagrams are supported across the DeepWiki generator?
- **Question:** What types of Mermaid diagrams are supported across the DeepWiki generator?
- **Context:** Flowcharts (`flowchart TD/LR`), sequence diagrams (`sequenceDiagram`), entity relationship diagrams (`erDiagram`), and class diagrams (`classDiagram`).
- **What I need to understand:** Visualizes system architecture, request lifecycles, and database schemas with appropriate diagram paradigms.
- **Likely follow-ups:**
  - Which diagram type is most prone to LLM syntax errors?
  - How does the system design document use `erDiagram` for database models?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx, system-design.md

### Q169: How would you add interactive pan-and-zoom controls to Mermaid diagrams in RepoSense?
- **Question:** How would you add interactive pan-and-zoom controls to Mermaid diagrams in RepoSense?
- **Context:** Integrate `svg-pan-zoom` or Panzoom library on the rendered SVG element.
- **What I need to understand:** Allows users to explore large, complex architecture diagrams that would otherwise appear squished on standard laptop screens.
- **Likely follow-ups:**
  - What event listeners are required for mouse wheel zoom and click-and-drag panning?
  - How do you preserve SVG text sharpness during zoom?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Q170: How can users copy the raw Mermaid source code from the rendered diagram?
- **Question:** How can users copy the raw Mermaid source code from the rendered diagram?
- **Context:** A hover overlay button on the diagram container that copies the sanitized chart definition to clipboard.
- **What I need to understand:** Enables developers to paste diagrams into GitHub issues, Notion pages, or PR descriptions.
- **Likely follow-ups:**
  - How does `navigator.clipboard.writeText` handle clipboard permissions?
  - What visual feedback indicates that the diagram code was copied successfully?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx

### Category B6: CodeViewer, Multi-File Stacked Panels & Source Line Highlighting (Q171 - Q180)
### Q171: Explain the full-width stacked panel layout in `src/components/wiki/code-viewer.tsx`.
- **Question:** Explain the full-width stacked panel layout in `src/components/wiki/code-viewer.tsx`.
- **Context:** Source files render as full-width panels stacked vertically in a single column rather than tabs or multi-column grids.
- **What I need to understand:** Matches developer workflow: reading multiple related source files sequentially with clear filename headers, collapsible bodies, and syntax highlighting.
- **Likely follow-ups:**
  - Why was a stacked single-column layout chosen over tabs or side-by-side split panels?
  - How does this layout adapt when viewing 4 different cited files simultaneously?
- **Diagram required:** Yes (Component)
- **Source references:** src/components/wiki/code-viewer.tsx

### Q172: How does `fetchFile` retrieve file contents from public vs private API endpoints?
- **Question:** How does `fetchFile` retrieve file contents from public vs private API endpoints?
- **Context:** Attempts `/api/public/projects/:id/file?path=...` first; falls back to authenticated `/api/projects/:id/file`.
- **What I need to understand:** Enables seamless file inspection for both unauthenticated public wiki visitors and private repository team members.
- **Likely follow-ups:**
  - Why use `{ cache: 'no-store' }` when fetching file content?
  - How does the endpoint encode file paths that contain slashes or special characters?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q173: How is line-level source highlighting implemented in `CodeViewer`?
- **Question:** How is line-level source highlighting implemented in `CodeViewer`?
- **Context:** Renders lines with line numbers; checks if `lineNumber >= file.startLine && lineNumber <= file.endLine`.
- **What I need to understand:** Applies distinct background color and border accents to the exact lines cited by the AI answer, drawing the developer's eye to relevant logic.
- **Likely follow-ups:**
  - What CSS classes highlight the target line range?
  - How does line highlighting behave if only a single line is cited (`startLine === endLine`)?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q174: How does `highlightRef` auto-scroll to the cited line range when a file loads?
- **Question:** How does `highlightRef` auto-scroll to the cited line range when a file loads?
- **Context:** `highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })` attached to the first highlighted line.
- **What I need to understand:** Ensures that in a 1,000-line file, the user immediately sees lines 450-480 without having to manually scroll through irrelevant code.
- **Likely follow-ups:**
  - Why use `block: 'center'` instead of `block: 'start'`?
  - What happens if the file has not finished loading when `scrollIntoView` is called?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q175: How does `CodeViewer` handle collapsible file panels?
- **Question:** How does `CodeViewer` handle collapsible file panels?
- **Context:** `const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)` with chevron toggle icon.
- **What I need to understand:** Allows developers to collapse files they have already reviewed, keeping the reading view tidy when inspecting multiple source files.
- **Likely follow-ups:**
  - How does collapsible state interact with the auto-scroll behavior?
  - Can all panels be collapsed or expanded simultaneously?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q176: How is the copy code snippet button implemented on `CodeViewer`?
- **Question:** How is the copy code snippet button implemented on `CodeViewer`?
- **Context:** `navigator.clipboard.writeText(content)` with temporary `copied` checkmark state for 2 seconds.
- **What I need to understand:** Allows developers to quickly copy the cited source code into their local editor or terminal.
- **Likely follow-ups:**
  - What happens if the browser denies clipboard permissions?
  - How does the copy button differentiate between copying the whole file vs copying only highlighted lines?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q177: How does `CodeViewer` handle loading and error states when fetching raw files?
- **Question:** How does `CodeViewer` handle loading and error states when fetching raw files?
- **Context:** Renders a subtle spinner skeleton during fetch; displays 'Failed to load file content' with retry button if network fails.
- **What I need to understand:** Prevents blank panels or UI lockups when GitHub API rate limits are encountered.
- **Likely follow-ups:**
  - How does `cancelled` flag in `useEffect` prevent state updates on unmounted file viewers?
  - What happens if a user rapidly clicks between three different citations?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q178: How are line numbers formatted and aligned in `CodeViewer`?
- **Question:** How are line numbers formatted and aligned in `CodeViewer`?
- **Context:** Monospace line number column with right-aligned text (`text-right text-muted-foreground select-none`).
- **What I need to understand:** `select-none` prevents line numbers from being accidentally selected when a user drags their mouse to copy code text.
- **Likely follow-ups:**
  - Why is `user-select: none` critical on code line numbers?
  - How do line numbers align with wrapped code lines?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q179: How does `CodeViewer` support switching branches or commit revisions?
- **Question:** How does `CodeViewer` support switching branches or commit revisions?
- **Context:** `branch` prop passed to `fetchFile` query string (`&branch=feature-xyz`).
- **What I need to understand:** Ensures that when viewing documentation for a feature branch, the code viewer displays that exact branch's code rather than `main`.
- **Likely follow-ups:**
  - What happens if a cited file only exists on a feature branch and not on `main`?
  - How does the header display the active branch or commit SHA?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q180: How would you optimize `CodeViewer` for files exceeding 5,000 lines?
- **Question:** How would you optimize `CodeViewer` for files exceeding 5,000 lines?
- **Context:** Virtualize line rendering using `@tanstack/react-virtual`.
- **What I need to understand:** Only mounts the ~50 lines currently visible in the DOM viewport, keeping memory usage constant and scrolling smooth at 60 FPS even on massive files.
- **Likely follow-ups:**
  - What is DOM node bloat and why does rendering 5,000 lines degrade performance?
  - How does virtualization calculate scroll offset when lines have varying heights?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Category B7: UI/UX, Animations, Accessibility & Production Edge Cases (Q181 - Q200)
### Q181: How does `IndexingLoader` in `src/components/indexing-loader.tsx` pace animation steps?
- **Question:** How does `IndexingLoader` in `src/components/indexing-loader.tsx` pace animation steps?
- **Context:** Introduces intentional uniform delays between rapid backend status transitions.
- **What I need to understand:** Prevents animation flickering when quick steps (like file filtering) complete in 50ms, giving the user's eye time to register progress smoothly.
- **Likely follow-ups:**
  - Why is uniform perceptual pacing important in UX design?
  - How does the component synchronize artificial minimum step display times with actual SSE backend events?
- **Diagram required:** No
- **Source references:** src/components/indexing-loader.tsx

### Q182: How does the QA chat bar support switching between multiple consecutive questions?
- **Question:** How does the QA chat bar support switching between multiple consecutive questions?
- **Context:** When a new question is submitted, `WikiQaView` wipes current answer, displays the loader, and initiates the new question session.
- **What I need to understand:** Maintains session momentum without forcing the user to navigate back and forth to the main wiki page.
- **Likely follow-ups:**
  - How is conversation history retained when asking follow-up questions in the same session?
  - What button allows the user to manually exit QA and return to the wiki reader?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx, src/components/wiki/wiki-composer.tsx

### Q183: How does RepoSense ensure page reloads on a QA instance do not lose the generated answer?
- **Question:** How does RepoSense ensure page reloads on a QA instance do not lose the generated answer?
- **Context:** Questions and answers are persisted to `Question` / `QaThread` in PostgreSQL and referenced in URL state.
- **What I need to understand:** Reloading the page restores the question session and answer view instead of abruptly dumping the user back to the wiki homepage.
- **Likely follow-ups:**
  - What query parameters in the URL identify the active QA instance?
  - How does `useEffect` fetch the saved question upon initial mount if URL params are present?
- **Diagram required:** No
- **Source references:** src/app/(protected)/qa/page.tsx, src/components/wiki/wiki-qa-view.tsx

### Q184: Explain the model selector dropdown in `src/components/wiki/wiki-composer.tsx`.
- **Question:** Explain the model selector dropdown in `src/components/wiki/wiki-composer.tsx`.
- **Context:** Radix UI `Select` or `DropdownMenu` showing available models with provider badges and context limits.
- **What I need to understand:** Allows developers to switch between fast models (GPT-4o-mini, Gemini 1.5 Flash) and reasoning models (Claude 3.5 Sonnet, DeepSeek R1) per question.
- **Likely follow-ups:**
  - How does the dropdown indicate which models have active API keys configured in the BYOK vault?
  - What happens if a user picks a model whose key is missing?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-composer.tsx, src/lib/providers/catalog.ts

### Q185: How are keyboard shortcuts implemented across the RepoSense UI?
- **Question:** How are keyboard shortcuts implemented across the RepoSense UI?
- **Context:** Global event listeners for `Cmd+K` / `Ctrl+K` (quick search), `Esc` (close code panel/modal), and `Enter` (submit question).
- **What I need to understand:** Improves developer ergonomics by providing power-user keyboard navigation without mouse reliance.
- **Likely follow-ups:**
  - How does `src/components/ui/command.tsx` implement the `Cmd+K` command palette?
  - How are keyboard listeners prevented from firing when typing inside an input field?
- **Diagram required:** No
- **Source references:** src/components/ui/command.tsx, src/components/wiki/wiki-composer.tsx

### Q186: How is color contrast and accessibility (a11y) verified across light and dark themes?
- **Question:** How is color contrast and accessibility (a11y) verified across light and dark themes?
- **Context:** Tailwind CSS HSL variables (`--background`, `--foreground`, `--primary`, `--muted-foreground`) meet WCAG 2.1 AA 4.5:1 contrast ratios.
- **What I need to understand:** Ensures developers with visual impairments can read code, documentation, and citation badges comfortably in any lighting condition.
- **Likely follow-ups:**
  - What tool audits color contrast ratios in CI (e.g. axe-core, Lighthouse)?
  - How does dark mode styling prevent pure black (`#000000`) OLED contrast harshness?
- **Diagram required:** No
- **Source references:** src/styles/globals.css

### Q187: How does `sonner` handle toast notifications across the frontend?
- **Question:** How does `sonner` handle toast notifications across the frontend?
- **Context:** `toast.success(...)`, `toast.error(...)`, `toast.info(...)` with dismiss actions.
- **What I need to understand:** Provides non-blocking, accessible feedback for background operations like copying code, saving questions, or API key validation failures.
- **Likely follow-ups:**
  - Why use `sonner` over older toast libraries like `react-toastify`?
  - How are toast notifications announced to screen readers via ARIA live regions?
- **Diagram required:** No
- **Source references:** src/components/ui/sonner.tsx, src/components/wiki/wiki-qa-view.tsx

### Q188: How does RepoSense handle network disconnection while reading documentation?
- **Question:** How does RepoSense handle network disconnection while reading documentation?
- **Context:** Browser `navigator.onLine` listener displays a subtle offline banner while cached wiki pages continue to render.
- **What I need to understand:** Ensures developers working on trains or unstable connections can continue reading previously loaded documentation.
- **Likely follow-ups:**
  - How could Service Workers and Progressive Web App (PWA) caching make DeepWiki fully offline-functional?
  - What happens if a user submits a question while offline?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-reader.tsx

### Q189: How are focus traps managed inside dialogs and sheets?
- **Question:** How are focus traps managed inside dialogs and sheets?
- **Context:** Radix UI primitives (`@radix-ui/react-dialog`) trap focus within the active modal until dismissed.
- **What I need to understand:** Prevents keyboard tab focus from escaping to obscured background elements, maintaining strict accessibility compliance.
- **Likely follow-ups:**
  - What is focus restoration and how does Radix return focus to the trigger button upon modal close?
  - How does `aria-hidden='true'` apply to background content when a sheet is open?
- **Diagram required:** No
- **Source references:** src/components/ui/dialog.tsx, src/components/ui/sheet.tsx

### Q190: How does `CodeViewer` maintain responsive font sizing and horizontal scrolling on mobile?
- **Question:** How does `CodeViewer` maintain responsive font sizing and horizontal scrolling on mobile?
- **Context:** `font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre` with custom scrollbar styling.
- **What I need to understand:** Preserves code formatting without wrapping code lines destructively on narrow mobile screens.
- **Likely follow-ups:**
  - Why is `whitespace-pre` preferred over `whitespace-pre-wrap` for source code?
  - How do touch gestures support horizontal scrolling on code blocks on iOS and Android?
- **Diagram required:** No
- **Source references:** src/components/wiki/code-viewer.tsx

### Q191: How does `WikiReader` render breadcrumb navigation in `src/components/ui/breadcrumb.tsx`?
- **Question:** How does `WikiReader` render breadcrumb navigation in `src/components/ui/breadcrumb.tsx`?
- **Context:** `Project Name > Branch > Section Title > Page Title`.
- **What I need to understand:** Provides clear situational context so developers always know where they are within a multi-section, multi-page DeepWiki.
- **Likely follow-ups:**
  - How does clicking a breadcrumb item navigate up the documentation hierarchy?
  - How does breadcrumb truncate long titles on small viewports?
- **Diagram required:** No
- **Source references:** src/components/ui/breadcrumb.tsx, src/components/wiki/wiki-reader.tsx

### Q192: How are icons loaded and tree-shaken using `lucide-react`?
- **Question:** How are icons loaded and tree-shaken using `lucide-react`?
- **Context:** Named ES module imports: `import { Check, Copy, FileCode2 } from 'lucide-react'`.
- **What I need to understand:** Ensures only the specific SVG icons used are bundled into the JavaScript bundle, preventing hundreds of unused icons from bloating client assets.
- **Likely follow-ups:**
  - What is tree-shaking in bundlers like Webpack or Turbopack?
  - What is the bundle size impact of importing `import * as Icons from 'lucide-react'` instead of named imports?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-qa-view.tsx

### Q193: How does the branch switcher dropdown communicate branch changes to the page URL?
- **Question:** How does the branch switcher dropdown communicate branch changes to the page URL?
- **Context:** `router.push(\`/wiki/${projectId}?branch=${selectedBranch}\`)`.
- **What I need to understand:** Updates URL search parameters, triggering Next.js server component re-fetching for the selected branch without full page reload.
- **Likely follow-ups:**
  - Why use URL search parameters (`?branch=...`) instead of path segments (`/wiki/[projectId]/[branch]`)?
  - How does `useSearchParams` hook react to shallow URL changes?
- **Diagram required:** No
- **Source references:** src/app/wiki/[projectId]/page.tsx, src/hooks/use-project.ts

### Q194: How is client-side error recovery implemented with React Error Boundaries?
- **Question:** How is client-side error recovery implemented with React Error Boundaries?
- **Context:** `error.tsx` in Next.js route segments catches unexpected rendering crashes and displays a reset button.
- **What I need to understand:** Prevents a single component rendering error (e.g. malformed markdown or corrupted SVG) from crashing the entire application.
- **Likely follow-ups:**
  - What props does a Next.js `error.tsx` component receive (`error`, `reset`)?
  - How does `reset()` attempt to re-render the segment without reloading the browser?
- **Diagram required:** No
- **Source references:** src/app/wiki/[projectId]/page.tsx

### Q195: How does RepoSense eliminate unwanted console error noise in production?
- **Question:** How does RepoSense eliminate unwanted console error noise in production?
- **Context:** Gracefully catches expected network 404s and handles Mermaid parser warnings with `suppressErrorRendering: true`.
- **What I need to understand:** Keeps browser developer tools clean and prevents false alarm bug reports from users.
- **Likely follow-ups:**
  - Why is logging errors via structured telemetry better than raw `console.log` / `console.error`?
  - How can custom error loggers strip sensitive API keys before logging?
- **Diagram required:** No
- **Source references:** src/components/wiki/mermaid.tsx, src/server/app.ts

### Q196: How does `WikiReader` implement copy page URL or markdown export?
- **Question:** How does `WikiReader` implement copy page URL or markdown export?
- **Context:** A share dropdown that copies direct links with hash anchors or exports the entire wiki page as raw markdown.
- **What I need to understand:** Allows developers to easily share technical documentation with teammates or import into internal wikis.
- **Likely follow-ups:**
  - How is the raw markdown content extracted for export?
  - What metadata headers are prepended to the exported markdown file?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-reader.tsx

### Q197: How does RepoSense optimize font loading using `next/font`?
- **Question:** How does RepoSense optimize font loading using `next/font`?
- **Context:** Self-hosts Geist Sans and Geist Mono via `next/font/google` or local fonts with CSS variable injection.
- **What I need to understand:** Zero external Google Fonts HTTP requests at runtime, zero layout shift (CLS = 0), and optimal font display swap.
- **Likely follow-ups:**
  - What is Cumulative Layout Shift (CLS) and how does `next/font` eliminate font swap shift?
  - Where are `--font-geist-sans` and `--font-geist-mono` applied in `tailwind.config.ts`?
- **Diagram required:** No
- **Source references:** src/app/layout.tsx, src/styles/globals.css

### Q198: How does the UI prevent double-submission when a user clicks 'Index Repository' or 'Ask' rapidly?
- **Question:** How does the UI prevent double-submission when a user clicks 'Index Repository' or 'Ask' rapidly?
- **Context:** Buttons disable automatically while `loading: true` or `streaming: true`, displaying a spinning `Loader2` icon.
- **What I need to understand:** Prevents creating duplicate background indexing jobs or overlapping QA inference streams.
- **Likely follow-ups:**
  - Why is frontend button disabling insufficient alone to prevent race conditions?
  - How does backend idempotent request handling complement disabled UI buttons?
- **Diagram required:** No
- **Source references:** src/components/wiki/wiki-composer.tsx, src/app/(protected)/create/page.tsx

### Q199: How are tooltips implemented for citation line badges and provider icons?
- **Question:** How are tooltips implemented for citation line badges and provider icons?
- **Context:** Uses `@/components/ui/tooltip` wrapping Radix UI Tooltip with short delays (`delayDuration={200}`).
- **What I need to understand:** Provides helpful context on hover (e.g. 'Click to view lines 15-32 in source') without cluttering the interface with persistent helper text.
- **Likely follow-ups:**
  - How do Radix tooltips manage focus and keyboard accessibility?
  - Why is `delayDuration` important to prevent visual annoyance during rapid mouse movement?
- **Diagram required:** No
- **Source references:** src/components/ui/tooltip.tsx, src/components/wiki/citation-pill.tsx

### Q200: What metrics and performance audits would you run on the RepoSense frontend before a major release?
- **Question:** What metrics and performance audits would you run on the RepoSense frontend before a major release?
- **Context:** Google Lighthouse audit (targeting 95+ Performance, 100 Accessibility, 100 Best Practices), Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1), and React Profiler component render audits.
- **What I need to understand:** Guarantees that RepoSense feels fast, responsive, and production-ready on both high-end developer workstations and mobile devices.
- **Likely follow-ups:**
  - What is Interaction to Next Paint (INP) and how does `useSmoothStream` protect INP scores?
  - How do you inspect component re-render counts using React Developer Tools?
- **Diagram required:** No
- **Source references:** system-design.md, src/hooks/use-smooth-stream.ts

---

## 5. Decision-Defence Index

This index maps critical engineering trade-offs and decisions to specific interview questions in Bank A and Bank B.

| Decision / Trade-off | Rationale & Compromise | Key Questions |
|---|---|---|
| Next.js App Router + Hono Edge Router | Unified deployment on Vercel, shared TypeScript types, but adds routing layer complexity. | Q1, Q2, Q4 |
| Neon Serverless PostgreSQL with native pgvector | Single transactional database for relational data and vectors; avoids two-system synchronization, but requires raw SQL for vector operations. | Q3, Q5, Q40, Q86 |
| Dual Vector Columns (`vector(1536)` / `vector(768)`) | Fixed dimension columns allow HNSW index acceleration in sub-25ms; compromises schema flexibility when adding new providers. | Q7, Q43, Q111 |
| Regex AST Skeletons vs Full Tree-sitter WASM | Zero native dependencies, sub-millisecond execution in serverless runtimes; compromises 5% syntax edge-case precision. | Q28, Q32, Q110 |
| Two-Phase DeepWiki Generation (Plan -> Parallel Pages) | Holistically planned table of contents before generation; bounded concurrency prevents provider rate limits. | Q49, Q50, Q52 |
| Bring Your Own Key (BYOK) with AES-256-GCM Vault | Eliminates centralized AI token billing risk and empowers frontier model selection; requires robust key verification. | Q6, Q73, Q74, Q78 |
| `useSmoothStream` Token Buffering via `requestAnimationFrame` | Decouples SSE network arrival speed from browser display rate (60Hz); prevents React render storms and dropped frames. | Q93, Q141, Q142, Q143 |
| Full-Width Stacked Code Panels vs Tabbed/Grid Layout | Sequentially reading multiple related source files matches real developer debugging behavior; avoids cramped horizontal space. | Q123, Q171, Q173 |
| Dynamic Import & Sanitization for Mermaid.js | Saves ~1.5 MB initial bundle size and prevents syntax errors from breaking page rendering. | Q156, Q161, Q162, Q165 |
| Branch-Aware Composite Database Primary Keys | Allows concurrent wikis and chats across feature branches and PRs; increases row counts per repository. | Q8, Q44, Q116 |

---

## 6. Diagram Practice Index

Be prepared to draw or explain the following diagrams on a whiteboard or virtual canvas during interviews:

1. **End-to-End System Architecture (Block Flow):** Client -> Edge Hono Gateway -> Ingestion Pipeline -> pgvector Storage -> LLM Provider -> Client. (Covered in Section 1 and Q1).
2. **Repository Ingestion & Tree Processing Sequence:** Client -> Worker -> GitHub REST Tree API -> Layer Normalizer -> Chunker -> Embedding Batcher -> Postgres. (Covered in Q13, Q20, Q21).
3. **DeepWiki Two-Phase Generation Flow:** RepoSkeleton -> Architecture Brief -> WikiPlanner (JSON Plan) -> Concurrent Page Workers -> WikiPage Upsert. (Covered in Q49, Q52).
4. **Grounded QA Retrieval & Citation Loop:** Question -> Query Embedding -> pgvector Cosine Search (`<=>`) -> Wiki Keyword Match -> Context Builder -> LLM Stream -> Citation Parser -> Interactive Code Viewer. (Covered in Q61, Q151).
5. **BYOK Cryptographic Key Vault Lifecycle:** Plaintext Key -> SHA-256 Derivation -> Random 12-byte IV -> AES-256-GCM Encrypt -> Hex Serialization -> PostgreSQL. (Covered in Q73, Q74, Q78).
6. **Frontend Component Hierarchy:** `WikiReader` -> Navigation Sidebar / Breadcrumbs / `WikiMarkdown` / `WikiQaView` / `WikiComposer` / `CodeViewer` (Stacked Panels). (Covered in Q121, Q125, Q171).
7. **`useSmoothStream` Buffer Pipeline:** SSE Event Stream -> `pending.current` Ref Buffer -> `requestAnimationFrame` -> Batch React State Update -> DOM Render. (Covered in Q141, Q142, Q143).
8. **Database Entity Relationship Diagram (ERD):** User, ApiKey, Project, WikiPage, SourceCodeEmbedding, IndexingJob, QaThread, QaMessage. (Covered in Section 6 and Q84).

---

## 7. Critical Knowledge Gaps & Highest-Risk Interview Areas

Review these specific areas where interviewers typically press candidates:

1. **Serverless Worker Execution Limits:**
   - *Risk:* Interviewer asks: "What happens if a 2,000-file repository takes 4 minutes to index on Vercel which has a 60-second function timeout?"
   - *Defense:* Acknowledge that long-running jobs in production require durable task queues (e.g. Inngest, Cloudflare Queues, or AWS SQS + ECS worker). RepoSense's IndexingJob state machine is explicitly structured with step-level checkpoints (LOADING_REPO, CHUNKING_AND_EMBEDDING, PLANNING_WIKI, GENERATING_PAGES) so an interrupted job can resume without restarting from scratch (Q20, Q87, Q112).
2. **pgvector Scaling & Memory Footprint:**
   - *Risk:* Interviewer asks: "How does pgvector perform when you have 10 million vectors? Why not Pinecone?"
   - *Defense:* For small-to-medium datasets (< 1M vectors), pgvector with HNSW provides sub-25ms latency and eliminates two-system synchronization bugs. At 10M+ vectors, HNSW index RAM requirements (~7.7 KB/vector = ~77 GB RAM) exceed cost-effective PostgreSQL instances, at which point dedicated vector search engines (Qdrant, Pinecone) or sharded replicas become necessary (Q3, Q41, Q85, Q109).
3. **Regex AST Heuristics vs Language Server Protocol (LSP):**
   - *Risk:* Interviewer asks: "Why didn't you use tree-sitter or an LSP? Regex can't handle complex C++ templates or Python decorators."
   - *Defense:* Defend the operational trade-off: RepoSense runs in lightweight edge and serverless environments where compiling 30 language WASM modules incurs memory spikes and cold start penalties. The regex engine targets top-level declarations and prepends 8 context lines (SYMBOL_CONTEXT_LINES = 8) to capture decorators and docstrings, trading edge-case accuracy for universal portability (Q26, Q27, Q28, Q110).
4. **React Streaming & Render Performance:**
   - *Risk:* Interviewer asks: "Why not just call setAnswer((prev) => prev + token) inside the stream listener?"
   - *Defense:* Explain layout thrashing and dropped frames. SSE streams emit 60+ chunks/second. Calling state updates per chunk forces React to re-calculate styles and layout continuously. useSmoothStream coalesces chunks into display frames matching the browser's 60Hz paint cycle via requestAnimationFrame (Q93, Q141, Q142).

---

## 8. Coverage Audit: Verified vs Inferred vs Hypothetical

### Verified Against Actual Codebase
- All file paths, symbols, functions, and models exist in src/:
  - src/lib/chunker.ts: CHUNK_LINES = 120, CHUNK_OVERLAP = 20, SYMBOL_SPLIT_THRESHOLD = 800, SYMBOL_CHUNK_LINES = 180, SYMBOL_CONTEXT_LINES = 8.
  - src/lib/repo-filter.ts: MAX_INDEXED_FILES = 10,000, MAX_TOTAL_SOURCE_BYTES = 64 MB, MAX_FILE_BYTES = 250 KB.
  - src/lib/embeddings.ts: embedAndStoreChunks, raw SQL unnest vector update, cosine <=> search.
  - src/lib/wiki-generator.ts: WikiPlan, PAGE_CONCURRENCY = 3, ensureBlueprint, parseJsonPlan.
  - src/lib/qa-engine.ts: buildPrompt, strict [[filePath:startLine-endLine]] citation enforcement.
  - src/lib/providers/crypto.ts: Web Crypto AES-256-GCM, random 12-byte IV, SHA-256 key derivation.
  - src/hooks/use-smooth-stream.ts: requestAnimationFrame token buffering with ref queue.
  - src/components/wiki/: WikiMarkdown, CitationPill, MermaidDiagram, CodeViewer, WikiQaView.

### Inferred Rationale
- The coexistence of tRPC and Hono routes represents an iterative modernization from an earlier v1/v2 codebase toward a v3 architecture.
- The use of dual vector columns (embeddingOpenAI, embeddingGemini) was chosen to avoid complex database schema redesign while offering users a free-tier embedding alternative.

### Hypothetical Scenarios (Interview Practice)
- Scaling the platform to 100,000 repositories (Q109).
- Transitioning to durable distributed queues like Inngest or BullMQ (Q112).
- Incremental Git commit diff indexing (Q113).
- Self-hosted enterprise air-gapped deployments with local Ollama LLMs (Q119).
