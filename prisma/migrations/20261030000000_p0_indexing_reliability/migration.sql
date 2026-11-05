CREATE TYPE "IndexGenerationStatus" AS ENUM ('BUILDING', 'PUBLISHED', 'FAILED');

ALTER TABLE "IndexingJob" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "generationId" TEXT;
CREATE UNIQUE INDEX "IndexingJob_idempotencyKey_key" ON "IndexingJob"("idempotencyKey");

CREATE TABLE "IndexGeneration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "stagingBranch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "baseCommitSha" TEXT,
    "status" "IndexGenerationStatus" NOT NULL DEFAULT 'BUILDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    CONSTRAINT "IndexGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndexGeneration_stagingBranch_key" ON "IndexGeneration"("stagingBranch");
CREATE INDEX "IndexGeneration_projectId_branch_status_idx" ON "IndexGeneration"("projectId", "branch", "status");
CREATE INDEX "IndexGeneration_projectId_createdAt_idx" ON "IndexGeneration"("projectId", "createdAt");
ALTER TABLE "IndexGeneration" ADD CONSTRAINT "IndexGeneration_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BranchIndexState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "activeCommitSha" TEXT NOT NULL,
    "activeGenerationId" TEXT,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BranchIndexState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchIndexState_projectId_branch_key" ON "BranchIndexState"("projectId", "branch");
CREATE INDEX "BranchIndexState_projectId_indexedAt_idx" ON "BranchIndexState"("projectId", "indexedAt");
ALTER TABLE "BranchIndexState" ADD CONSTRAINT "BranchIndexState_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
