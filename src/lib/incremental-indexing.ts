import type { ChangedRepoFile } from "./github";

export function classifyChangedPaths(changes: ChangedRepoFile[]) {
  const loadPaths = new Set<string>();
  const deletePaths = new Set<string>();
  for (const file of changes) {
    if (file.status === "removed") {
      deletePaths.add(file.path);
      continue;
    }
    loadPaths.add(file.path);
    if (file.status === "renamed" && file.previousPath) {
      deletePaths.add(file.previousPath);
    }
  }
  return {
    loadPaths,
    deletePaths,
    changedPaths: new Set([...loadPaths, ...deletePaths]),
  };
}

export function isStructuralChange(paths: Iterable<string>): boolean {
  return Array.from(paths).some((path) =>
    /(^|\/)(package\.json|.*\.lock|.*\.prisma|migrations?|src\/app|src\/pages|routes?)(\/|$)/i.test(
      path,
    ),
  );
}

export function selectAffectedPages<T extends { relevantFiles: string[] }>(
  pages: T[],
  changedPaths: Set<string>,
): T[] {
  return pages.filter((page) =>
    page.relevantFiles.some((path) => changedPaths.has(path)),
  );
}
