ALTER TABLE "Project" ADD COLUMN "canonicalRepoKey" TEXT;

WITH ranked_projects AS (
  SELECT
    "id",
    lower("repoOwner" || '/' || "repoName") AS repo_key,
    row_number() OVER (
      PARTITION BY lower("repoOwner"), lower("repoName")
      ORDER BY "lastIndexedAt" DESC NULLS LAST, "createdAt" ASC
    ) AS repo_rank
  FROM "Project"
  WHERE "isPrivateRepo" = false
    AND "isPublicWiki" = true
    AND "deletedAt" IS NULL
)
UPDATE "Project" AS project
SET "canonicalRepoKey" = ranked.repo_key
FROM ranked_projects AS ranked
WHERE project."id" = ranked."id"
  AND ranked.repo_rank = 1;

CREATE UNIQUE INDEX "Project_canonicalRepoKey_key" ON "Project"("canonicalRepoKey");
