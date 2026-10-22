-- Branch-aware documentation for arbitrary branches and pull requests.

ALTER TABLE "Project" ADD COLUMN "defaultBranch" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastIndexedBranch" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastIndexedBranchKind" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastIndexedPullRequest" INTEGER;

ALTER TABLE "WikiPage" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "WikiPage" ADD COLUMN "commitSha" TEXT;
DROP INDEX IF EXISTS "WikiPage_projectId_slug_key";
CREATE UNIQUE INDEX "WikiPage_projectId_branch_slug_key"
  ON "WikiPage"("projectId", "branch", "slug");
DROP INDEX IF EXISTS "WikiPage_projectId_sectionOrder_pageOrder_idx";
CREATE INDEX "WikiPage_projectId_branch_sectionOrder_pageOrder_idx"
  ON "WikiPage"("projectId", "branch", "sectionOrder", "pageOrder");

ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "commitSha" TEXT;
DROP INDEX IF EXISTS "SourceCodeEmbedding_projectId_filePath_idx";
CREATE INDEX "SourceCodeEmbedding_projectId_branch_filePath_idx"
  ON "SourceCodeEmbedding"("projectId", "branch", "filePath");

ALTER TABLE "QaThread" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
DROP INDEX IF EXISTS "QaThread_projectId_userId_idx";
CREATE INDEX "QaThread_projectId_branch_userId_idx"
  ON "QaThread"("projectId", "branch", "userId");

ALTER TABLE "IndexingJob" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "IndexingJob" ADD COLUMN "branchKind" TEXT NOT NULL DEFAULT 'MAIN';
ALTER TABLE "IndexingJob" ADD COLUMN "pullRequestNumber" INTEGER;
ALTER TABLE "IndexingJob" ADD COLUMN "commitSha" TEXT;

ALTER TABLE "Question" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'main';

UPDATE "WikiPage" AS w
SET "commitSha" = p."lastIndexedCommitSha"
FROM "Project" AS p
WHERE w."projectId" = p."id" AND w."commitSha" IS NULL;

UPDATE "SourceCodeEmbedding" AS s
SET "commitSha" = p."lastIndexedCommitSha"
FROM "Project" AS p
WHERE s."projectId" = p."id" AND s."commitSha" IS NULL;

UPDATE "Project"
SET "lastIndexedBranch" = 'main'
WHERE "lastIndexedBranch" IS NULL
  AND EXISTS (SELECT 1 FROM "WikiPage" WHERE "WikiPage"."projectId" = "Project"."id");
