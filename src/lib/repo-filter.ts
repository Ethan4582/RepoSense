import {
  fetchRawFile,
  getRepoTree,
  parseRepoUrl,
  resolveRepoRef,
  type RepoBranchKind,
  type RepoRefRequest,
  type RepoTreeEntry,
} from './github';

const IGNORED_DIRECTORIES = [
  'node_modules/',
  '.git/',
  '.next/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  'vendor/',
  '__pycache__/',
  '.venv/',
  'public/models/',
];

const IGNORED_FILES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  '.DS_Store',
];

const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.pdf',
  '.mp4', '.mov', '.webm', '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.otf',
  '.zip', '.gz', '.tar', '.lock', '.map',
];

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_INDEXED_FILES = positiveInt(process.env.MAX_INDEXED_FILES, 10_000);
export const MAX_TOTAL_SOURCE_BYTES = positiveInt(
  process.env.MAX_TOTAL_SOURCE_BYTES,
  64 * 1024 * 1024
);
export const MAX_FILE_BYTES = 250 * 1024;

export interface FilteredRepoFile {
  path: string;
  size: number;
  sha?: string;
}

export interface LoadedRepoFile extends FilteredRepoFile {
  content: string;
  lineCount: number;
}

export function isIgnoredPath(path: string, size?: number): boolean {
  const lower = path.toLowerCase();

  if (IGNORED_DIRECTORIES.some((dir) => lower.startsWith(dir) || lower.includes(`/${dir}`))) {
    return true;
  }

  if (IGNORED_FILES.includes(lower.split('/').pop() ?? '')) return true;
  if (lower.startsWith('.env') || lower.includes('/.env')) return true;
  if (lower.endsWith('.min.js') || lower.endsWith('.min.css')) return true;
  if (IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (typeof size === 'number' && size > MAX_FILE_BYTES) return true;

  return false;
}

function priorityScore(path: string): number {
  const lower = path.toLowerCase();
  const basename = lower.split('/').pop() ?? lower;
  if (lower === 'readme.md') return 1000;
  if (lower.startsWith('readme')) return 950;
  if (
    [
      'package.json',
      'pyproject.toml',
      'requirements.txt',
      'go.mod',
      'cargo.toml',
      'pom.xml',
      'build.gradle',
      'gemfile',
      'composer.json',
      'dockerfile',
      'docker-compose.yml',
      'makefile',
    ].includes(basename)
  ) {
    return 900;
  }

  const corePrefixes = ['src/', 'app/', 'lib/', 'server/', 'docs/', 'prisma/'];
  if (corePrefixes.some((p) => lower.startsWith(p))) return 500;
  if (/^(scripts|tools|bin|automation|jobs|tasks)\//.test(lower)) return 700;

  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 300;
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx')) return 250;
  if (lower.endsWith('.py') || lower.endsWith('.go') || lower.endsWith('.rs') || lower.endsWith('.java')) return 200;
  if (lower.endsWith('.json') || lower.endsWith('.toml') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return 100;

  return 10;
}

export function filterRepoTree(entries: RepoTreeEntry[]): FilteredRepoFile[] {
  return entries
    .filter((entry) => entry.type === 'blob' && entry.path)
    .filter((entry) => !isIgnoredPath(entry.path, entry.size))
    .map((entry) => ({
      path: entry.path,
      size: entry.size ?? 0,
      sha: entry.sha,
    }))
    .sort((a, b) => {
      const diff = priorityScore(b.path) - priorityScore(a.path);
      if (diff !== 0) return diff;
      return a.path.localeCompare(b.path);
    })
    .slice(0, MAX_INDEXED_FILES);
}

export function selectFilesForLoading(
  files: FilteredRepoFile[],
  maxBytes = MAX_TOTAL_SOURCE_BYTES
): FilteredRepoFile[] {
  const selected: FilteredRepoFile[] = [];
  let totalBytes = 0;

  for (const file of files) {
    const size = file.size ?? 0;
    if (size > 0 && selected.length > 0 && totalBytes + size > maxBytes) continue;
    selected.push(file);
    totalBytes += size;
  }

  return selected;
}

export interface RepoSource {
  owner: string;
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  branch: string;
  branchKind: RepoBranchKind;
  pullRequestNumber: number | null;
  commitSha: string;
  isPrivate: boolean;
  fetchOwner: string;
  fetchRepo: string;
  files: FilteredRepoFile[];
}

export async function loadRepoTree(
  repoUrl: string,
  token?: string | null,
  ref: RepoRefRequest = {}
): Promise<RepoSource> {
  const { repoUrl: normalized } = parseRepoUrl(repoUrl);
  const resolved = await resolveRepoRef(normalized, ref, token);
  const tree = await getRepoTree(
    resolved.fetchOwner,
    resolved.fetchRepo,
    resolved.commitSha,
    token
  );

  return {
    owner: resolved.owner,
    repo: resolved.repo,
    repoUrl: normalized,
    defaultBranch: resolved.defaultBranch,
    branch: resolved.branch,
    branchKind: resolved.branchKind,
    pullRequestNumber: resolved.pullRequestNumber,
    commitSha: resolved.commitSha,
    isPrivate: resolved.isPrivate,
    fetchOwner: resolved.fetchOwner,
    fetchRepo: resolved.fetchRepo,
    files: filterRepoTree(tree),
  };
}

/**
 * Fetches a bounded batch of raw file contents. Call inside separate workflow
 * steps so each invocation stays below Cloudflare's subrequest ceiling.
 */
export async function loadRepoFiles(
  source: RepoSource,
  token: string | null | undefined,
  slice: FilteredRepoFile[]
): Promise<LoadedRepoFile[]> {
  const loaded: LoadedRepoFile[] = [];

  for (const file of slice) {
    try {
      const content = await fetchRawFile(
        source.fetchOwner,
        source.fetchRepo,
        source.commitSha,
        file.path,
        token
      );
      if (content === null) continue;

      const byteLength = new TextEncoder().encode(content).byteLength;
      if (byteLength > MAX_FILE_BYTES) continue;

      loaded.push({
        ...file,
        size: byteLength,
        content,
        lineCount: content.split('\n').length,
      });
    } catch (err) {
      console.warn(`[repo-filter] Skipping ${file.path}:`, err);
    }
  }

  return loaded;
}
