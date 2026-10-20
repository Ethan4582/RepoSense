# RepoSense Revamp — Migration & Feature Plan

This document is the execution plan for Claude CLI. Work through the phases in order. Each phase lists the goal, the concrete changes, and a definition of done. Do not add features that are not listed here.

---

## 0. Guiding Principles

- **Production-grade defaults.** No hardcoded secrets anywhere, including tests and deploys.
- **BYOK only.** The server holds no provider keys. Every AI call uses a key the user supplied.
- **Simplicity over cleverness.** No SSR for app pages. No Redis, Kafka, or Inngest.
- **Keep working features working.** Meetings and Pull Requests logic is preserved; only location and UI change.
- **Keep the existing color palette.** UI changes are about structure, spacing, and component quality.
- **Frontend is a Framer-hosted landing page.** Login redirects to the deployed app URL. The app is a client of the Hono API. Do not build marketing pages.

---

## 1. Target Stack

| Layer | Choice |
|---|---|
| Backend API | Hono on Cloudflare Workers, Hono RPC client (`hc`) for typed calls |
| Frontend app | Next.js (client-rendered app pages, no SSR for dashboard/chat) deployed on Cloudflare (Pages or OpenNext), or as a static SPA if simpler |
| Database | Neon Postgres + pgvector, accessed via `@neondatabase/serverless` HTTP driver, ORM: Prisma |
| Auth | Clerk. JWT verified in Hono middleware |
| Indexing jobs | Cloudflare Workflows (multi-step, checkpointed, retried per step) |
| Progress streaming | Server-Sent Events from Hono, driven by `IndexingJob` rows in Postgres |
| Key encryption | AES-GCM via Web Crypto. Master key in Workers secret `ENCRYPTION_KEY` |
| Rate limiting (later, optional) | Upstash Redis. Not part of this plan's core scope |

**Removed:** tRPC, Stripe, LangChain `GithubRepoLoader`, Hugging Face, AssemblyAI calls outside Meetings (Meetings keeps its existing AssemblyAI integration), BullMQ, Kafka, Inngest, Redis-based queues.

---

## 2. Phase 1 — Remove Stripe, Billing, and Credits

**Goal:** Delete all payment and credit logic. No transactions remain.

### Changes
- Delete Stripe SDK dependency, Stripe webhook routes, and all Stripe env vars (`STRIPE_*`) from `env.js` and `.env.example`.
- Delete the Billing page and its sidebar entry.
- Delete `checkCredits()` and all call sites.
- Delete the credit check card from the Create Project flow.
- Delete the credit decrement at the end of indexing.
- Prisma: remove the `StripeTransactions` model and the `credits` field on `User`.
- Write a migration that drops the `StripeTransactions` table and the `User.credits` column.

### Definition of done
- `grep -ri "stripe\|credit\|billing"` returns no results in `src/`, `prisma/`, and config files (except this plan file).
- Migration applies cleanly on a fresh database and on the existing one.

---

## 3. Phase 2 — Token Estimate (replaces credits)

**Goal:** Before indexing, show the user an estimated token usage for their repo and selected model.

### Changes
- New module `src/lib/estimate.ts`:
  - Input: list of GitHub tree entries (path, size) after ignore-rules are applied.
  - Count files and total characters (use blob `size` from the tree API; no extra requests).
  - Estimate input tokens as `chars / 4` for summarization.
  - Estimate output tokens as a fixed ratio per file (e.g. 150 tokens per file summary).
  - Estimate embedding tokens separately (`chars / 4`).
- New module `src/lib/pricing.ts`: a static table of per-model input/output price per 1M tokens for every supported model (defined in `binary.md`). Mark as "estimate, verify against provider pricing."
- Output shape: `{ files, inputTokens: {min, max}, outputTokens: {min, max}, embeddingTokens, estimatedCostUsd: {min, max} }`.
- Show as a range and label it "Estimate."
- Expose through Hono route `POST /projects/estimate`.

### Definition of done
- Estimate returns for a public repo without consuming AI tokens.
- Estimate updates when the user switches the selected model.

---

## 4. Phase 3 — Hono Backend Migration (drop tRPC)

**Goal:** Replace the tRPC layer with Hono routes and Hono RPC.

### Changes
- Create `src/server/app.ts`: Hono app, exports `AppType`.
- Route groups:
  - `/projects` — create, list, get, archive, members
  - `/projects/:id/questions` — ask, list saved questions
  - `/projects/:id/commits` — list commits, pull requests
  - `/projects/:id/indexing` — start, status (SSE)
  - `/meetings` — existing meeting routes, ported
  - `/keys` — list, add, replace, delete, test
  - `/me` — profile read/update
  - `/projects/estimate` — from Phase 2
- Auth middleware: verify Clerk JWT on every route except health check.
- Frontend uses `hc<AppType>(API_URL)` for typed calls. Wrap in TanStack Query.
- Remove all `src/server/api/` tRPC files and the `@trpc/*` dependencies.
- Keep input validation with Zod (`@hono/zod-validator`).

### Definition of done
- Every former tRPC procedure has a Hono equivalent with the same behavior.
- No `@trpc` imports remain.

---

## 5. Phase 4 — Database Schema for BYOK

**Goal:** Store encrypted user keys, lock embedding provider per project, and track indexing jobs.

### Schema changes (Prisma)

**New model `ApiKey`:**
- `id` (cuid)
- `userId` (FK → User)
- `provider` (enum: `OPENAI`, `ANTHROPIC`, `GEMINI`, `GROQ`, `DEEPSEEK`, `XAI`, `META`)
- `encryptedKey` (String)
- `iv` (String)
- `keyLast4` (String) — for display only
- `label` (String, optional)
- `status` (enum: `UNVERIFIED`, `VALID`, `INVALID`, `QUOTA_EXHAUSTED`)
- `lastVerifiedAt` (DateTime?)
- `createdAt`, `updatedAt`
- Unique on `[userId, provider]` (one key per provider per user; replace to change)

**Extend `User`:**
- `defaultChatProvider` (enum, nullable)
- `defaultChatModel` (String, nullable)
- `defaultEmbeddingProvider` (enum `OPENAI` | `GEMINI`, nullable)

**Extend `Project`:**
- `chatProvider` (enum, nullable)
- `chatModel` (String, nullable)
- `embeddingProvider` (enum `OPENAI` | `GEMINI`, required once indexing starts; locked afterward)
- `embeddingModel` (String)
- `embeddingDimensions` (Int)
- Keep `gitHubToken` but encrypt it using the same AES-GCM helper.

**Change `SourceCodeEmbedding`:**
- Keep `summaryEmbedding` but make dimension explicit per project. Use a fixed column size per embedding provider: OpenAI `text-embedding-3-small` = 1536, Gemini `gemini-embedding-001` = 768. Since a project locks its provider, store vectors in a column matching that size. Implement via two columns (`summaryEmbeddingOpenAI vector(1536)`, `summaryEmbeddingGemini vector(768)`) with the active one chosen by `Project.embeddingProvider`.
- Add HNSW index with `vector_cosine_ops` on each vector column.

**New model `IndexingJob`:**
- `id`, `projectId`, `status` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`)
- `currentStep` (enum: `LOADING_REPO`, `SUMMARIZING`, `EMBEDDING`, `STORING`, `COMMITS`, `DONE`)
- `totalFiles`, `processedFiles`
- `errorCode`, `errorMessage` (nullable)
- `startedAt`, `finishedAt`
- `createdAt`

**New model `IndexingEvent`** (optional, for chat-style progress log):
- `id`, `jobId`, `step`, `message`, `level` (`INFO`, `SUCCESS`, `WARN`, `ERROR`), `createdAt`

**Remove:** `StripeTransactions`, `User.credits` (Phase 1).

### Definition of done
- Migration applies on a fresh database.
- Existing projects are either migrated (embedding provider set to the old `GEMINI` and vectors kept in `summaryEmbeddingGemini`) or wiped. Confirm with the owner before running.

---

## 6. Phase 5 — Key Vault and Provider Adapters

**Goal:** Central place to store, verify, and use user keys with a single interface across providers. See `binary.md` for the complete model binary registry, adapter configurations, and `public/` logo paths.

### Key vault
- `src/lib/crypto.ts`: AES-GCM encrypt/decrypt using Web Crypto. Key from `ENCRYPTION_KEY` (32-byte base64). Random 12-byte IV per encryption.
- Keys are never returned to the client after save. Only `keyLast4` and `status`.
- Never log keys. Redact in error messages.

### Provider adapter interface
Create `src/lib/providers/`:

```ts
interface ChatProvider {
  listModels(apiKey: string): Promise<ModelInfo[]>;
  chat(opts: { apiKey: string; model: string; messages: Message[] }): AsyncIterable<string>;
  verify(apiKey: string): Promise<VerifyResult>;
}

interface EmbeddingProvider {
  embedBatch(opts: { apiKey: string; model: string; inputs: string[] }): Promise<number[][]>;
  dimensions: number;
  defaultModel: string;
}
```

Implement adapters for (see `binary.md` for full specifications and model binaries):
- OpenAI (chat + embeddings)
- Gemini (chat + embeddings)
- Anthropic (chat only)
- Groq (chat only — limited to 3 models in `binary.md`)
- DeepSeek (chat only)
- xAI (chat only)
- Meta (`meta` — Meta Model API via `@ai-sdk/openai` targeting the Responses API at `https://api.meta.ai/v1`, primary model `muse-spark-1.3`, chat only)

Each adapter maps provider errors to a normalized error type:
- `INVALID_KEY` (401/403)
- `QUOTA_EXHAUSTED` (429 with quota message, or 402)
- `MODEL_NOT_AVAILABLE` (404 or model-not-found)
- `RATE_LIMITED` (429 transient) — retry with backoff
- `PROVIDER_ERROR` (5xx)

### Model listing
- Combine the complete static model registry in `binary.md` with each provider's list-models endpoint using the user's key so all text/reasoning models from simple to frontier are always selectable.
- Cache the list per key for a short time (e.g. 10 minutes) in KV or memory.

### Verify endpoint
- `POST /keys/:provider/test` sends a minimal request and updates `ApiKey.status`.

### Definition of done
- Each adapter has unit tests with mocked HTTP responses for the four error classes.
- Adding a new key shows status within one request.

---

## 7. Phase 6 — Embedding Rules and Chunking Strategy

**Goal:** Clear rules for which provider does embeddings, and a fast pipeline.

### Embedding rules (enforced server-side)
- Embedding provider must be `OPENAI` or `GEMINI`. A project cannot start indexing without a valid key for one of them.
- Chat provider can be any of the seven providers.
- If the chat provider is `OPENAI` or `GEMINI`, the same key is used for both, and the user can still choose a different embedding model from the same provider.
- If the chat provider is `ANTHROPIC`, `GROQ`, `DEEPSEEK`, `XAI`, or `META`, the user must have a valid OpenAI or Gemini key for embeddings.
- The embedding provider is locked to the project after indexing starts. Changing it requires re-indexing.

### Chunking
- Chunking is file-level (one summary and one embedding per file, same as today). Do not introduce AST chunking now.
- Files are filtered first: ignore lockfiles, binaries, images, `node_modules`, `dist`, `.git`, files over a size cap (e.g. 200 KB).
- Summary input is truncated to a fixed character limit (e.g. 10,000 chars, same as today).

### Pipeline performance (replaces sequential loops)
- Summarization: bounded concurrency with `p-limit` (concurrency 10–20, tuned per provider rate limits).
- Embeddings: batch requests, 50–100 inputs per request (OpenAI allows up to 2048 per request; Gemini batch endpoint).
- Persistence: `prisma.createMany` for rows, then one bulk `UPDATE ... FROM (VALUES ...)` or `UNNEST` for vectors.
- Remove every `sleep()`, `baseDelay`, `minimumTotalDuration`, and the Hugging Face fallback.
- Expected outcome: a 100-file repo indexes in well under a minute on a fast provider tier.

### Definition of done
- Indexing a 100-file repo completes in under 60 seconds on OpenAI, measured and recorded.
- Failure in one file does not fail the whole job; it is recorded as a warning and skipped.

---

## 8. Phase 7 — Indexing as a Cloudflare Workflow with Progress

**Goal:** Durable, retryable indexing with step-by-step progress visible to the user.

### Workflow
Define `IndexingWorkflow` (Cloudflare Workflows):
1. `load-repo`: fetch tree, apply filters, write `totalFiles`. Emit event.
2. `summarize-batches`: for each batch of files, summarize with bounded concurrency. Write `processedFiles` after each batch. Emit event per batch.
3. `embed-batches`: embed summaries in batches. Emit event per batch.
4. `store-vectors`: persist rows and vectors in bulk. Emit event.
5. `commits`: poll last commits, diffs, and commit summaries (existing logic, moved in).
6. `finalize`: set `IndexingJob.status = COMPLETED`, enable chat.

Each step is wrapped in `step.do()` so it retries independently and does not restart from file 1.

### Progress reporting
- Each step writes an `IndexingEvent` row and updates `IndexingJob`.
- `GET /projects/:id/indexing/stream` returns SSE. It reads new `IndexingEvent` rows every 1–2 seconds and closes when status is `COMPLETED` or `FAILED`.
- Client hook `useIndexingProgress(projectId)` consumes SSE and exposes `{ step, processed, total, events }`.

### UI for progress
- Chat-style step list inside the project overview while indexing. Example:
  - ✓ Repository loaded — 87 files found
  - ⟳ Summarizing files (34 / 87)
  - ✓ Summaries complete
  - ⟳ Generating embeddings (34 / 87)
  - ✓ Embeddings stored
  - ✓ Ready to chat
- Use `progress` (shadcn) for the bar.
- On failure, show the error with a clear reason and a "Update key in Settings" action when the error is `INVALID_KEY` or `QUOTA_EXHAUSTED`.

### Definition of done
- Killing the worker mid-run resumes from the last completed step.
- The UI shows each step as it completes without a page refresh.

---

## 9. Phase 8 — Error Surfacing to the User

**Goal:** Clear, specific messages for key failures.

| Error code | User-facing message |
|---|---|
| `INVALID_KEY` | "Your {Provider} API key is invalid. Update it in Settings." |
| `QUOTA_EXHAUSTED` | "Your {Provider} key has run out of credits or hit its quota." |
| `MODEL_NOT_AVAILABLE` | "{Model} is not available on your {Provider} account." |
| `RATE_LIMITED` | "{Provider} is rate limiting requests. Retrying." (shown only if retry fails: "Try again in a few minutes.") |
| `PROVIDER_ERROR` | "{Provider} is having issues. Try again shortly." |
| `EMBEDDING_KEY_MISSING` | "Add an OpenAI or Gemini key to enable embeddings." |

Surface these in: indexing progress, chat responses, and key test results. Use `sonner` toasts for transient errors and inline alerts for blocking errors.

---

## 10. Phase 9 — Settings Page (Profile + API)

**Goal:** One Settings page with two sections.

### Route
`/settings` with tabs or sub-nav: **Profile** and **API & Models**.

### Profile tab
- Name, email (read-only, from Clerk), avatar (from Clerk).
- Save writes to `/me`.

### API & Models tab
- Table of seven providers. Columns: Provider (logo directly from `public/` folder), Status (Connected / Not added / Invalid / Quota exhausted), Key (masked, last 4), Actions (Add, Replace, Remove, Test).
- Add or replace opens a dialog (shadcn `dialog`). Key input is masked and never shown back.
- Test button calls `/keys/:provider/test` and shows the result inline.
- Default models section:
  - Default chat provider and model (dropdown fed by `binary.md` / `listModels` for that provider).
  - Default embedding provider (OpenAI or Gemini only). Show a warning if no valid embedding key exists.
- Remove key requires confirmation (`alert-dialog`). Warn if the key is used by any project.

### Definition of done
- Adding, testing, replacing, and removing a key all work end-to-end.
- No key value is ever returned to the client.

---

## 11. Phase 10 — Model Selector (T3-style)

**Goal:** A model picker in the chat bar, modeled on the T3 Chat selector in the reference image. See `binary.md` for the full model catalog, descriptions, and pricing tiers.

### Behavior
- Shows only providers that have a valid key for the user. Other providers are shown greyed with "Add key" link to Settings.
- Left vertical rail: provider icons (logos directly from `public/` folder). Plus a "Favorites" entry at the top.
- Right panel: searchable list (`command` component). Each row: model name, a tier badge (`$`, `$$`, `$$$`, `$$$+`) derived from the pricing table, short description, favorite star toggle, and an info button.
- Selecting a model updates the current project's chat model (or the session override) and closes the panel.
- The chat bar bottom-left chip shows the current provider logo, model name, and tier badge.
- No Attach, Search, or Instant buttons. Do not add these.

### Implementation
- Built with shadcn `popover` + `command`. Do not hand-roll.
- Model list comes from the catalog in `binary.md` and the API (`listModels` per provider using the user's key), cached client-side with TanStack Query.
- Favorites stored per user in the database (`User` preferences JSON column `preferences` or a `FavoriteModel` table).

### Definition of done
- Selecting a model changes the model used by the next question, verified in the server logs.
- Providers without a key cannot be selected.

---

## 12. Phase 11 — Ask a Question (Q&A) Flow

**Goal:** Full chat surface, RAG retrieval unchanged in logic, new UI.

### Retrieval (keep logic, switch providers)
- Embed the question with the project's embedding provider.
- Vector search: `1 - (summary_embedding <=> query::vector) > threshold` (keep the current 0.5 threshold, make it configurable), top 12 files.
- Build prompt with retrieved file summaries and code snippets.
- Stream the answer from the project's chat provider and model.

### Response shape
- Stream tokens to the client over SSE.
- After completion, persist `Question` with `answer` and `fileReference` (list of file names and paths).

### UI
- Remove the separate "Ask a Question" card and "Saved Questions" section from the dashboard.
- Project overview becomes a chat thread:
  - Messages list with user messages and assistant messages.
  - Assistant messages render Markdown with code blocks.
  - Under each assistant message: collapsible "References" listing files used.
  - Clicking a reference opens a side sheet (shadcn `sheet`) with file summary and source.
- Bottom chat bar: textarea (auto-grow), model chip (Phase 10), send button.
- Threads persist per project. Old saved questions appear as past threads.

### Definition of done
- Answers stream in the chat, references show per message, and the thread survives a page refresh.

---

## 13. Phase 12 — Project Creation Flow

**Goal:** Simple, first-run-friendly creation with an estimate before any work starts.

### Steps (single page, stepped form)
1. **Repository:** project name, GitHub repo URL, optional GitHub token (encrypted at rest).
2. **Estimate:** after URL is valid, show the Phase 2 estimate card: files, input/output/embedding tokens, estimated cost range. Recompute on model change.
3. **Models:** chat provider and model (defaults from Settings), embedding provider (OpenAI or Gemini). Block if required keys are missing and link to Settings.
4. **Start:** creates the project, the `IndexingJob`, and starts the Workflow. Redirect to project overview with progress panel.

### Remove
- Illustration-heavy empty state from the create page.
- "Check Credits" button and wording.
- "Create a GitHub personal access token" link can stay as a small helper text under the token field.

### Definition of done
- A user with no keys cannot start indexing and sees the exact missing requirement.

---

## 14. Phase 13 — Sidebar and Navigation

**Goal:** Cleaner sidebar, same colors.

### Structure
- Top: logo and collapse toggle.
- Projects section: "Projects" label, "+ New project" button, list of projects.
- Per project (when selected): Overview, Q&A, Meetings, Pull Requests.
- Bottom: Settings.
- Remove: Billing.

### Implementation
- Use shadcn `sidebar` block. Keep existing colors and logo.
- Collapsible on desktop, drawer on mobile.

### Definition of done
- Billing gone. Pull Requests and Settings present. Collapse state persists.

---

## 15. Phase 14 — Project Overview and Header

- Header: repo name, GitHub link icon, indexing status pill, `⋯` menu.
- `⋯` menu contains: Invite Members, Archive (kept as-is in the `⋯` menu). Remove the large buttons from the main area.
- Main area: chat thread (Phase 11). No meeting card here.
- Remove the "Create a New Meeting" card from this page. Meetings stay in the Meetings page only.

---

## 16. Phase 15 — Pull Requests Page (moved)

- New sidebar item per project: "Pull Requests".
- Move the existing PR and commit-chart section here. Do not change the feature logic.
- Layout: table with title, author, status, date, and expandable row showing commit messages.
- Chart (existing) stays above the table.

---

## 17. Phase 16 — Meetings UI Cleanup

- No logic changes. Meeting feature is working and must not be tested or re-architected in this revamp.
- Replace hand-rolled layout with shadcn `card`, `button`, and `empty` patterns.
- Keep Upload Meeting flow and AssemblyAI integration exactly as is.
- Meetings list uses shared list/empty-state components.

---

## 18. Phase 17 — shadcn Component Replacement Pass

Replace hand-rolled components page by page using the official shadcn CLI (`npx shadcn@latest add <component>`).

Order:
1. `button`, `input`, `textarea`, `label`, `card`
2. `dialog`, `alert-dialog`, `sheet`, `popover`, `command`
3. `sidebar`
4. `table`, `badge`, `progress`, `skeleton`
5. `sonner` (toasts)

Rules:
- Install the component, migrate usages, delete the old file only after the page compiles and works.
- Keep existing colors via CSS variables in `globals.css`. Do not change palette values.
- Run type-check and lint after each component swap.

---

## 19. Phase 18 — Environment and Config

### Remove
- `GEMINI_API_KEY`, `HUGGING_FACE_API_KEY`, `OPENAI_API_KEY` (server-level), `STRIPE_*`, any other provider key at server level.

### Keep
- `DATABASE_URL`, `CLERK_*`, `ASSEMBLYAI_API_KEY` (Meetings only), `CLOUDINARY_*` (Meetings only), `GITHUB_TOKEN` only if used for public repo rate limits as a fallback. Otherwise remove.

### Add
- `ENCRYPTION_KEY` (32-byte base64). Must be set in Workers secrets and locally. Fail fast on startup if missing.
- `APP_URL`, `API_URL` for CORS and redirect configuration.

### Config
- `wrangler.toml` with Worker, Workflow binding, and Hyperdrive or direct Neon connection.
- Local development uses `.dev.vars`. Add `.dev.vars` to `.gitignore`.

### Testing and deploy
- No hardcoded keys in tests. Tests mock provider HTTP. Integration tests use a user key from env that the developer sets locally (such as `MODEL_API_KEY` for Meta Model API testing).

---

## 20. Phase 19 — Deploy

- Backend: `wrangler deploy` to Workers, custom subdomain (e.g. `api.yourdomain.com`).
- Frontend: deployed to Cloudflare, custom subdomain (e.g. `app.yourdomain.com`). Framer landing page links to it.
- Login: Framer button → app URL → Clerk sign-in → dashboard.
- Verify CORS allows the app origin only.

---

## 21. Out of Scope (do not build now)

- Stripe, billing, credits, or usage metering.
- Redis, Upstash, Kafka, BullMQ, Inngest.
- Server-side rendering for app pages.
- AST-based code chunking.
- Changes to Meetings logic or AssemblyAI integration.
- New marketing pages (Framer handles these).
- Attach, Search, or Instant features in the chat bar.
- Color or brand changes.

---

## 22. Open Questions & Decisions (Resolved before Phase 4 migration)

1. Existing projects: migrate their vectors to the `GEMINI` column (`summaryEmbeddingGemini`), or wipe and re-index?
2. **Meta (Resolved):** Uses the direct **Meta Model API** (`https://api.meta.ai/v1`) via `@ai-sdk/openai` targeting the Responses API (`muse-spark-1.3` default, plus all Muse Wonder/Spark models in `binary.md`).
3. **Invite Members and Archive (Resolved):** Keep as-is inside the `⋯` menu in the Project Overview header.
4. **Favorites (Resolved):** Store per user in the database (`User.preferences` JSON column or `FavoriteModel` table) so favorites sync across devices via Clerk auth.

---

## 23. Execution Order Summary

1. Phase 1 — Remove Stripe, billing, credits
2. Phase 2 — Token estimate
3. Phase 4 — Schema (BYOK, jobs, dual vector columns)
4. Phase 5 — Key vault and provider adapters (with `binary.md` model registry)
5. Phase 3 — Hono backend migration (drop tRPC)
6. Phase 6 — Embedding rules and pipeline performance
7. Phase 7 — Workflow indexing with progress
8. Phase 8 — Error surfacing
9. Phase 9 — Settings page
10. Phase 10 — Model selector
11. Phase 11 — Q&A chat flow
12. Phase 12 — Project creation flow
13. Phase 13 — Sidebar
14. Phase 14 — Project overview
15. Phase 15 — Pull Requests page
16. Phase 16 — Meetings UI cleanup
17. Phase 17 — shadcn replacement pass
18. Phase 18 — Environment and config
19. Phase 19 — Deploy

Run `type-check`, `lint`, and the test suite after every phase. Do not start the next phase until the current phase's definition of done is met.