import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Octokit } from "octokit";
import type { AuthContext } from "../auth";
import { estimateProjectCost, estimateRepoTokensFromTree } from "~/lib/estimate";

export const estimateRoutes = new Hono<AuthContext>().post(
  "/",
  zValidator(
    "json",
    z.object({
      repoUrl: z.string().url(),
      githubToken: z.string().optional(),
      modelId: z.string().optional().default("gemini-2.5-flash"),
      embeddingModelId: z.string().optional().default("gemini-embedding-001"),
    })
  ),
  async (c) => {
    const { repoUrl, githubToken, modelId, embeddingModelId } = c.req.valid("json");

    try {
      const parts = repoUrl.replace(/\.git$/, "").split("/");
      const owner = parts[parts.length - 2];
      const repo = parts[parts.length - 1];

      if (!owner || !repo) {
        return c.json({ error: "Invalid repository URL format" }, 400);
      }

      const token = githubToken || process.env.GITHUB_TOKEN;
      const octokit = new Octokit({ auth: token });

      // Fetch repository tree (recursive)
      let fileCount = 0;
      let treeEntries: Array<{ path?: string; size?: number }> = [];

      try {
        const repoData = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoData.data.default_branch || "main";

        const treeData = await octokit.rest.git.getTree({
          owner,
          repo,
          tree_sha: defaultBranch,
          recursive: "1",
        });

        if (treeData.data.tree) {
          treeEntries = treeData.data.tree
            .filter((item) => item.type === "blob")
            .map((item) => ({ path: item.path, size: item.size }));
          fileCount = treeEntries.length;
        }
      } catch {
        // Fallback: estimate conservatively with 50 files if tree API hits rate limit
        fileCount = 50;
      }

      if (treeEntries.length > 0) {
        const estimate = estimateRepoTokensFromTree(treeEntries, modelId, embeddingModelId);
        return c.json({
          success: true,
          estimate,
          label: "Estimate (verify against provider pricing)",
        });
      }

      const fallbackEstimate = estimateProjectCost(modelId, Math.max(1, fileCount), 4000, embeddingModelId);
      return c.json({
        success: true,
        estimate: fallbackEstimate,
        label: "Estimate (verify against provider pricing)",
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to calculate repository estimate";
      return c.json({ error: errorMsg }, 500);
    }
  }
);
