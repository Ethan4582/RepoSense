import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Octokit } from "octokit";
import type { AuthContext } from "../auth";
import { estimateProjectCost, estimateRepoTokensFromTree } from "~/lib/estimate";

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

export const estimateRoutes = new Hono<AuthContext>().post(
  "/",
  zValidator(
    "json",
    z.object({
      repoUrl: z.string().regex(GITHUB_REPO_REGEX, "Please provide a valid, public GitHub repository URL."),
      githubToken: z.string().optional(),
      modelId: z.string().optional().default("gemini-2.5-flash"),
      embeddingModelId: z.string().optional().default("gemini-embedding-001"),
    })
  ),
  async (c) => {
    const { repoUrl, githubToken, modelId, embeddingModelId } = c.req.valid("json");

    try {
      const match = repoUrl.trim().match(GITHUB_REPO_REGEX);
      if (!match || !match[1] || !match[2]) {
        return c.json({ error: "Please provide a valid, public GitHub repository URL." }, 400);
      }

      const owner = match[1];
      const repo = match[2];

      const token = githubToken || process.env.GITHUB_TOKEN;
      const octokit = new Octokit({ auth: token });

      // Check reachability of the public/accessible repository
      let defaultBranch = "main";
      try {
        const repoData = await octokit.rest.repos.get({ owner, repo });
        defaultBranch = repoData.data.default_branch || "main";
      } catch (repoErr) {
        // Block estimation on invalid or unreachable repository
        return c.json(
          { error: "Please provide a valid, public GitHub repository URL." },
          400
        );
      }

      // Fetch repository tree (recursive)
      let fileCount = 0;
      let treeEntries: Array<{ path?: string; size?: number }> = [];

      try {
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
        // Fallback file count if tree endpoint hits rate limits
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
