CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR', 'CONTRIBUTOR', 'VIEWER');
CREATE TYPE "RevisionStatus" AS ENUM ('PUBLISHED', 'PENDING');
CREATE TYPE "IndexingTrigger" AS ENUM ('MANUAL', 'INITIAL', 'MERGE', 'PUSH');
CREATE TYPE "NotificationType" AS ENUM ('INDEXING', 'WIKI_UPDATED', 'REVIEW_REQUIRED', 'ACCESS', 'SECURITY');

ALTER TABLE "Project" ADD COLUMN "githubRepositoryId" TEXT;
ALTER TABLE "Project" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Project" ADD COLUMN "automaticUpdatesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "directEditNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserToProject" ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER';

UPDATE "Project" p
SET "ownerId" = membership."userId"
FROM LATERAL (
  SELECT up."userId"
  FROM "UserToProject" up
  WHERE up."projectId" = p."id"
  ORDER BY up."createdAt" ASC, up."id" ASC
  LIMIT 1
) membership;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Project" WHERE "ownerId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot assign project ownership because an existing project has no linked user';
  END IF;
END $$;

UPDATE "UserToProject" up
SET "role" = 'OWNER'
FROM "Project" p
WHERE p."id" = up."projectId" AND p."ownerId" = up."userId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Project"
    GROUP BY lower("repoOwner"), lower("repoName")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate repositories must be reconciled before applying project governance';
  END IF;
END $$;

UPDATE "Project"
SET "canonicalRepoKey" = lower("repoOwner" || '/' || "repoName");

ALTER TABLE "Project" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Project_githubRepositoryId_key" ON "Project"("githubRepositoryId");

ALTER TABLE "IndexingJob" ADD COLUMN "baseCommitSha" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "trigger" "IndexingTrigger" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "IndexingJob" ADD COLUMN "requestedByUserId" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "IndexingJob" ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "IndexingJob" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IndexingJob" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "IndexingJob" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "IndexingJob" ADD COLUMN "githubDeliveryId" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "githubRequestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IndexingJob" ADD COLUMN "processedChunks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IndexingJob" ADD COLUMN "estimatedProviderTokens" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "IndexingJob_status_availableAt_priority_idx" ON "IndexingJob"("status", "availableAt", "priority");

CREATE UNIQUE INDEX "SourceCodeEmbedding_projectId_branch_filePath_chunkIndex_key"
ON "SourceCodeEmbedding"("projectId", "branch", "filePath", "chunkIndex");

CREATE TABLE "ProjectInvitation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "role" "ProjectRole" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectInvitation_tokenHash_key" ON "ProjectInvitation"("tokenHash");
CREATE INDEX "ProjectInvitation_projectId_expiresAt_idx" ON "ProjectInvitation"("projectId", "expiresAt");

CREATE TABLE "WikiPageRevision" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "actorId" TEXT,
  "status" "RevisionStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "sectionTitle" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "headings" JSONB,
  "relevantFiles" TEXT[],
  "additions" INTEGER NOT NULL DEFAULT 0,
  "deletions" INTEGER NOT NULL DEFAULT 0,
  "sourceCommitSha" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WikiPageRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WikiPageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WikiPageRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WikiPageRevision_pageId_createdAt_idx" ON "WikiPageRevision"("pageId", "createdAt");
CREATE INDEX "WikiPageRevision_pageId_status_idx" ON "WikiPageRevision"("pageId", "status");

CREATE TABLE "ProjectAuditEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectAuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ProjectAuditEvent_projectId_createdAt_idx" ON "ProjectAuditEvent"("projectId", "createdAt");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

CREATE TABLE "GithubWebhookDelivery" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "repositoryId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GithubWebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GithubWebhookDelivery_receivedAt_idx" ON "GithubWebhookDelivery"("receivedAt");
