import { generateText } from 'ai';
import { getModel } from '~/lib/providers';
import type { ProviderId } from '~/lib/providers';
import { extractHeadings, type RepoSkeleton } from './chunker';

export interface WikiPlanPage {
  slug: string;
  title: string;
  pageOrder: number;
  relevantFiles: string[];
}

export interface WikiPlanSection {
  sectionTitle: string;
  sectionOrder: number;
  pages: WikiPlanPage[];
}

export interface WikiPlan {
  sections: WikiPlanSection[];
}

export interface WikiGenerationContext {
  projectName: string;
  repoUrl: string;
  skeleton: RepoSkeleton;
  files: Array<{ path: string; content: string }>;
  provider: ProviderId;
  model: string;
  apiKey: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
}

function compactSkeleton(skeleton: RepoSkeleton): string {
  const lines = skeleton.files.map((file) => {
    const exports = file.exports.slice(0, 10).map((e) => e.signature).join(' | ');
    const imports = file.imports.slice(0, 5).map((i) => i.statement).join(' | ');
    return [
      file.filePath,
      `lines=${file.lineCount}`,
      exports ? `exports=${exports}` : '',
      imports ? `imports=${imports}` : '',
    ]
      .filter(Boolean)
      .join(' :: ');
  });

  return lines.join('\n').slice(0, 28000);
}

function parseJsonPlan(raw: string): WikiPlan | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as WikiPlan;
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;

    const sections = parsed.sections
      .filter((section) => Array.isArray(section.pages) && section.pages.length > 0)
      .slice(0, 5)
      .map((section, sectionIndex) => ({
        sectionTitle: String(section.sectionTitle || `Section ${sectionIndex + 1}`),
        sectionOrder: sectionIndex + 1,
        pages: section.pages.slice(0, 6).map((page, pageIndex) => ({
          slug: slugify(String(page.slug || page.title || `page-${pageIndex + 1}`)),
          title: String(page.title || `Page ${pageIndex + 1}`),
          pageOrder: pageIndex + 1,
          relevantFiles: Array.isArray(page.relevantFiles)
            ? page.relevantFiles.map(String).slice(0, 12)
            : [],
        })),
      }));

    const totalPages = sections.reduce((sum, section) => sum + section.pages.length, 0);
    if (totalPages === 0) return null;

    return { sections };
  } catch {
    return null;
  }
}

export function fallbackPlan(skeleton: RepoSkeleton): WikiPlan {
  const filePaths = skeleton.files.map((file) => file.filePath);
  const readme = filePaths.find((path) => /^readme/i.test(path));
  const manifest = filePaths.find((path) => path.endsWith('package.json'));
  const entry =
    filePaths.find((path) => /^src\/server\/app\./.test(path)) ??
    filePaths.find((path) => /^src\/app\//.test(path)) ??
    filePaths.find((path) => /^src\//.test(path)) ??
    filePaths[0];

  const coreFiles = filePaths
    .filter((path) => /^(src|app|lib|server)\//.test(path))
    .slice(0, 8);

  return {
    sections: [
      {
        sectionTitle: 'Overview',
        sectionOrder: 1,
        pages: [
          {
            slug: 'overview',
            title: 'Overview',
            pageOrder: 1,
            relevantFiles: [readme, manifest, entry].filter(Boolean) as string[],
          },
          {
            slug: 'getting-started',
            title: 'Getting Started & Configuration',
            pageOrder: 2,
            relevantFiles: [readme, manifest, filePaths.find((p) => p.startsWith('src/env'))].filter(
              Boolean
            ) as string[],
          },
        ],
      },
      {
        sectionTitle: 'Core Architecture',
        sectionOrder: 2,
        pages: [
          {
            slug: 'architecture',
            title: 'System Architecture',
            pageOrder: 1,
            relevantFiles: coreFiles,
          },
          {
            slug: 'data-flow',
            title: 'Data Flow & Integrations',
            pageOrder: 2,
            relevantFiles: coreFiles.slice(0, 6),
          },
        ],
      },
      {
        sectionTitle: 'Reference',
        sectionOrder: 3,
        pages: [
          {
            slug: 'api-reference',
            title: 'API & Module Reference',
            pageOrder: 1,
            relevantFiles: coreFiles,
          },
        ],
      },
    ],
  };
}

export async function planWiki(context: WikiGenerationContext): Promise<WikiPlan> {
  const readme = context.files.find((file) => /^readme/i.test(file.path));
  const manifest = context.files.find(
    (file) => file.path.endsWith('package.json') || file.path.endsWith('pyproject.toml')
  );

  const prompt = `You are a senior software architect planning a DeepWiki documentation site for the repository ${context.projectName}.

Return ONLY valid JSON, no prose, no markdown fences. The shape must be:
{
  "sections": [
    {
      "sectionTitle": "Overview",
      "sectionOrder": 1,
      "pages": [
        { "slug": "overview", "title": "Overview", "pageOrder": 1, "relevantFiles": ["README.md", "package.json"] }
      ]
    }
  ]
}

Rules:
- 3 to 5 sections, 6 to 12 total pages.
- Always start with section "Overview" and page "overview" titled "Overview".
- Slugs must be lowercase kebab-case and globally unique.
- relevantFiles must be exact paths from the repository skeleton below.
- Tailor sections to this repository's real architecture (do not copy generic headings blindly).

REPOSITORY SKELETON:
${compactSkeleton(context.skeleton)}

README (truncated):
${readme?.content.slice(0, 8000) ?? 'No README found.'}

MANIFEST (truncated):
${manifest?.content.slice(0, 4000) ?? 'No manifest found.'}`;

  const { text } = await generateText({
    model: getModel(context.provider, context.model, context.apiKey) as never,
    prompt,
    temperature: 0.2,
  });

  const plan = parseJsonPlan(text);
  if (!plan) return fallbackPlan(context.skeleton);

  const seen = new Set<string>();
  const sections = plan.sections.map((section) => ({
    ...section,
    pages: section.pages
      .map((page) => {
        let slug = page.slug;
        let suffix = 2;
        while (seen.has(slug)) {
          slug = `${page.slug}-${suffix}`;
          suffix += 1;
        }
        seen.add(slug);
        return { ...page, slug };
      })
      .map((page, index) => ({ ...page, pageOrder: index + 1 })),
  }));

  const totalPages = sections.reduce((sum, section) => sum + section.pages.length, 0);
  return totalPages >= 3 ? { sections } : fallbackPlan(context.skeleton);
}

export interface GeneratedWikiPage {
  slug: string;
  title: string;
  sectionTitle: string;
  sectionOrder: number;
  pageOrder: number;
  content: string;
  relevantFiles: string[];
  headings: Array<{ id: string; text: string; level: number }>;
}

const PAGE_SYSTEM_PROMPT = `You are writing a chapter of a DeepWiki documentation site.

Requirements:
- Write comprehensive, senior-level architectural documentation in clean Markdown.
- Start with a level-1 heading matching the page title.
- Include 1 to 3 valid Mermaid.js diagrams using \`\`\`mermaid fences (flowchart TD, sequenceDiagram, classDiagram, or erDiagram).
- Include structured Markdown comparison/summary tables where appropriate.
- MANDATORY inline source citations: every technical claim, class reference, or architectural explanation MUST cite the exact source file and line range using [[path/to/file.ext:startLine-endLine]].
- Only cite files and lines that appear in the supplied source context.
- Do not invent APIs, files, or behavior.`;

export async function generateWikiPage(opts: {
  context: WikiGenerationContext;
  plan: WikiPlan;
  page: WikiPlanPage;
  sectionTitle: string;
  sectionOrder: number;
}): Promise<GeneratedWikiPage> {
  const { context, page, sectionTitle, sectionOrder } = opts;
  const relevant = page.relevantFiles.length > 0 ? page.relevantFiles : context.files.slice(0, 5).map((f) => f.path);
  const fileMap = new Map(context.files.map((file) => [file.path, file.content]));

  let sourceContext = '';
  let used = 0;
  for (const path of relevant) {
    const content = fileMap.get(path);
    if (!content) continue;
    const slice = content.slice(0, 14000);
    if (used + slice.length > 60000) break;
    sourceContext += `\n\n===== FILE: ${path} =====\n${slice}`;
    used += slice.length;
  }

  const siblings = opts.plan.sections
    .flatMap((section) =>
      section.pages.map((p) => `${section.sectionTitle} > ${p.title} (${p.slug})`)
    )
    .join('\n');

  const prompt = `Repository: ${context.projectName} (${context.repoUrl})
Section: ${sectionTitle}
Page: ${page.title} (${page.slug})

WIKI OUTLINE:
${siblings}

REPOSITORY SKELETON (file paths, exports, imports):
${compactSkeleton(context.skeleton)}

SOURCE CONTEXT:
${sourceContext || 'No source files could be loaded. Document based on the skeleton only.'}

Write the full Markdown article for "${page.title}".`;

  const { text } = await generateText({
    model: getModel(context.provider, context.model, context.apiKey) as never,
    system: PAGE_SYSTEM_PROMPT,
    prompt,
    temperature: 0.25,
  });

  return {
    slug: page.slug,
    title: page.title,
    sectionTitle,
    sectionOrder,
    pageOrder: page.pageOrder,
    content: text,
    relevantFiles: relevant,
    headings: extractHeadings(text),
  };
}
