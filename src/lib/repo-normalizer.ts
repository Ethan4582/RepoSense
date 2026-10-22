import type { RepoSkeleton } from './chunker';

export interface RepoLayer {
  key: 'entry' | 'core' | 'integrations' | 'data' | 'utilities';
  title: string;
  description: string;
  files: string[];
}

export interface RepoArchitecture {
  fileCount: number;
  analyzedFileCount: number;
  primaryLanguage: string;
  languages: Array<{ name: string; files: number }>;
  layers: RepoLayer[];
  entryPoints: string[];
  manifests: string[];
  scriptCommands: string[];
  dataModels: string[];
  externalIntegrations: string[];
  testFiles: string[];
  giantFiles: Array<{ path: string; lineCount: number }>;
  readme: {
    path: string | null;
    lineCount: number;
    wordCount: number;
    headingCount: number;
    quality: 'missing' | 'sparse' | 'solid';
  };
  hasModuleGraph: boolean;
  notes: string[];
}

const MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'pipfile',
  'poetry.lock',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'gemfile',
  'composer.json',
  'mix.exs',
  'pubspec.yaml',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'makefile',
  'cmakelists.txt',
  'tsconfig.json',
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.ps1': 'PowerShell',
  '.sql': 'SQL',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.dart': 'Dart',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.lua': 'Lua',
  '.r': 'R',
};

const LAYER_DEFINITIONS: Omit<RepoLayer, 'files'>[] = [
  {
    key: 'entry',
    title: 'Entrypoints, Routing & Automation',
    description:
      'Process starts, HTTP routes, pages, commands, workers, scripts, event handlers, and scheduled jobs.',
  },
  {
    key: 'core',
    title: 'Core Business Logic & State',
    description:
      'Domain rules, services, state containers, orchestration, and the primary application behavior.',
  },
  {
    key: 'integrations',
    title: 'External Services & Adapters',
    description:
      'Network clients, provider adapters, third-party APIs, authentication, messaging, and webhooks.',
  },
  {
    key: 'data',
    title: 'Data & Persistence',
    description:
      'Schemas, models, migrations, repositories, queries, caches, and serialized state.',
  },
  {
    key: 'utilities',
    title: 'Utilities, Configuration & Shared Helpers',
    description:
      'Cross-cutting helpers, configuration, constants, types, tests, documentation, and small shared modules.',
  },
];

const ENTRY_NAME =
  /(^|\/)(main|index|app|server|cli|worker|manage|bootstrap|program|run|start|entry)\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|sh|bash|ps1)$/i;
const ENTRY_PATH =
  /(^|\/)(cmd|bin|scripts|tools|automation|jobs|tasks|routes|routers|controllers|handlers|pages|views|api|endpoints|commands|workers)\//i;
const DATA_PATH =
  /(^|\/)(database|databases|db|models?|entities|schema|schemas|migrations|repositories|repository|repos|dao|store|stores|persistence|orm|prisma)\//i;
const INTEGRATION_PATH =
  /(^|\/)(integrations?|adapters?|clients?|providers?|services?|external|gateways?|webhooks?|auth|payments?|messaging|notifications?)\//i;
const UTILITY_PATH =
  /(^|\/)(utils?|helpers?|shared|common|config|configs|constants?|types?|lib|libs|hooks|composables|styles|tests?|__tests__|docs?)\//i;
const TEST_PATH = /(^|\/)(tests?|__tests__|specs?|e2e)\/|\.(test|spec)\.[a-z0-9]+$/i;

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

function extension(path: string): string {
  const name = basename(path).toLowerCase();
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index) : '';
}

function isCodePath(path: string): boolean {
  return Boolean(LANGUAGE_BY_EXTENSION[extension(path)]);
}

function readmeRank(path: string): number {
  const name = basename(path).toLowerCase();
  if (name === 'readme.md' || name === 'readme.mdx') return 3;
  if (name.startsWith('readme.')) return 2;
  if (name.startsWith('readme')) return 1;
  return 0;
}

function parsePackageManifest(content: string): {
  entries: string[];
  scripts: string[];
  dependencies: string[];
} {
  try {
    const parsed = JSON.parse(content) as {
      main?: unknown;
      module?: unknown;
      bin?: unknown;
      scripts?: unknown;
      dependencies?: unknown;
      devDependencies?: unknown;
    };

    const entries = [parsed.main, parsed.module, parsed.bin]
      .flatMap((value) => {
        if (typeof value === 'string') return [value];
        if (value && typeof value === 'object') {
          return Object.values(value).filter(
            (item): item is string => typeof item === 'string'
          );
        }
        return [];
      })
      .filter(Boolean);

    const scripts =
      parsed.scripts && typeof parsed.scripts === 'object'
        ? Object.entries(parsed.scripts as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
            .slice(0, 40)
            .map(([name, command]) => `${name}: ${command}`)
        : [];

    const dependencies = [
      ...(parsed.dependencies && typeof parsed.dependencies === 'object'
        ? Object.keys(parsed.dependencies)
        : []),
      ...(parsed.devDependencies && typeof parsed.devDependencies === 'object'
        ? Object.keys(parsed.devDependencies)
        : []),
    ];

    return { entries, scripts, dependencies };
  } catch {
    return { entries: [], scripts: [], dependencies: [] };
  }
}

function importSpecifiers(skeleton: RepoSkeleton): {
  external: string[];
  edges: Map<string, string[]>;
  edgeCount: number;
} {
  const external = new Set<string>();
  const edges = new Map<string, string[]>();
  let edgeCount = 0;

  for (const file of skeleton.files) {
    const targets: string[] = [];
    for (const statement of file.imports) {
      const match =
        /from\s+['"]([^'"]+)['"]/.exec(statement.statement) ??
        /require\(['"]([^'"]+)['"]\)/.exec(statement.statement) ??
        /^\s*import\s+['"]([^'"]+)['"]/.exec(statement.statement);

      const specifier = match?.[1];
      if (!specifier) continue;

      if (specifier.startsWith('.')) {
        targets.push(specifier);
        edgeCount += 1;
      } else if (!specifier.startsWith('/') && !specifier.startsWith('node:')) {
        const packageName = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        if (packageName) external.add(packageName);
      }
    }
    if (targets.length > 0) edges.set(file.filePath, targets);
  }

  return { external: Array.from(external).slice(0, 40), edges, edgeCount };
}

function classifyContent(path: string, content: string | undefined): RepoLayer['key'] {
  const lowerPath = path.toLowerCase();
  if (ENTRY_NAME.test(path) || ENTRY_PATH.test(lowerPath)) return 'entry';
  if (DATA_PATH.test(lowerPath)) return 'data';
  if (INTEGRATION_PATH.test(lowerPath)) return 'integrations';
  if (UTILITY_PATH.test(lowerPath)) return 'utilities';

  const sample = content?.slice(0, 12_000) ?? '';
  if (/^\s*#!|process\.argv|if\s+__name__\s*==|func\s+main\s*\(|console\.log\(|setInterval\(|setTimeout\(|addEventListener\(/.test(sample)) {
    return 'entry';
  }
  if (/\b(prisma|mongoose|sequelize|typeorm|knex|sqlalchemy|database|db\.|CREATE TABLE|@Entity|Schema\()/i.test(sample)) {
    return 'data';
  }
  if (/\b(fetch\(|axios|got\(|http\.request|requests\.|webhook|stripe|openai|anthropic|redis|s3|pubsub)\b/i.test(sample)) {
    return 'integrations';
  }
  if (/\b(export\s+(const|function)|module\.exports|class\s+|def\s+|func\s+)/.test(sample)) return 'core';

  return isCodePath(path) ? 'core' : 'utilities';
}

function uniqueStrings(values: string[], limit: number): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

export function analyzeRepository(input: {
  files: Array<{ path: string; content: string; size: number }>;
  skeleton: RepoSkeleton;
  allPaths?: string[];
}): RepoArchitecture {
  const { files, skeleton } = input;
  const allPaths = input.allPaths?.length
    ? input.allPaths
    : skeleton.files.map((file) => file.filePath);
  const contentByPath = new Map(files.map((file) => [file.path, file.content]));
  const pathSet = new Set(allPaths);
  const moduleGraph = importSpecifiers(skeleton);

  const readmePath =
    allPaths
      .filter((path) => readmeRank(path) > 0)
      .sort((a, b) => {
        const rank = readmeRank(b) - readmeRank(a);
        if (rank !== 0) return rank;
        return a.split('/').length - b.split('/').length;
      })[0] ?? null;
  const readmeContent = readmePath ? contentByPath.get(readmePath) ?? '' : '';
  const readmeWords = readmeContent
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const readmeHeadings = (readmeContent.match(/^#{1,3}\s+\S+/gm) ?? []).length;
  const readmeQuality: RepoArchitecture['readme']['quality'] = !readmePath
    ? 'missing'
    : readmeWords < 120 || readmeHeadings < 2
      ? 'sparse'
      : 'solid';

  const manifests = allPaths.filter((path) => {
    const name = basename(path).toLowerCase();
    return MANIFEST_NAMES.has(name) || name.startsWith('dockerfile');
  });

  const packagePath = manifests.find((path) => basename(path).toLowerCase() === 'package.json');
  const packageManifest = packagePath
    ? parsePackageManifest(contentByPath.get(packagePath) ?? '')
    : { entries: [], scripts: [], dependencies: [] };

  const entryPoints = new Set<string>(packageManifest.entries.filter((path) => pathSet.has(path)));
  const scriptCommands = [...packageManifest.scripts];

  for (const path of allPaths) {
    if (ENTRY_NAME.test(path) || /(^|\/)(cmd|bin)\//i.test(path)) entryPoints.add(path);

    const content = contentByPath.get(path);
    if (content && /^\s*#!/.test(content) && /(^|\/)(scripts|tools|bin)\//i.test(path)) {
      entryPoints.add(path);
    }

    if (!content) continue;
    for (const command of packageManifest.scripts) {
      if (command.includes(path)) entryPoints.add(path);
    }
  }

  const layerFiles = new Map<RepoLayer['key'], string[]>(
    LAYER_DEFINITIONS.map((layer) => [layer.key, []])
  );

  for (const path of allPaths) {
    const name = basename(path).toLowerCase();
    if (name.startsWith('readme') || MANIFEST_NAMES.has(name) || TEST_PATH.test(path)) continue;
    if (!isCodePath(path) && !/\.(sql|graphql|gql|proto|prisma)$/i.test(path)) continue;

    const key = classifyContent(path, contentByPath.get(path));
    const list = layerFiles.get(key);
    if (list && list.length < 80) list.push(path);
  }

  const entryLayer = layerFiles.get('entry');
  if (entryLayer) {
    for (const path of Array.from(entryPoints)) {
      if (pathSet.has(path) && !entryLayer.includes(path) && entryLayer.length < 80) {
        entryLayer.push(path);
      }
    }
  }

  const languages = new Map<string, number>();
  for (const path of allPaths) {
    const language = LANGUAGE_BY_EXTENSION[extension(path)];
    if (language) languages.set(language, (languages.get(language) ?? 0) + 1);
  }
  const languageList = Array.from(languages.entries())
    .map(([name, count]) => ({ name, files: count }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 6);

  const dataModels = uniqueStrings(
    allPaths.filter((path) => /\.(prisma|sql)$/i.test(path) || DATA_PATH.test(path)),
    24
  );

  const externalIntegrations = uniqueStrings(
    [...moduleGraph.external, ...packageManifest.dependencies],
    30
  );

  const testFiles = uniqueStrings(allPaths.filter((path) => TEST_PATH.test(path)), 20);

  const giantFiles = skeleton.files
    .filter((file) => file.lineCount > 800)
    .sort((a, b) => b.lineCount - a.lineCount)
    .slice(0, 30)
    .map((file) => ({ path: file.filePath, lineCount: file.lineCount }));

  const notes: string[] = [];
  const loadedCodeCount = skeleton.files.filter((file) => isCodePath(file.filePath)).length;
  if (!moduleGraph.edgeCount) {
    notes.push(
      'No relative import graph was detected. Treat this as a script, monolith, notebook, or loosely coupled repository and infer behavior from entry files, commands, and execution order.'
    );
  }
  if (readmeQuality !== 'solid') {
    notes.push(
      'The README is missing or sparse. Synthesize setup and intent from manifests, lock-in files, exported symbols, scripts, and runtime entrypoints; clearly label inferred behavior.'
    );
  }
  if (giantFiles.length > 0) {
    notes.push(
      'Large files are split on symbol boundaries. Preserve line citations and do not assume the first chunk represents the whole file.'
    );
  }
  if (entryPoints.size > 1) {
    notes.push('Multiple execution entrypoints exist. Document each one and how they converge on shared logic.');
  }
  if (loadedCodeCount === 0) {
    notes.push('No conventional source extension was found. Use file names, manifests, SQL, notebooks, and configuration as primary evidence.');
  }

  const layers: RepoLayer[] = LAYER_DEFINITIONS.map((definition) => ({
    ...definition,
    files: (layerFiles.get(definition.key) ?? []).slice(0, 80),
  }));

  return {
    fileCount: allPaths.length,
    analyzedFileCount: skeleton.fileCount,
    primaryLanguage: languageList[0]?.name ?? 'Unknown',
    languages: languageList,
    layers,
    entryPoints: uniqueStrings(Array.from(entryPoints), 30),
    manifests: uniqueStrings(manifests, 20),
    scriptCommands: uniqueStrings(scriptCommands, 40),
    dataModels,
    externalIntegrations,
    testFiles,
    giantFiles,
    readme: {
      path: readmePath,
      lineCount: readmeContent ? readmeContent.split('\n').length : 0,
      wordCount: readmeWords,
      headingCount: readmeHeadings,
      quality: readmeQuality,
    },
    hasModuleGraph: moduleGraph.edgeCount > 1,
    notes,
  };
}

export function formatArchitectureBrief(architecture: RepoArchitecture): string {
  const layers = architecture.layers
    .map((layer) => `${layer.title}: ${layer.files.slice(0, 24).join(', ') || '(none detected)'}`)
    .join('\n');

  return [
    `Files in tree: ${architecture.fileCount}; analyzed: ${architecture.analyzedFileCount}`,
    `Primary language: ${architecture.primaryLanguage}`,
    `Languages: ${architecture.languages.map((language) => `${language.name} (${language.files})`).join(', ') || 'unknown'}`,
    `README: ${architecture.readme.quality}${architecture.readme.path ? ` (${architecture.readme.path}, ${architecture.readme.lineCount} lines)` : ''}`,
    `Module graph: ${architecture.hasModuleGraph ? 'detected' : 'not detected'}`,
    `Entrypoints: ${architecture.entryPoints.join(', ') || '(none detected)'}`,
    `Manifests: ${architecture.manifests.join(', ') || '(none detected)'}`,
    `Commands: ${architecture.scriptCommands.slice(0, 12).join(' | ') || '(none detected)'}`,
    `External services/packages: ${architecture.externalIntegrations.slice(0, 16).join(', ') || '(none detected)'}`,
    `Data models: ${architecture.dataModels.slice(0, 16).join(', ') || '(none detected)'}`,
    `Giant files: ${architecture.giantFiles.map((file) => `${file.path} (${file.lineCount} lines)`).join(', ') || '(none)'}`,
    'Logical layers:',
    layers,
    `Normalization notes: ${architecture.notes.join(' ') || 'none'}`,
  ].join('\n');
}
