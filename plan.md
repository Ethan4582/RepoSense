# Implementation Plan: T3 Code Main Chat & Adaptive Right Surface

---

## 1. Top Header Bar
- **Breadcrumb:** `[Logo] RepoSense / [Repository Name]` (no "main" branch label).
- **Actions:**
  - `[🔀 Pull Requests]`: Direct router push to `/pull-requests`.
  - `[📁 5 Reference Files ▾]`: Dropdown showing the 5 files used for the latest question. Updates dynamically per prompt. Clicking any file opens it immediately in the Right Surface.
  - `[◨ Toggle Surface]`: Expands or collapses the Right Surface pane.

---

## 2. Main Chat Surface (Streamed & Cardless)
- **Zero Box Containers:** Remove outer card wrappers, inner scrollboxes, and robotic "You Agent" headers.
- **User Messages:** Clean right-aligned dark bubble (T3 Code style).
- **AI Response:** Raw streamed markdown text rendering directly on the canvas in real-time.
- **Subtle Footnote:** At the bottom of each AI response:
  > *"All reference files are in the right column."* (with a click trigger to open the right pane).

---

## 3. Adaptable Floating Composer (Glassmorphism)
- **Auto-Expanding Height:** Textarea expands upward as user types multi-line prompts (with a max-height cap and smooth internal scroll).
- **T3 Backdrop Blur Effect:** Floating bottom container with `backdrop-blur-md bg-zinc-950/80 border border-zinc-800/60`. Chat messages smoothly blur underneath while scrolling.
- **Controls Inside:**
  - Mode toggle: `[RAG (5 Files)]` / `[Simple Chat]`
  - Model selector pill: `[DeepSeek V3 ▾]`
  - `Get Tips 💡` button
  - Circular Send/Stop button

---

## 4. Adaptive Right Surface Pane

### State A: Idle / Before Question Asked (or Surface Open)
Clean launcher view with only:
- `🔀 Pull Requests` (routes directly to PR page)
- `📁 Browse Repository Files`
  - `file1.tsx`
  - `file2.tsx`
  - `file3.tsx`
  - `file4.tsx`
  - `file5.tsx`

### State B: When a Specific File is Clicked (e.g. `org.ts`)
Only opens that single clicked file in full view:
- **Header:** File name (`org.ts`), `Copy Code`, `Open on GitHub ↗`, and `[✕ Close]`.
- **Two Sub-Tabs:**
  1. **`[📁 Source Code]`**: Syntax-highlighted code with line numbers.
  2. **`[💡 Layman Summary]`**: Plain-English explanation of what this file does and why it was referenced.
- **Responsive Layout:** When the right surface opens, the main chat smoothly compresses to 50–55% width, maintaining full responsiveness.

---

## 5. Files to Update / Create
1. `src/app/(protected)/dashboard/page.tsx` & `src/components/chat/chat-view.tsx`
   - Remove nested card boxes, apply cardless markdown stream, and integrate the floating blur composer.
2. `src/components/chat/right-surface.tsx` (New/Refactored)
   - Implement the idle state (`Pull Requests`, `Browse Repository Files` list) and single-file inspection state with `[Source Code]` / `[Layman Summary]` tabs.
3. `src/components/chat/composer-bar.tsx`
   - Auto-growing textarea with T3 backdrop blur styling.
4. `src/components/chat/chat-header.tsx`
   - Clean header with `[🔀 Pull Requests]` route button and dynamic `[📁 5 Reference Files]` pill.