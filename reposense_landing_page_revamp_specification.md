# RepoSense — Landing Page Design Specification (`design.md`)

This document is the authoritative frontend specification for **Anti-Gravity / Claude CLI** to build the revamped RepoSense landing page. It adapts the structural, typographic, and interactive patterns from the reference inspirations into a cohesive 3-section experience (**Hero Section**, **3-Card Features Section**, and **Interactive Folder-Brick Footer**) unified under RepoSense's signature `#126dfb` electric blue palette.

---

## 0. Design Tokens & Color Palette (Adapted to `#126dfb`)

Instead of warm beige/sepia tones, all surfaces, borders, and accents are calibrated to crisp, cool blue-tinted whites and RepoSense's `#126dfb` primary brand blue.

### Color Tokens
| Token | Hex / Value | Usage |
|---|---|---|
| `--primary` | `#126dfb` | Primary brand blue, primary pill buttons, active badges, interactive highlights, and footer folder-brick accents |
| `--primary-hover` | `#0e58cc` | Hover state for `#126dfb` primary pill buttons |
| `--primary-soft` | `#eef4ff` | Subtle light-blue tint for active tab pills, badges, and frosted accents |
| `--surface` | `#f8fafc` | Main page background (crisp, cool off-white paper) |
| `--surface-elevated` | `#ffffff` | Hero screenshot frames, inner feature mockup tiles, and navbar surface |
| `--card-muted` | `#f1f5f9` | Soft cool-gray fill for the 3 bento feature cards |
| `--ink-primary` | `#0f172a` | Primary headlines (`h1`, `h2`, `h3`) and active navigation text |
| `--ink-secondary` | `#64748b` | Supporting body paragraphs, card descriptions, and footer links |
| `--border-hairline` | `#e2e8f0` | 1px subtle borders on screenshot frames, cards, and ghost tiles |
| `--folder-blue` | `linear-gradient(180deg, #60a5fa 0%, #126dfb 100%)` | Translucent frosted blue matching the custom 3D folder icon asset |

### Typography Scale
- **Hero Headline (`display-sans`):** Neutral grotesque sans (`Inter` / `Geist`), `clamp(2.5rem, 4.5vw, 3.5rem)` (`40px–56px`), `font-weight: 500`, tight tracking (`-0.03em`), line-height `1.1`, sentence case.
- **Features Headline (`display-serif`):** Refined editorial serif (`Instrument Serif` / `Playfair Display` / `Newsreader`), `clamp(2.25rem, 3.8vw, 3rem)` (`36px–48px`), `font-weight: 400`, line-height `1.15`, centered across two lines.
- **Body Copy (`body-sm`):** `14px–16px`, `line-height: 1.5`, color `--ink-secondary` (`#64748b`), max-width `42ch`.
- **Card Titles (`label`):** `15px`, `font-weight: 600`, color `--ink-primary` (`#0f172a`), line-height `1.4`.
- **Card Descriptions (`caption`):** `13px`, `font-weight: 400`, color `--ink-secondary` (`#64748b`), line-height `1.5`.
- **Navbar & Pill Buttons (`button`):** `13px–14px`, `font-weight: 500`, line-height `1.2`.

### Radii & Spacing
- **Radii:** `md: 10px`, `lg: 16px`, `xl: 20px`, `pill: 9999px`.
- **Spacing Scale:** `xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 48px`, `xxl: 96px`.

---

## 1. Top Navigation Bar (Sticky, Minimal)

### Layout & Structure
- **Height:** Compact (`60px`), sticky/fixed at top with subtle `backdrop-filter: blur(12px)` and `background: rgba(248, 250, 252, 0.85)`.
- **Left Group (Brand):**
  - RepoSense logo icon (in `#126dfb` blue) + `"RepoSense"` wordmark (`font-weight: 600`, `#0f172a`).
- **Center Group (3 Navigation Links):**
  1. **`Example Wikis`** (or `Public Wikis`) → Routes directly to `/explore` (the directory of all public repositories already converted into DeepWiki documentation).
  2. **`Docs`** → External/internal link routing directly to the RepoSense GitHub documentation explaining how RepoSense is architected and built.
  3. **`Features`** → Smooth-scroll anchor link (`#features`) that scrolls directly down to the Features section.
- **Right Group (Actions):**
  1. **`GitHub` Button:** Subtle pill/icon button with the GitHub mark that routes directly to the RepoSense project GitHub repository.
  2. **Auth Button (`Login` / `Logout`):**
     - When unauthenticated: **`Login`** pill button (solid `#126dfb` primary blue background, white text, `border-radius: 9999px`) routing to Clerk sign-in / dashboard.
     - When authenticated: **`Dashboard`** link + **`Logout`** pill button (`border: 1px solid #e2e8f0`, `#0f172a` text).

---

## 2. Section 1 — Hero Section (Minimal Text + Public Wiki Showcase)

### Visual Composition (Inspired by Reference Images 2 & 3)
- **Upper Viewport (Static Text Block):**
  - Clean, minimal text block (either left-aligned at ~8% inset like Reference 2 or centered with a switchable surface tab bar above the preview frame like Reference 3).
  - **Two-Line Headline:** Concise, high-signal value proposition (e.g., *"Turn any GitHub repository into a living DeepWiki."*).
  - **Supporting Subline:** 2-line muted gray description (`#64748b`, max `44ch`) explaining 100% BYOK architecture diagrams, line-numbered citations, and interactive codebase Q&A.
  - **CTA Row:**
    - Primary Pill CTA: **`Get Started`** (or **`Convert a Repo`**) in solid `#126dfb` blue (`hover: #0e58cc`, white text, `px-6 py-2.5 rounded-full shadow-sm`).
    - Secondary Pill CTA: **`Explore Public Wikis`** in crisp white (`bg-white border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f1f5f9] px-6 py-2.5 rounded-full`).
- **Lower ~60% of Viewport (Product Wiki Showcase Stage):**
  - Directly below the CTA row (with generous whitespace separation of `48px–64px`), display the high-resolution **Hero Wiki Preview Image** served directly from the `public/` directory (showing an example converted DeepWiki documentation page with its left chapter tree, Mermaid architecture diagram, and split-pane code citations).
  - **Window Frame Styling:** Wrap the `public/` wiki screenshot inside a clean browser/macOS-style elevated window frame (`bg-white`, `rounded-2xl`, `border: 1px solid #e2e8f0`, soft blue-tinted elevation shadow `0 24px 60px -15px rgba(18, 109, 251, 0.12)`), flanked by subtle frosted/blurred ghost tiles (`backdrop-filter: blur(8px)`) in the background.
  - **Entrance Motion:** Keep the headline and CTAs immediately stable on load; animate the Wiki preview container rising smoothly into view (`translateY(24px) -> translateY(0)`, `opacity: 0 -> 1`, duration `700ms`, `cubic-bezier(0.16, 1, 0.3, 1)`).

---

## 3. Section 2 — Features Section (`#features` — 3 Minimal Bento Cards)

### Visual Composition (Inspired by Reference Image 6)
- **Header Block (Centered):**
  - Generous top padding (`96px`).
  - **Two-Line Serif Headline:** Refined serif font in `#0f172a` (e.g., *"A codebase library that gets clearer every time you index."*).
  - **Muted One-Line Subline:** Small sans-serif subtitle in `#64748b` directly beneath (`"100% Bring Your Own Key. Instant architecture diagrams. Built to stay out of your way."`).
- **3-Column Bento Grid:**
  - Container: `max-width: 1120px`, `margin: 48px auto 0`, `display: grid`, `grid-template-columns: repeat(3, 1fr)`, `gap: 20px` (collapses to 1 column on mobile).
  - **Strictly 3 Cards Total** (single row of 3 square-ish cards, `border-radius: 16px`, background `--card-muted` `#f1f5f9`, `padding: 28px`, `display: flex`, `flex-direction: column`, `min-height: 340px`).
  - Each card features a centered schematic UI miniature in the top ~65% of the card (using crisp white `--surface-elevated` tiles, subtle `1px solid #e2e8f0` borders, soft shadows, and `#126dfb` blue accent chips) and left-aligned title + 2-line description pinned to the bottom (`margin-top: auto`):

  1. **Card 1 — Auto-Generated DeepWikis:**
     - *Top Miniature Mockup:* Clean floating key/command chips (`⌘` `K` `Wiki`) or a mini chapter card with a `#126dfb` blue badge.
     - *Bottom Copy:*
       - **Title:** `Living Architecture Wikis`
       - **Description:** `Convert raw repositories into multi-page documentation with interactive Mermaid diagrams.`
  2. **Card 2 — Line-Numbered Code Q&A:**
     - *Top Miniature Mockup:* Stacked white article preview card with a `#126dfb` blue citation pill (`src/app.ts:17-24`) and a `> Scanning` tag.
     - *Bottom Copy:*
       - **Title:** `Line-Exact Code Inspector`
       - **Description:** `Ask deep architectural questions with clickable source citations and split-pane file previews.`
  3. **Card 3 — Multi-Model BYOK Vault:**
     - *Top Miniature Mockup:* Cluster of rounded white pill tags featuring provider icons (`OpenAI`, `Claude`, `Gemini`, `DeepSeek`, `Groq`, `Meta`) with `#126dfb` status dots.
     - *Bottom Copy:*
       - **Title:** `Bring Your Own Key`
       - **Description:** `Plug in OpenAI, Anthropic, Gemini, Meta, DeepSeek, xAI, or Groq with zero server markup.`

---

## 4. Section 3 — Footer Section (4 Link Columns + `"reposense"` Folder-Brick Wordmark)

### Visual Composition (Inspired by Reference Images 4 & 5)
- **Surface & Spacing:** Full viewport width on `--surface` (`#f8fafc`) with generous top breathing room (`96px–120px` above the columns and `64px` between the columns and the giant wordmark).
- **Top 4-Column Link Grid (`max-width: 1120px`, `grid-template-columns: repeat(4, 1fr)`):**
  - Small, clean sans-serif typography (`13px–14px`), lowercase or sentence-case headings in `#0f172a` (`font-weight: 600`) with muted link rows (`#64748b`, `hover: #126dfb`):
  1. **`product`**: `example wikis` (`/explore`), `features` (`#features`), `create wiki` (`/create`), `pull requests` (`/pulls`)
  2. **`resources`**: `docs` (GitHub Docs), `github repo`, `models & pricing`, `privacy`
  3. **`connect`**: `github`, `x (twitter)`, `linkedin`, `youtube`
  4. **`byok notice`** (Disclaimer column): *"*reposense runs 100% on your own encrypted API keys — your keys and private code are never sold or shared."*
- **Giant Interactive `"reposense"` Folder-Brick Wordmark Row:**
  - Directly replaces the `"heyclicky"` text from the reference image with **`reposense`** spelled out in lowercase across the full width of the footer.
  - **Tile Construction:** Each pixel/brick of the `"reposense"` letterforms is rendered using the **custom 3D translucent blue folder icon** (Reference Image 5, stored in `public/`), tinted in RepoSense's signature blue palette (`#60a5fa` top tab to `#126dfb` frosted body).
  - **Flanking Desktop Icons:**
    - **Left side:** Small macOS-style trash/archive icon on the far left margin.
    - **Right side:** A larger standalone **3D Blue Folder Icon** (using the exact folder image from `public/` shown in Reference Image 5) positioned to the upper-right of the `"reposense"` wordmark.
  - **Interactive Hover Physics:**
    - Moving the cursor across the `"reposense"` folder-brick wordmark applies a snappy spring displacement (`translateY`, `translateX`, and slight `rotate`) to individual folder bricks near the pointer, which smoothly resettle back into the letter grid when the cursor leaves.
- **Bottom Legal Caption:**
  - Centered small muted text (`12px`, `#94a3b8`) at the very bottom: `© RepoSense 2026. Built with Cloudflare Workers.`