Refine the RepoSense wiki layout and navigation to match the reference layout in the attached screenshot, and improve the backend navigation generation for repositories of any size.

Frontend changes:
1. Add a symmetric outer frame with 77px margins on both sides. Draw the frame edges as 1px dashed hairlines at low opacity. Add a dashed hairline under the header across the full frame width.
2. Make the header 96px to 100px tall. Brand on the left: "RepoSense" in medium weight, followed by the repo name in regular weight and muted color, both about 20px. Actions on the right: outlined "Edit Wiki", outlined "Pull Requests", filled "Share" in the accent color, and a theme toggle. Buttons 36px tall, 8px radius.
3. Remove all solid vertical column dividers. Separate columns with spacing only. The right "On this page" panel must have no border, no card, and no left line.
4. Left navigation column: 300px to 320px wide, 28px horizontal padding. Group headings 15px semibold, not uppercase, 20px spacing above each group. Child items 15px regular at about 70 percent text opacity, 8px vertical padding, 16px indent per nesting level. Support three levels. Long titles wrap to two lines and do not truncate. Active item uses a subtle tinted background with a 2px accent bar on the left, not a filled box. The "Last edited" label is 12px, muted, not uppercase. The list scrolls independently with a thin scrollbar.
5. Main content column: 880px to 920px max width, centered between the left nav and right panel with 48px to 64px empty gutters on each side. Body text 17px with 1.7 line-height. Page title 30px bold. H3 22px semibold. Bold bullet lead-ins are semibold. The "Relevant source files" bar uses a 1px low-opacity border, 14px text, and a small count chip.
6. Citation chips: two segments, a GitHub icon with the file path in monospace 13px, followed by a line range segment with a separate background. Citation links are regular weight, with underline on hover only.
7. Right "On this page" panel: 280px to 300px wide, 24px inner padding, sticky below the header. Heading 20px bold. Items 15px, muted, 14px spacing between items, 14px indent per nesting level. Active item is shown with brighter text and a small accent bar, with no background box. Use IntersectionObserver to update the active item as the user scrolls. Omit the "Refresh this wiki" card.
8. Accent color: use the blue only on the Share button, citation links, and the active nav indicator. Use a slightly desaturated blue: #2563eb in light mode and #3b82f6 at 90 percent saturation in dark mode. All other UI uses neutral grays.
9. Chat input: constrain its width to the main content column, float it with a soft shadow, and add bottom padding to the scroll area equal to the input height plus 24px so no text is hidden behind it. Reduce the model pill border contrast and remove the bright blue icon.
10. Ensure both columns and the frame scale down with clamp() values and never leave an empty band below 1440px viewport width. Below 1100px, hide the right panel. Below 768px, the left nav becomes an overlay drawer.

Backend changes:
1. Classify each repository as small (under 50 source files), medium (50 to 500), or large (over 500). Generate 1 to 2 groups for small, 3 to 6 for medium, and 6 to 10 for large. Add sub-pages only when a page covers more than roughly 800 lines or two distinct subsystems.
2. Build groups from domains, not raw directories. Merge related directories that share a responsibility, for example routes and middleware into an "HTTP Transport" group. Use names from code symbols, README headings, and package names. Never use raw folder names or generic labels such as "Module 1" or "Misc".
3. Always place "Overview" first as a single page. Add "Getting Started" or "Setup and Usage" when a README or install script exists.
4. Order groups by reader need: entry points and overview, core domain logic, interfaces (API, UI, CLI), data and persistence, infrastructure and tooling, and legacy code last.
5. Give each group a one-sentence description stored in the navigation JSON.
6. Page titles: title case, 2 to 6 words, maximum 60 characters, specific rather than generic.
7. Store the navigation as JSON per commit with this shape: generatedFrom, groups, each with id, title, description, and pages, each page with id, title, and children. Keep page IDs stable across re-indexes when titles change only slightly.
8. Regenerate the navigation only when the file tree changes by more than 10 percent. Otherwise reuse the cached structure.
9. For the right panel, parse the page's Markdown for H2 and H3 headings only. Generate stable slugs with numeric suffixes on collision. Build a nested tree where H3 items sit under the nearest preceding H2. Return it as { items: [{ id, title, level, children }] }. Omit the panel when the page has fewer than two headings.
10. The same repository and commit must always produce identical navigation. Do not compute navigation at request time from unstable inputs. Do not render empty expanders.

Acceptance:
- Layout matches the reference screenshot in spacing, dividers, text sizes, and column widths.
- No solid vertical lines remain between columns.
- A single-file repository shows a minimal navigation. A large monorepo shows grouped, nested navigation with descriptive titles.
- The right panel highlights the section in view while scrolling.
- Light and dark modes both follow the neutral palette with minimal accent blue.