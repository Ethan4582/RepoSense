import { Prisma, type PrismaClient } from "@prisma/client";

export const STAGING_BRANCH_PREFIX = "__reposense_generation__";

export function getStagingBranch(generationId: string): string {
  return `${STAGING_BRANCH_PREFIX}/${generationId}`;
}

export async function createIndexGeneration(
  db: PrismaClient,
  input: {
    projectId: string;
    branch: string;
    commitSha: string;
    baseCommitSha?: string | null;
  },
) {
  const generation = await db.indexGeneration.create({
    data: {
      projectId: input.projectId,
      branch: input.branch,
      stagingBranch: getStagingBranch(crypto.randomUUID()),
      commitSha: input.commitSha,
      baseCommitSha: input.baseCommitSha ?? null,
    },
  });

  return generation;
}

export async function markGenerationFailed(
  db: PrismaClient,
  generationId: string | null | undefined,
  error: { code: string; message: string },
) {
  if (!generationId) return;
  await db.indexGeneration
    .updateMany({
      where: { id: generationId, status: "BUILDING" },
      data: {
        status: "FAILED",
        errorCode: error.code,
        errorMessage: error.message,
        failedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

export async function publishIndexGeneration(
  db: PrismaClient,
  generationId: string,
) {
  return db.$transaction(async (tx) => {
    const generation = await tx.indexGeneration.findUnique({
      where: { id: generationId },
    });
    if (!generation || generation.status !== "BUILDING") {
      throw new Error("Index generation is not available for publishing.");
    }

    // Embeddings are immutable for a commit. Replace the active branch only
    // after the complete staged set has been built.
    await tx.$executeRaw`
      DELETE FROM "SourceCodeEmbedding"
      WHERE "projectId" = ${generation.projectId}
        AND "branch" = ${generation.branch}
    `;
    await tx.$executeRaw`
      UPDATE "SourceCodeEmbedding"
      SET "branch" = ${generation.branch}
      WHERE "projectId" = ${generation.projectId}
        AND "branch" = ${generation.stagingBranch}
    `;

    const stagedPages = await tx.wikiPage.findMany({
      where: {
        projectId: generation.projectId,
        branch: generation.stagingBranch,
      },
      orderBy: [{ sectionOrder: "asc" }, { pageOrder: "asc" }],
    });
    const activePages = await tx.wikiPage.findMany({
      where: {
        projectId: generation.projectId,
        branch: generation.branch,
      },
      select: { id: true, slug: true },
    });
    const activeBySlug = new Map(activePages.map((page) => [page.slug, page]));
    const stagedSlugs = new Set(stagedPages.map((page) => page.slug));

    for (const staged of stagedPages) {
      const active = activeBySlug.get(staged.slug);
      if (!active) {
        await tx.wikiPage.update({
          where: { id: staged.id },
          data: { branch: generation.branch },
        });
        continue;
      }

      // Keep the existing page id so revision history remains attached to the
      // page while the staged generated revision is moved to it.
      await tx.wikiPage.update({
        where: { id: active.id },
        data: {
          commitSha: staged.commitSha,
          title: staged.title,
          sectionTitle: staged.sectionTitle,
          sectionOrder: staged.sectionOrder,
          pageOrder: staged.pageOrder,
          content: staged.content,
          relevantFiles: staged.relevantFiles,
          headings: staged.headings ?? Prisma.JsonNull,
        },
      });
      await tx.wikiPageRevision.updateMany({
        where: { pageId: staged.id },
        data: { pageId: active.id },
      });
      await tx.wikiPage.delete({ where: { id: staged.id } });
    }

    // Pages removed by a full plan are no longer part of the active snapshot.
    await tx.wikiPage.deleteMany({
      where: {
        projectId: generation.projectId,
        branch: generation.branch,
        slug: { notIn: [...stagedSlugs] },
      },
    });

    await tx.branchIndexState.upsert({
      where: {
        projectId_branch: {
          projectId: generation.projectId,
          branch: generation.branch,
        },
      },
      create: {
        projectId: generation.projectId,
        branch: generation.branch,
        activeCommitSha: generation.commitSha,
        activeGenerationId: generation.id,
      },
      update: {
        activeCommitSha: generation.commitSha,
        activeGenerationId: generation.id,
        indexedAt: new Date(),
      },
    });

    const published = await tx.indexGeneration.update({
      where: { id: generation.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    return published;
  });
}
