import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
}

const sql = neon(dbUrl);
async function run() {
  try {
    const query = `
      SELECT "public"."Project"."id", "public"."Project"."name", "public"."Project"."repoOwner", "public"."Project"."repoName", "public"."Project"."repoUrl", "public"."Project"."encryptedGithubToken", "public"."Project"."githubTokenIv", "public"."Project"."isPrivateRepo", "public"."Project"."isPublicWiki", "public"."Project"."chatProvider"::text, "public"."Project"."chatModel", "public"."Project"."embeddingProvider"::text, "public"."Project"."embeddingModel", "public"."Project"."embeddingDimensions", "public"."Project"."repoSkeleton", "public"."Project"."defaultBranch", "public"."Project"."lastIndexedBranch", "public"."Project"."lastIndexedBranchKind", "public"."Project"."lastIndexedPullRequest", "public"."Project"."lastIndexedCommitSha", "public"."Project"."lastIndexedAt", "public"."Project"."deletedAt", "public"."Project"."createdAt", "public"."Project"."updatedAt", COALESCE("aggr_selection_0_WikiPage"."_aggr_count_wikiPages", 0) AS "_aggr_count_wikiPages" 
      FROM "public"."Project" 
      LEFT JOIN (
        SELECT "public"."WikiPage"."projectId", COUNT(*) AS "_aggr_count_wikiPages" 
        FROM "public"."WikiPage" 
        WHERE 1=1 
        GROUP BY "public"."WikiPage"."projectId"
      ) AS "aggr_selection_0_WikiPage" ON ("public"."Project"."id" = "aggr_selection_0_WikiPage"."projectId") 
      WHERE (EXISTS(
        SELECT "t0"."projectId" 
        FROM "public"."UserToProject" AS "t0" 
        WHERE ("t0"."userId" = $1 AND ("public"."Project"."id") = ("t0"."projectId") AND "t0"."projectId" IS NOT NULL)
      ) AND "public"."Project"."deletedAt" IS NULL) 
      ORDER BY "public"."Project"."createdAt" DESC 
      OFFSET $2
    `;
    const res = await sql(query, ['user_33sXgQIaVosTl8rFK6WRSeHuHHj', 0]);
    console.log('Query result:', res);
  } catch (err) {
    console.error('SQL ERROR:', err);
  }
}

run();
