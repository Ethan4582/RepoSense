-- Preserve the current wiki state as a baseline version for projects that
-- existed before revision history was introduced.
INSERT INTO "WikiPageRevision" (
  "id", "pageId", "actorId", "status", "title", "sectionTitle",
  "content", "headings", "relevantFiles", "additions", "deletions",
  "sourceCommitSha", "createdAt"
)
SELECT
  'baseline_' || md5(page."id"),
  page."id",
  project."ownerId",
  'PUBLISHED'::"RevisionStatus",
  page."title",
  page."sectionTitle",
  page."content",
  page."headings",
  page."relevantFiles",
  CASE
    WHEN page."content" = '' THEN 0
    ELSE array_length(regexp_split_to_array(page."content", E'\\n'), 1)
  END,
  0,
  page."commitSha",
  page."updatedAt"
FROM "WikiPage" page
JOIN "Project" project ON project."id" = page."projectId"
WHERE NOT EXISTS (
  SELECT 1 FROM "WikiPageRevision" revision
  WHERE revision."pageId" = page."id"
);
