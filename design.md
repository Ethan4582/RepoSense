# UI Refinement Prompt — Match DeepWiki Layout Precisely

Analyze the two attached screenshots carefully before making any changes:

- **Reference image:** DeepWiki's documentation page.
- **Current image:** Our RepoSense wiki page.

Your task is to make our existing wiki UI match the reference as closely as possible in layout, proportions, spacing, typography, content hierarchy, and interaction behaviour, while retaining RepoSense's existing blue accent theme.

This is a precision UI refinement, not a redesign from scratch.

## 1. Match the Overall Layout

Replicate the reference's three-column documentation layout:

- **Left sidebar:** A narrow, independently scrollable navigation column with clear hierarchy between page groups, parent headings, and nested pages.
- **Main content:** A centered, readable documentation column with generous horizontal padding and consistent vertical rhythm.
- **Right sidebar:** A narrow table of contents aligned with the main content, with sufficient separation from the browser's right edge.

The reference uses substantial outer margins and whitespace. Our current layout feels stretched and crowded against the viewport edges.

Use the reference screenshot to establish the proportions. At a comparable desktop viewport, match the column widths, outer margins, gutters, and content alignment as closely as practical. Do not simply apply arbitrary padding or shrink the entire page.

The main content should have a readable maximum width rather than expanding across all available space. The left and right navigation areas must feel visually separate from the central documentation.

## 2. Rebuild the Documentation Hierarchy Visually

Our documentation content is already correct. Preserve its content, citations, links, source references, and functionality.

Improve its presentation to match the reference:

- Clear distinction between the page title, section headings, subheadings, paragraphs, lists, and inline code.
- Consistent heading sizes, font weights, line heights, and spacing.
- Nested navigation items indented according to their actual hierarchy.
- Consistent paragraph widths and vertical spacing.
- Clean, subtle source-reference chips and inline code styling.
- A compact, understated relevant-source-files disclosure.
- A right-side table of contents with clear hierarchy and subtle active-section indication.

Do not render every item as an equally weighted line of text. Respect the actual document structure and heading levels.

Avoid excessive borders, unnecessary metadata, oversized headings, decorative cards around ordinary content, and strong blue backgrounds. Use blue selectively for links, active navigation, and meaningful interactive states.

## 3. Sidebar Behaviour

The left sidebar should support the intended hidden-navigation experience.

- Keep the sidebar hidden when the user is reading the documentation, where appropriate.
- Reveal it through a subtle, discoverable control or the intended left-edge interaction.
- When revealed, preserve the main content's usability and avoid unwanted horizontal overflow.
- Keep nested pages readable, properly indented, and independently scrollable when necessary.
- Provide an obvious way to dismiss or collapse the sidebar.

The right table of contents should remain independently usable. Do not let either sidebar unnecessarily cover the central content or create multiple competing scrollbars.

## 4. Preserve the Chat Composer

Keep the existing bottom chat composer, but retain the cleaner, translucent treatment specified in our existing `design.md` and the previous reference screenshots.

It should be visually integrated with the documentation without obscuring important text. Preserve the existing multi-model selector so users can choose any configured, available model.

Remove unnecessary metadata from the composer. Preserve model selection, submission, loading states, follow-up questions, and existing RAG interactions.

## 5. Implementation Constraints

Before editing, inspect the current layout components, CSS, responsive breakpoints, sidebar state, documentation renderer, and existing `design.md`.

- Reuse the existing architecture and components where practical.
- Prefer targeted layout and styling changes over a wholesale rewrite.
- Do not modify backend logic, APIs, database schemas, indexing, RAG, or source-generation behaviour.
- Do not replace correct documentation content or remove existing functionality.
- Avoid adding dependencies unless absolutely necessary.
- Preserve the existing light/dark theme behaviour and blue accent palette.

## 6. Responsive Behaviour

Match the reference at desktop sizes first, then ensure the layout adapts sensibly to narrower screens.

On smaller screens, collapse navigation into accessible controls, prioritize the main documentation, and prevent horizontal overflow. Do not force desktop column widths onto mobile layouts.

## 7. Implementation and Verification

Implement the changes rather than only describing them.

After implementation:

1. Compare screenshots of the updated page against the reference at the same viewport dimensions.
2. Check outer margins, column widths, gutters, content width, typography, heading hierarchy, and vertical rhythm.
3. Verify sidebar opening, closing, scrolling, and nested navigation.
4. Verify the table of contents, source citations, code formatting, and relevant-source-files disclosure.
5. Verify the chat composer, configured model selection, submission, and loading behaviour.
6. Check dark mode and responsive layouts.
7. Confirm that backend and RAG functionality remain unchanged.

**Acceptance criterion:** The result should reproduce the reference's clean, spacious documentation layout and visual proportions as closely as possible, using RepoSense's own theme and preserving all existing functionality. Do not stop at superficial CSS changes; correct the underlying layout structure wherever necessary.