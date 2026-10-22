import { buildRepoSkeleton, type RepoSkeleton } from '~/lib/chunker';

export interface RepoManifest {
  path: string;
  runtime: string;
  frameworks: string[];
  scripts: string[];
}

export interface StructuralContext {
  skeleton: RepoSkeleton;
  manifests: RepoManifest[];
}

const MANIFESTS = /(^|\/)(package\.json|Cargo\.toml|go\.mod|pyproject\.toml|requirements\.txt)$/i;

export function assembleStructuralContext(files: Array<{ path: string; content: string; size: number }>): StructuralContext {
  const eligible = files.filter((file) => file.size <= 250_000 && !/(^|\/)(node_modules|dist|build|\.next)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|(^|\.)env/i.test(file.path));
  const manifests = eligible.filter((file) => MANIFESTS.test(file.path)).map((file) => {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(file.content) as Record<string, unknown>; } catch { /* non-JSON manifest */ }
    const scripts = parsed.scripts && typeof parsed.scripts === 'object' ? Object.keys(parsed.scripts as object) : [];
    const dependencies = { ...(parsed.dependencies as object ?? {}), ...(parsed.devDependencies as object ?? {}) };
    return { path: file.path, runtime: file.path.endsWith('package.json') ? 'Node.js' : file.path.split('.').pop() ?? 'unknown', frameworks: Object.keys(dependencies).slice(0, 30), scripts };
  });
  return { skeleton: buildRepoSkeleton(eligible), manifests };
}
