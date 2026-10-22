import type { PrismaClient } from '@prisma/client';

export interface BranchSummary {
  branch: string;
  pageCount: number;
  updatedAt: Date | null;
  commitSha: string | null;
}

export async function getProjectBranches(
  db: PrismaClient,
  projectId: string
): Promise<BranchSummary[]> {
  const groups = await db.wikiPage.groupBy({
    by: ['branch'],
    where: { projectId },
    _count: { _all: true },
    _max: { updatedAt: true, commitSha: true },
    orderBy: { _max: { updatedAt: 'desc' } },
  });

  return groups.map((group) => ({
    branch: group.branch,
    pageCount: group._count._all,
    updatedAt: group._max.updatedAt,
    commitSha: group._max.commitSha,
  }));
}

export function pickActiveBranch(
  requested: string | undefined,
  branches: BranchSummary[],
  project: { defaultBranch: string | null; lastIndexedBranch: string | null }
): string | null {
  if (requested) return requested;

  const available = new Set(branches.map((branch) => branch.branch));
  if (project.defaultBranch && available.has(project.defaultBranch)) {
    return project.defaultBranch;
  }
  if (project.lastIndexedBranch && available.has(project.lastIndexedBranch)) {
    return project.lastIndexedBranch;
  }
  return branches[0]?.branch ?? project.defaultBranch ?? project.lastIndexedBranch ?? null;
}
