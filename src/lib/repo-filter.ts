import {
  fetchRawFile,
  getRepoMetadata,
  getRepoTree,
  parseRepoUrl,
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
  'components/ui/',
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

export const MAX_INDEXED_FILES = 300;
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
  if (lower === 'readme.md') return 1000;
  if (lower.startsWith('readme')) return 950;
  if (lower.endsWith('package.json')) return 900;

  const corePrefixes = ['src/', 'app/', 'lib/', 'server/', 'docs/', 'prisma/'];
  if (corePrefixes.some((p) => lower.startsWith(p))) return 500;

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

export interface RepoSource {
  owner: string;
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  commitSha: string;
  isPrivate: boolean;
  files: FilteredRepoFile[];
}

export async function loadRepoTree(
  repoUrl: string,
  token?: string | null
): Promise<RepoSource> {
  const { owner, repo, repoUrl: normalized } = parseRepoUrl(repoUrl);
  const meta = await getRepoMetadata(normalized, token);
  const tree = await getRepoTree(owner, repo, meta.commitSha, token);

  return {
    owner,
    repo,
    repoUrl: normalized,
    defaultBranch: meta.defaultBranch,
    commitSha: meta.commitSha,
    isPrivate: meta.isPrivate,
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
        source.owner,
        source.repo,
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
