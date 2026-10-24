import { generateText } from 'ai';
import { getModel } from '~/lib/providers';
import type { ProviderId } from '~/lib/providers';
import { extractHeadings, type RepoSkeleton } from './chunker';
import { formatArchitectureBrief, type RepoArchitecture } from './repo-normalizer';
import { determineRepoScale, DynamicWikiPlanSchema, type RepoScale } from './wiki/planner';

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
  branch: string;
  branchKind: 'MAIN' | 'BRANCH' | 'PULL_REQUEST';
  pullRequestNumber?: number | null;
  skeleton: RepoSkeleton;
  architecture: RepoArchitecture;
  files: Array<{ path: string; content: string }>;
  provider: ProviderId;
  model: string;
  apiKey: string;
}

interface RequiredPage {
  slug: string;
  title: string;
  sectionTitle: string;
  relevantFiles: string[];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'page'
  );
}

function uniqueFiles(values: Array<string | null | undefined>, limit = 12): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).slice(
    0,
    limit
  );
}

function layerFiles(architecture: RepoArchitecture, key: RepoArchitecture['layers'][number]['key']): string[] {
  return architecture.layers.find((layer) => layer.key === key)?.files ?? [];
}

function requiredPages(architecture: RepoArchitecture): RequiredPage[] {
  const entry = layerFiles(architecture, 'entry');
  const core = layerFiles(architecture, 'core');
  const integrations = layerFiles(architecture, 'integrations');
  const data = layerFiles(architecture, 'data');
  const utilities = layerFiles(architecture, 'utilities');
  const readme = architecture.readme.path;

  const pages: RequiredPage[] = [
    {
      slug: 'overview',
      title: `${architecture.primaryLanguage} System Overview`,
      sectionTitle: architecture.layers[0]?.title ?? 'Repository Runtime',
      relevantFiles: uniqueFiles([readme, ...architecture.manifests, ...entry, ...core]),
    },
    {
      slug: 'architecture',
      title: 'System Architecture',
      sectionTitle: architecture.layers[0]?.title ?? 'Repository Runtime',
      relevantFiles: uniqueFiles([...entry, ...core, ...data, ...integrations, ...architecture.manifests]),
    },
    {
      slug: 'runtime-lifecycle',
      title: 'Runtime Execution & Request Lifecycle',
      sectionTitle: architecture.layers[0]?.title ?? 'Repository Runtime',
      relevantFiles: uniqueFiles([...entry, ...core, ...integrations]),
    },
    {
      slug: 'data-flow',
      title: 'Data Flow & Storage',
      sectionTitle: architecture.layers.find((layer) => layer.key === 'data')?.title ?? 'Persistence and State',
      relevantFiles: uniqueFiles([...data, ...core, ...integrations]),
    },
    {
      slug: 'setup-workflow',
      title: 'Setup, Scripts & Developer Workflow',
      sectionTitle: architecture.layers.find((layer) => layer.key === 'utilities')?.title ?? 'Tooling and Operations',
      relevantFiles: uniqueFiles([readme, ...architecture.manifests, ...entry, ...utilities]),
    },
  ];

  if (core.length > 0) {
    pages.push({
      slug: 'core-logic',
      title: 'Core Business Logic & State',
      sectionTitle: architecture.layers.find((layer) => layer.key === 'core')?.title ?? 'Domain Logic',
      relevantFiles: uniqueFiles(core),
    });
  }

  if (integrations.length > 0 || data.length > 0) {
    pages.push({
      slug: 'external-services',
      title: 'External Services, Data & Adapters',
      sectionTitle: architecture.layers.find((layer) => layer.key === 'integrations')?.title ?? 'External Integrations',
      relevantFiles: uniqueFiles([...integrations, ...data]),
    });
  }

  return pages;
}

function compactSkeleton(skeleton: RepoSkeleton): string {
  const lines = skeleton.files.map((file) => {
    const exports = file.exports.slice(0, 10).map((entry) => entry.signature).join(' | ');
    const imports = file.imports.slice(0, 5).map((entry) => entry.statement).join(' | ');
    return [
      file.filePath,
      `lines=${file.lineCount}`,
      exports ? `exports=${exports}` : '',
      imports ? `imports=${imports}` : '',
    ]
      .filter(Boolean)
      .join(' :: ');
  });

  return lines.join('\n').slice(0, 36000);
}

function withLineNumbers(content: string, offset = 0): string {
  return content
    .split('\n')
    .map((line, index) => `${offset + index + 1} | ${line}`)
    .join('\n');
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

function legacyFallbackPlan(skeleton: RepoSkeleton): WikiPlan {
  const filePaths = skeleton.files.map((file) => file.filePath);
  const readme = filePaths.find((path) => /^readme/i.test(path));
  const manifest = filePaths.find((path) => /(^|\/)(package\.json|pyproject\.toml|go\.mod|cargo\.toml)$/i.test(path));
  const entry =
    filePaths.find((path) => /(^|\/)(main|index|app|server|cli|manage)\./i.test(path)) ??
    filePaths[0];

  const coreFiles = filePaths.slice(0, 8);

  const domain = (skeleton.directories.find((directory) => directory !== '.') ?? 'Repository').split('/').pop() ?? 'Repository';
  return {
    sections: [
      {
        sectionTitle: domain,
        sectionOrder: 1,
        pages: [
          {
            slug: 'overview',
            title: `${domain} System Overview`,
            pageOrder: 1,
            relevantFiles: [readme, manifest, entry].filter(Boolean) as string[],
          },
        ],
      },
      {
        sectionTitle: `${domain} Runtime`,
        sectionOrder: 2,
        pages: [
          {
            slug: 'architecture',
            title: `${domain} Components`,
            pageOrder: 1,
            relevantFiles: coreFiles,
          },
          {
            slug: 'runtime-lifecycle',
            title: `${domain} Execution Lifecycle`,
            pageOrder: 2,
            relevantFiles: coreFiles.slice(0, 6),
          },
          {
            slug: 'data-flow',
            title: `${domain} State and Data Model`,
            pageOrder: 3,
            relevantFiles: coreFiles.slice(0, 6),
          },
        ],
      },
      {
        sectionTitle: 'Tooling and Operations',
        sectionOrder: 3,
        pages: [
          {
            slug: 'setup-workflow',
            title: 'Build Commands and Operational Entry Points',
            pageOrder: 1,
            relevantFiles: [readme, manifest].filter(Boolean) as string[],
          },
        ],
      },
    ],
  };
}

export function fallbackPlan(
  skeleton: RepoSkeleton,
  architecture?: RepoArchitecture
): WikiPlan {
  if (!architecture) return legacyFallbackPlan(skeleton);

  const pages = requiredPages(architecture);
  const grouped = new Map<string, WikiPlanPage[]>();

  for (const page of pages) {
    if (page.relevantFiles.length === 0 && !['overview', 'architecture', 'runtime-lifecycle', 'data-flow', 'setup-workflow'].includes(page.slug)) {
      continue;
    }
    const list = grouped.get(page.sectionTitle) ?? [];
    list.push({
      slug: page.slug,
      title: page.title,
      pageOrder: list.length + 1,
      relevantFiles: page.relevantFiles,
    });
    grouped.set(page.sectionTitle, list);
  }

  const preferredOrder = ['Overview', 'System Architecture', 'Deep Dives', 'Development Workflow'];
  const sections = Array.from(grouped.entries())
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a[0]);
      const bIndex = preferredOrder.indexOf(b[0]);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    })
    .map(([sectionTitle, sectionPages], index) => ({
      sectionTitle,
      sectionOrder: index + 1,
      pages: sectionPages,
    }));

  return sections.length > 0 ? { sections } : legacyFallbackPlan(skeleton);
}

export function ensureBlueprint(plan: WikiPlan, architecture: RepoArchitecture): WikiPlan {
  const sections = plan.sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({ ...page })),
  }));
  const existing = new Map<string, WikiPlanPage>();
  for (const section of sections) {
    for (const page of section.pages) existing.set(page.slug, page);
  }

  return {
    sections: sections
      .filter((section) => section.pages.length > 0)
      .map((section, sectionIndex) => ({
        ...section,
        sectionOrder: sectionIndex + 1,
        pages: section.pages.map((page, pageIndex) => ({
          ...page,
          pageOrder: pageIndex + 1,
        })),
      })),
  };
}

function branchDescription(context: WikiGenerationContext): string {
  if (context.branchKind === 'PULL_REQUEST') {
    return `pull request${context.pullRequestNumber ? ` #${context.pullRequestNumber}` : ''} branch "${context.branch}"`;
  }
  return context.branchKind === 'MAIN'
    ? `main/default branch "${context.branch}"`
    : `branch "${context.branch}"`;
}

export async function planWiki(context: WikiGenerationContext): Promise<WikiPlan> {
  const readme = context.files.find((file) => /^readme/i.test(file.path));
  const manifest = context.files.find((file) =>
    /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|gemfile|composer\.json)$/i.test(
      file.path
    )
  );

  const fileCount = context.skeleton.files.length;
  const approxLoc = context.files.reduce((sum, f) => sum + (f.content ? f.content.split('\n').length : 0), 0);
  const repoScale = determineRepoScale(fileCount, approxLoc);

  const limits: Record<RepoScale, { minSec: number; maxSec: number; minPages: number }> = {
    COMPACT:    { minSec: 3,  maxSec: 4,  minPages: 1 },
    SUB_MEDIUM: { minSec: 5,  maxSec: 7,  minPages: 2 },
    MEDIUM:     { minSec: 8,  maxSec: 11, minPages: 2 },
    LARGE:      { minSec: 12, maxSec: 18, minPages: 2 },
  };
  const cfg = limits[repoScale];
  const groupRange = `${cfg.minSec} to ${cfg.maxSec} sections (minimum ${cfg.minPages} subpages each)`;

  const prompt = `You are a senior software architect planning a DeepWiki documentation site for ${context.projectName}, specifically the ${branchDescription(context)}.

This repository is classified as ${repoScale} (${fileCount} source files, ~${approxLoc} lines of code).
You MUST generate between ${cfg.minSec} and ${cfg.maxSec} sections, each containing at least ${cfg.minPages} subpages.

Return ONLY valid JSON, no prose, no markdown fences. The shape must be:
{
  "repoScale": "${repoScale}",
  "sections": [
    {
      "sectionTitle": "Emergent domain module, e.g. Authentication & Session Boundary",
      "description": "System introduction, core value proposition, and entry points.",
      "sectionOrder": 1,
      "pages": [
        {
          "slug": "jwt-auth-guards",
          "title": "JWT Verification & RBAC Guards",
          "description": "Token issuance, refresh lifecycle, and role guards.",
          "targetFilePaths": ["src/lib/auth.ts"],
          "focusSymbols": ["verifyToken", "requireAuth"]
        }
      ]
    }
  ]
}

Rules:
- Generate ${groupRange} based on the repository scale.
- CRITICAL: Page titles CANNOT duplicate their parent section title. Subpages must represent concrete subsystems.
- Always place "Overview" or introductory domain section first.
- Build groups from domains, not raw directories. Merge related directories that share a responsibility.
- Slugs must be lowercase kebab-case and globally unique.
- targetFilePaths must be exact paths from the repository skeleton.
- Tailor sections to this repository's real architecture.
- Describe only behavior present on ${branchDescription(context)}.

NORMALIZED REPOSITORY PROFILE:
${formatArchitectureBrief(context.architecture).slice(0, 12000)}

REPOSITORY SKELETON:
${compactSkeleton(context.skeleton)}

README (truncated):
${readme?.content.slice(0, 12000) ?? 'No README found. Synthesize intent from manifests, entrypoints, and exports.'}

MANIFEST (truncated):
${manifest?.content.slice(0, 6000) ?? 'No manifest found. Infer setup from file structure and scripts.'}`;

  const { text } = await generateText({
    model: getModel(context.provider, context.model, context.apiKey) as never,
    prompt,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(90_000),
  });

  let rawJson: unknown = null;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    rawJson = JSON.parse(cleaned);
  } catch {
    rawJson = parseJsonPlan(text);
  }

  let validatedPlan: WikiPlan | null = null;
  if (rawJson && typeof rawJson === 'object') {
    const withScale = { ...(rawJson as object), repoScale: (rawJson as { repoScale?: string }).repoScale ?? repoScale };
    const result = DynamicWikiPlanSchema.safeParse(withScale);
    if (result.success) {
      validatedPlan = {
        sections: result.data.sections.map((sec, secIdx) => ({
          sectionTitle: sec.sectionTitle,
          sectionOrder: secIdx + 1,
          pages: sec.pages.map((p, pIdx) => ({
            slug: p.slug,
            title: p.title,
            pageOrder: pIdx + 1,
            relevantFiles: p.targetFilePaths,
          })),
        })),
      };
    }
  }

  const parsed = validatedPlan ?? parseJsonPlan(text);
  const plan = parsed ?? fallbackPlan(context.skeleton, context.architecture);

  const seen = new Set<string>();
  const sections = plan.sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => {
      let slug = page.slug;
      let suffix = 2;
      while (seen.has(slug)) {
        slug = `${page.slug}-${suffix}`;
        suffix += 1;
      }
      seen.add(slug);
      return { ...page, slug };
    }),
  }));

  const totalPages = sections.reduce((sum, section) => sum + section.pages.length, 0);
  const candidate = totalPages >= 3 ? { sections } : fallbackPlan(context.skeleton, context.architecture);
  return ensureBlueprint(candidate, context.architecture);
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

const PAGE_SYSTEM_PROMPT = `You are writing a branch-specific chapter of a DeepWiki documentation site.

Requirements:
- Write comprehensive, senior-level architectural documentation in clean Markdown.
- Start with a level-1 heading matching the page title.
- Include 1 to 3 valid Mermaid.js diagrams using \`\`\`mermaid fences (flowchart TD, sequenceDiagram, classDiagram, or erDiagram).
- Include structured Markdown comparison/summary tables where appropriate.
- MANDATORY inline source citations: every technical claim, class reference, or architectural explanation MUST cite the exact source file and line range using [[path/to/file.ext:startLine-endLine]].
- Only cite files and lines that appear in the supplied source context.
- Do not invent APIs, files, behavior, or modules.
- If the repository is script-based or unstructured, document the ordered execution flow, inputs/outputs, external calls, state mutations, timers/events, and failure handling instead of pretending it has clean modules.
- If the README is missing or sparse, explicitly label setup/usage details as inferred from manifests, commands, or source.`;

export async function generateWikiPage(opts: {
  context: WikiGenerationContext;
  plan: WikiPlan;
  page: WikiPlanPage;
  sectionTitle: string;
  sectionOrder: number;
}): Promise<GeneratedWikiPage> {
  const { context, page, sectionTitle, sectionOrder } = opts;
  const fileMap = new Map(context.files.map((file) => [file.path, file.content]));
  const requested = page.relevantFiles.filter((path) => fileMap.has(path));
  const fallbackFiles = context.architecture.layers
    .flatMap((layer) => layer.files)
    .filter((path) => fileMap.has(path));
  const relevant =
    requested.length > 0
      ? requested
      : fallbackFiles.length > 0
        ? fallbackFiles.slice(0, 6)
        : context.files.slice(0, 5).map((file) => file.path);

  let sourceContext = '';
  let used = 0;
  for (const path of relevant) {
    const content = fileMap.get(path);
    if (!content) continue;
    const numbered = withLineNumbers(content.slice(0, 32000));
    if (used + numbered.length > 90000) break;
    sourceContext += `\n\n===== FILE: ${path} =====\n${numbered}`;
    used += numbered.length;
  }

  const siblings = opts.plan.sections
    .flatMap((section) =>
      section.pages.map((candidate) => `${section.sectionTitle} > ${candidate.title} (${candidate.slug})`)
    )
    .join('\n');

  const prompt = `Repository: ${context.projectName} (${context.repoUrl})
Branch: ${branchDescription(context)}
Skeleton generated: ${context.skeleton.generatedAt}
Section: ${sectionTitle}
Page: ${page.title} (${page.slug})

WIKI OUTLINE:
${siblings}

NORMALIZED REPOSITORY PROFILE:
${formatArchitectureBrief(context.architecture).slice(0, 9000)}

REPOSITORY SKELETON (file paths, exports, imports):
${compactSkeleton(context.skeleton)}

SOURCE CONTEXT:
${sourceContext || 'No source files could be loaded. Document only what the skeleton and repository profile prove.'}

Write the full Markdown article for "${page.title}" for the ${branchDescription(context)}.
When this branch is a pull request, describe the code as it exists on that branch, not the main branch.`;

  const { text } = await generateText({
    model: getModel(context.provider, context.model, context.apiKey) as never,
    system: PAGE_SYSTEM_PROMPT,
    prompt,
    temperature: 0.25,
    abortSignal: AbortSignal.timeout(90_000),
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
