# Production-Grade DeepWiki Generation Engine (`plan.md`)

This document is the authoritative specification for **Anti-Gravity / Claude CLI** to upgrade the RepoSense wiki synthesis engine and interactive Q&A experience. It eliminates boilerplate categories and shallow summaries, replacing them with **emergent domain discovery**, **deep technical whitepaper synthesis**, **concrete code-symbol mappings**, **precise line-level citations**, and a rock-solid **Q&A bookmarking & cache persistence system**.

---

## 1. Core Architectural Principles & Objective

1. **Zero Hardcoded Taxonomy:**
   * Completely remove static category buckets (`Architecture`, `Data Flow`, `Setup and Workflow`, `Execution and Services`, `Deep Dives`).
   * The documentation hierarchy must emerge organically from the codebase's actual domain concepts (e.g., in an editor: *Notebooks*, *Source Control and Git*, *Extension Host*; in an ML library: *Model Architectures*, *Auto Classes & Lazy Loading*; in an API: *Payment Lifecycle*, *Queue Reconciler*).

2. **Whitepaper-Density Technical Synthesis:**
   * Documentation pages are not simple README summaries. Each page must read like a senior systems architecture whitepaper.
   * Every major conceptual claim must explicitly identify and map to real code entities (classes, interfaces, exported methods, types, and database models) with exact source coordinates (`[filepath:startLine-endLine]`).

3. **Deterministic Navigation & Smooth Streaming:**
   * Every header generated in markdown (`h2`, `h3`) must have a slugified DOM ID attached so the right-side "On this page" TOC executes smooth auto-scroll to exact offsets without jumping or failing.
   * Streaming text chunks must use smooth frame buffering (via `requestAnimationFrame` or throttle intervals) to eliminate flicker and jitter during token delivery.

4. **Persistent Q&A Bookmarking & Zero-Duplicate Inference:**
   * Allow users to bookmark questions and solutions directly from the floating dock or split-pane view.
   * Persist the full question, answer markdown, file references, and line citations to the `Question` table in PostgreSQL.
   * Expose a polished **Q&A Page (`/qa` or `/project/[id]/qa`)** displaying all saved queries. Clicking a saved item instantly rehydrates the full split-pane state with zero LLM/embedding inference cost.

5. **Token Efficiency with Frontier Quality:**
   * While inference runs on the user's BYOK key, token expenditure must be disciplined and predictable.
   * Total generation cost for a mid-to-large repository must remain within **~80,000 to 160,000 tokens total** by feeding only relevant module slices to each chapter generator rather than dumping the whole repo into context.

6. **100% Cloudflare Workers & Neon Serverless Compatibility:**
   * All structural parsing, AST regex passes, and token streaming must execute cleanly under Cloudflare Workers limits (`cpu_ms = 50`, `crypto.subtle`, standard Web Streams, zero native C++ bindings).

---

## 2. Ingestion & Multi-Stage Generation Pipeline

```
               Filtered GitHub Repository Tree & Source Files
                                     │
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │ Stage 1: Structural Context Assembly (0 LLM Tokens)   │
        │ Fast regex/AST pass: extracts manifests, directory map,│
        │ dependency graph, and exported class/interface symbols │
        └────────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │ Stage 2: Domain-Emergent Taxonomy Planner (1 LLM Call) │
        │ Discovers 3–6 native domain sections, plans 8–14       │
        │ specific architectural pages, assigns target files     │
        └────────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │ Stage 3: Concurrent Chapter Synthesis (p-limit: 3)     │
        │ Generates multi-section markdown, Mermaid flowcharts,   │
        │ component-to-code mapping tables, inline line citations│
        └────────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
        Persisted to Postgres (WikiPage & SourceCodeEmbedding)
```

---

## 3. Stage 1: Structural Context Assembly (`src/lib/wiki/analyzer.ts`)

**Goal:** Extract a rich architectural skeleton of the entire codebase in `<300ms` without burning any LLM tokens.

1. **Manifest & Framework Detection:**
   * Inspect root manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`).
   * Extract primary runtime, major frameworks, core libraries, and build scripts.

2. **Symbol & Dependency Graph Extraction (Regex/Light AST):**
   * Scan every filtered source file (`<250KB`, ignoring lockfiles, `.env*`, build artifacts, and UI boilerplate).
   * For each file, record:
     * `filePath`, `directory`, `lineCount`
     * Internal imports (which local repo files does this file import?)
     * Exported symbols: class names, interface names, type aliases, primary function definitions, API routes, and schema models along with their exact starting line numbers.

3. **Compact Repo Skeleton Assembly:**
   * Pack this data into a structured `RepoSkeleton` JSON object (~3,000 to 6,000 tokens total).
   * Persist `Project.repoSkeleton` in PostgreSQL for instant retrieval during interactive Q&A.

---

## 4. Stage 2: Domain-Emergent Taxonomy Planner (`src/lib/wiki/planner.ts`)

**Goal:** Generate a repository-specific table of contents mirroring the native architecture of the project.

### 4.1 Planner Schema Definition

```typescript
import { z } from "zod";

export const WikiPlannerSchema = z.object({
  overviewTitle: z.string().describe("e.g., 'VS Code Architecture Overview' or 'Transformers System Blueprint'"),
  domainSummary: z.string().describe("2-sentence summary of the core engineering domain of the repo"),
  sections: z.array(
    z.object({
      sectionTitle: z.string().describe(
        "Domain-native functional subsystem. FORBIDDEN: 'Architecture', 'Data Flow', 'Setup Workflow', 'Services', 'Deep Dives'. MUST be specific: e.g. 'Source Control and Git', 'Notebooks', 'Model Architectures', 'Task Execution Engine'"
      ),
      sectionOrder: z.number().int(),
      pages: z.array(
        z.object({
          slug: z.string(),
          title: z.string().describe(
            "Concrete architectural topic or component. MUST name real systems/classes: e.g., 'Multi-Process Model', 'SCM Framework & Provider Model', 'Auto Classes & Lazy-Loading Factory'"
          ),
          pageOrder: z.number().int(),
          targetFilePaths: z.array(z.string()).describe("List of 2 to 6 specific file paths containing the source code for this topic"),
          focusSymbols: z.array(z.string()).describe("Specific classes, interfaces, or functions to deeply analyze"),
          expectedMermaidType: z.enum(["flowchart", "sequenceDiagram", "classDiagram", "stateDiagram"]).optional(),
        })
      ),
    })
  ),
});
```

### 4.2 System Prompt for the Planner Pass
```text
You are a Principal Software Architect analyzing a software repository to construct an authoritative, multi-page DeepWiki documentation hierarchy.

RULES FOR STRUCTURING:
1. BAN GENERIC BOILERPLATE: You must NEVER use generic section titles such as "Architecture", "Data Flow", "Setup", "Workflow", "Services", "Execution", or "Deep Dives".
2. DISCOVER DOMAIN-NATIVE SUBSYSTEMS: Group files according to their actual functional domain in the software. For an editor: "Notebooks", "Debugging", "Search", "Source Control". For a distributed queue: "Worker Pool", "Heartbeat & Leader Election", "Job Serialization". For an ML library: "Model Architectures", "Weight Loading", "Tokenization".
3. CONCRETE PAGE NAMES: Page titles must reference actual subsystems, interfaces, or architectural mechanisms (e.g., "Multi-Process Model", "SCM Framework & Git Extension", "PreTrainedModel & Config Lifecycle").
4. TARGETED ASSIGNMENT: Assign 2 to 6 specific source files to each page so the chapter writer receives focused, high-signal context.
5. SCALE: Plan 3 to 5 domain sections with 2 to 4 pages each (total 8 to 14 pages). Always start Section 1 with the root Overview page.
```

---

## 5. Stage 3: Deep Technical Chapter Synthesis (`src/lib/wiki/writer.ts`)

**Goal:** Generate comprehensive, senior-level documentation pages with tables, diagrams, and line-level citations that directly populate the right-side "On this page" TOC.

### 5.1 Input Context Assembly per Page
* Provide the LLM with:
  * Page `title`, `sectionTitle`, and `focusSymbols`.
  * The complete line-numbered source code of the assigned `targetFilePaths` formatted with line prefixes:
    ```
    === File: src/vs/workbench/browser/web.main.ts (Lines 1-120) ===
    1: import { IWorkbench } from 'vs/workbench/browser/workbench';
    2: ...
    ```
  * The global `RepoSkeleton` for cross-module context.

### 5.2 Mandatory Page Structure & Rules
Every generated markdown page MUST adhere to the following schema:

1. **Collapsible Relevant Files (`> Relevant source files`):**
   * Output at the top of the article: a bulleted list of all files analyzed for this page.

2. **System Architecture & Core Principles (`## <Subsystem> Architecture Overview`):**
   * Rigorous explanation of why this subsystem exists, its architectural constraints, and concurrency or lifecycle considerations.

3. **Component & Code-Entity Mapping (`## Core Architectural Layers` or `## Major Subsystems`):**
   * A structured table or deep bullet list explicitly mapping architectural concepts to real code entities:
     * **Concept:** What responsibility does this component hold?
     * **Class / Interface:** Exact symbol name (`CodeMain`, `IWindowsMainService`).
     * **Source Location:** Exact clickable citation syntax `[[path/to/file.ext:startLine-endLine]]` (e.g., `[[src/vs/workbench/browser/web.main.ts:1-48]]` or `[[package.json:1-12]]`).

4. **Interactive Mermaid.js Diagram:**
   * Include at least one valid, high-fidelity Mermaid diagram (`flowchart TD` or `sequenceDiagram`) illustrating data flow, process boundaries, or state transitions across the cited components.

5. **Lifecycle / Execution Flow (`## Execution Flow & State Transitions`):**
   * Step-by-step breakdown of requests, events, or state mutations with exact line citations.

6. **Granular H2 & H3 Headings & Slug Binding:**
   * Use 6 to 10 distinct, descriptive `##` and `###` headers per page.
   * Markdown renderers must parse headings using `rehype-slug` or custom ID generation so that every heading renders `<h2 id="slugified-title">` to ensure smooth anchor jumps from the right TOC.

---

## 6. Interactive Q&A Engine, Glitch-Free Streaming & Bookmarking

### 6.1 Smooth, Jitter-Free Stream Rendering
* **Root Cause of Glitches:** Raw SSE tokens trigger re-renders on every tiny chunk, causing height jumping, scroll jitter, and layout shifts during markdown parsing.
* **Fix (`useSmoothStream` / Token Buffer):**
  * Buffer incoming stream chunks in an internal mutable ref.
  * Flush buffered tokens to React state using a `requestAnimationFrame` loop or a 25ms throttle interval.
  * Wrap partial code blocks with temporary closed fences (```` ````) during streaming to prevent unclosed syntax highlighting crashes.

### 6.2 Question Bookmarking & Direct Rehydration (`Question` Table)
1. **Schema Binding:**
   * Verify the `Question` table in Neon/Postgres stores:
     * `id`, `projectId`, `userId`, `question` (Text), `answer` (Markdown Text)
     * `fileReferences` (JSON array of `{ fileName, startLine, endLine }`)
     * `isBookmarked` (Boolean, default `false`)
     * `createdAt`, `updatedAt`
2. **Bookmark Action:**
   * Add a bookmark icon button (`Bookmark` / `Star`) in both the floating chat bar and the top-left of the answer header in the split-pane viewer.
   * Clicking toggles `isBookmarked: true` via an API route (`PATCH /api/qa/[questionId]/bookmark`) without triggering any re-generation.
3. **Q&A Dashboard (`/qa` or `/project/[id]/qa`):**
   * List all saved and historical questions with search/filter tags.
   * Clicking a saved question **does not call the LLM again**.
   * It directly loads the stored markdown answer, loads the saved `fileReferences`, and rehydrates the split-pane Code Inspector instantly at zero token cost.

---

## 7. Dynamic Frontend Binding & Clean UI Layout

Align the UI components to match the clean, uncluttered aesthetics of the reference:

1. **Left Sidebar (`WikiNav.tsx`):**
   * Remove fixed card boxes and generic icons.
   * Section headers: Clean, muted, uppercase text (`text-xs font-semibold text-muted-foreground tracking-wider uppercase mt-6 mb-2`).
   * Page links: Subtle, low-contrast text that transitions to crisp active blue (`#126dfb`) on selection without shifting layout.

2. **Center Article Canvas (`WikiArticle.tsx`):**
   * Render `> Relevant source files` in an expandable summary tag at the top.
   * Parse `[[filepath:start-end]]` tags dynamically into clickable inline pills (`<CitationPill file="web.main.ts" lines="1-48" />`).
   * Render Mermaid code blocks using `@mermaid-js/mermaid` inside a clean container with full zoom/pan support and light/dark theme variables.

3. **Right Sidebar & TOC Anchor Scroll Fix (`OnThisPage.tsx`):**
   * Remove all static hardcoded anchors (`Prerequisites`, `Installation`, `Database Setup`).
   * Dynamically parse `h2` and `h3` headers from the active page's rendered markdown.
   * **Fix Scroll Bug:** On item click, execute:
     ```typescript
     const targetEl = document.getElementById(heading.slug);
     if (targetEl) {
       targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
     ```
     Account for any fixed header offset by setting `scroll-mt-20` on markdown heading elements.
   * Attach an `IntersectionObserver` scroll-spy that highlights the active section in real-time as the reader scrolls.

4. **Floating Dock (`FloatingDock.tsx`):**
   * Center-docked at the bottom viewport: frosted translucent background (`bg-background/80 backdrop-blur-md border border-border/50 shadow-xl rounded-2xl`).
   * Model selector pill on the left, clear placeholder (`Ask about {owner}/{repo}...`), bookmark indicator, and submit action on the right.

---

## 8. Verification & Acceptance Criteria

1. **TOC Navigation Verification:**
   * Clicking any heading in the right-hand "On this page" TOC smoothly scrolls the center canvas directly to that section with correct header clearance (`scroll-mt-20`).
2. **Q&A Persistence & Bookmarking:**
   * Asking a question stores the Q&A instance in the database.
   * Bookmarking a question reflects on the Q&A page.
   * Clicking a saved question on the Q&A page reloads the exact split-pane view with line citations without sending a new request to the AI model.
3. **Smooth Token Streaming:**
   * AI response streaming renders progressively with zero jumping, glitching, or layout flickering.
4. **Citation Verification:**
   * Clicking any inline citation pill (`[[src/app.ts:12-30]]`) opens the right-hand Code Inspector, scrolls to line 12, and highlights lines 12–30 with theme-aware blue tinting.