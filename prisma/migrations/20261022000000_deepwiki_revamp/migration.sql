-- DeepWiki revamp: multi-page wiki, QA threads, line-aware chunks, BYOK defaults.
-- Drops legacy AI commit summaries and Stripe/credit remnants.

-- ---------------------------------------------------------------------------
-- User defaults
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;

UPDATE "User" SET "defaultChatProvider" = 'OPENAI' WHERE "defaultChatProvider" IS NULL;
UPDATE "User" SET "defaultChatModel" = 'gpt-6.1-sol' WHERE "defaultChatModel" IS NULL;

ALTER TABLE "User" ALTER COLUMN "defaultChatProvider" SET DEFAULT 'OPENAI';
ALTER TABLE "User" ALTER COLUMN "defaultChatProvider" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "defaultChatModel" SET DEFAULT 'gpt-6.1-sol';
ALTER TABLE "User" ALTER COLUMN "defaultChatModel" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "defaultEmbeddingProvider" SET DEFAULT 'OPENAI';

-- ---------------------------------------------------------------------------
-- KeyStatus: retire REVOKED
-- ---------------------------------------------------------------------------
ALTER TABLE "ApiKey" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "KeyStatus" RENAME TO "KeyStatus_old";
CREATE TYPE "KeyStatus" AS ENUM ('UNVERIFIED', 'VALID', 'INVALID', 'QUOTA_EXHAUSTED');
ALTER TABLE "ApiKey"
  ALTER COLUMN "status" TYPE "KeyStatus"
  USING (CASE WHEN "status"::text = 'REVOKED' THEN 'INVALID'::"KeyStatus" ELSE "status"::text::"KeyStatus" END);
ALTER TABLE "ApiKey" ALTER COLUMN "status" SET DEFAULT 'UNVERIFIED';
DROP TYPE "KeyStatus_old";

-- ---------------------------------------------------------------------------
-- Project: repo identity, visibility, encrypted token, skeleton
-- ---------------------------------------------------------------------------
ALTER TABLE "Project" ADD COLUMN "repoOwner" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "repoName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "encryptedGithubToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "githubTokenIv" TEXT;
ALTER TABLE "Project" ADD COLUMN "isPrivateRepo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "isPublicWiki" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Project" ADD COLUMN "repoSkeleton" JSONB;
ALTER TABLE "Project" ADD COLUMN "lastIndexedCommitSha" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastIndexedAt" TIMESTAMP(3);

UPDATE "Project"
SET "repoName" = "name"
WHERE "repoName" = '';

UPDATE "Project"
SET "repoOwner" = split_part(regexp_replace("repoUrl", '^.*github\.com[:/]', ''), '/', 1)
WHERE "repoUrl" LIKE '%github.com%';

UPDATE "Project"
SET "repoName" = regexp_replace(split_part(regexp_replace("repoUrl", '^.*github\.com[:/]', ''), '/', 2), '\.git$', '')
WHERE "repoUrl" LIKE '%github.com%' AND split_part(regexp_replace("repoUrl", '^.*github\.com[:/]', ''), '/', 2) <> '';

ALTER TABLE "Project" ALTER COLUMN "repoOwner" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "repoName" DROP DEFAULT;

ALTER TABLE "Project" ALTER COLUMN "chatProvider" SET DEFAULT 'OPENAI';
ALTER TABLE "Project" ALTER COLUMN "chatProvider" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "chatModel" SET DEFAULT 'gpt-6.1-sol';
ALTER TABLE "Project" ALTER COLUMN "chatModel" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "embeddingProvider" SET DEFAULT 'OPENAI';
ALTER TABLE "Project" ALTER COLUMN "embeddingModel" SET DEFAULT 'text-embedding-3-small';
ALTER TABLE "Project" ALTER COLUMN "embeddingDimensions" SET DEFAULT 1536;

ALTER TABLE "Project" DROP COLUMN "gitHubToken";

CREATE INDEX "Project_repoOwner_repoName_isPublicWiki_idx"
  ON "Project"("repoOwner", "repoName", "isPublicWiki");

-- ---------------------------------------------------------------------------
-- SourceCodeEmbedding: line-aware chunks
-- ---------------------------------------------------------------------------
ALTER TABLE "SourceCodeEmbedding" RENAME COLUMN "fileName" TO "filePath";
ALTER TABLE "SourceCodeEmbedding" RENAME COLUMN "sourceCode" TO "chunkContent";

ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "directory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "chunkIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "startLine" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "endLine" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SourceCodeEmbedding" ADD COLUMN "fullFileContent" TEXT;

ALTER TABLE "SourceCodeEmbedding" DROP COLUMN "summary";

ALTER TABLE "SourceCodeEmbedding" ALTER COLUMN "directory" DROP DEFAULT;
ALTER TABLE "SourceCodeEmbedding" ALTER COLUMN "chunkIndex" DROP DEFAULT;
ALTER TABLE "SourceCodeEmbedding" ALTER COLUMN "startLine" DROP DEFAULT;
ALTER TABLE "SourceCodeEmbedding" ALTER COLUMN "endLine" DROP DEFAULT;

ALTER TABLE "SourceCodeEmbedding" DROP CONSTRAINT IF EXISTS "SourceCodeEmbedding_projectId_fkey";
ALTER TABLE "SourceCodeEmbedding"
  ADD CONSTRAINT "SourceCodeEmbedding_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "SourceCodeEmbedding_projectId_fileName_idx";
CREATE INDEX "SourceCodeEmbedding_projectId_filePath_idx"
  ON "SourceCodeEmbedding"("projectId", "filePath");

CREATE INDEX "SourceCodeEmbedding_embeddingOpenAI_idx"
  ON "SourceCodeEmbedding" USING hnsw ("embeddingOpenAI" vector_cosine_ops);
CREATE INDEX "SourceCodeEmbedding_embeddingGemini_idx"
  ON "SourceCodeEmbedding" USING hnsw ("embeddingGemini" vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- WikiPage
-- ---------------------------------------------------------------------------
CREATE TABLE "WikiPage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sectionTitle" TEXT NOT NULL,
  "sectionOrder" INTEGER NOT NULL,
  "pageOrder" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "relevantFiles" TEXT[],
  "headings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WikiPage_projectId_slug_key" ON "WikiPage"("projectId", "slug");
CREATE INDEX "WikiPage_projectId_sectionOrder_pageOrder_idx"
  ON "WikiPage"("projectId", "sectionOrder", "pageOrder");

ALTER TABLE "WikiPage"
  ADD CONSTRAINT "WikiPage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- QaThread / QaMessage
-- ---------------------------------------------------------------------------
CREATE TABLE "QaThread" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QaThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QaThread_projectId_userId_idx" ON "QaThread"("projectId", "userId");

ALTER TABLE "QaThread"
  ADD CONSTRAINT "QaThread_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QaThread"
  ADD CONSTRAINT "QaThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QaMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "scannedFiles" JSONB,
  "modelUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QaMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QaMessage_threadId_createdAt_idx" ON "QaMessage"("threadId", "createdAt");

ALTER TABLE "QaMessage"
  ADD CONSTRAINT "QaMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "QaThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- IndexingJob: new lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE "IndexingJob" DROP COLUMN "status";
ALTER TABLE "IndexingJob" DROP COLUMN "currentStep";
DROP TYPE "JobStatus";
DROP TYPE "JobStep";

CREATE TYPE "IndexingStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "IndexingStep" AS ENUM ('LOADING_REPO', 'CHUNKING_AND_EMBEDDING', 'PLANNING_WIKI', 'GENERATING_PAGES', 'FINALIZING', 'DONE');

ALTER TABLE "IndexingJob"
  ADD COLUMN "status" "IndexingStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "currentStep" "IndexingStep" NOT NULL DEFAULT 'LOADING_REPO',
  ADD COLUMN "totalWikiPages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completedWikiPages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "estimatedSecondsRemaining" INTEGER,
  ADD COLUMN "currentDetail" TEXT,
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "finishedAt" TIMESTAMP(3);

ALTER TABLE "IndexingJob" RENAME COLUMN "createdAt" TO "startedAt";
ALTER TABLE "IndexingJob" DROP COLUMN "updatedAt";

CREATE INDEX "IndexingJob_status_idx" ON "IndexingJob"("status");

-- ---------------------------------------------------------------------------
-- Drop legacy commit summaries
-- ---------------------------------------------------------------------------
DROP TABLE "Commit";
