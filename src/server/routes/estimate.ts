import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { estimateProjectCost, estimateRepoTokensFromTree } from "~/lib/estimate";
import { parseRepoUrlRef } from "~/lib/github";

const GITHUB_REQUEST_TIMEOUT = 8_000;

type GitHubTreeEntry = {
  type?: string;
  path?: string;
  size?: number;
};

type GitHubTreeResponse = {
  tree?: GitHubTreeEntry[];
};

async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  userToken?: string
): Promise<GitHubTreeResponse> {
  const headers: Record<string, string> = {
    "User-Agent": "reposense-app",
    Accept: "application/vnd.github.v3+json",
  };

  const token = userToken ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    let res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT) }
    );

    if (res.status === 401 && headers.Authorization) {
      delete headers.Authorization;
      const retryRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers, signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT) }
      );
      if (retryRes.ok) {
        res = retryRes;
      }
    }

    if (!res.ok) {
      return { tree: [] };
    }

    return (await res.json()) as GitHubTreeResponse;
  } catch {
    return { tree: [] };
  }
}

export const estimateRoutes = new Hono<AuthContext>().post(
  "/",
  zValidator(
    "json",
    z.object({
      repoUrl: z.string().min(1).max(500, "Please provide a GitHub repository URL."),
      githubToken: z.string().max(500).optional(),
      modelId: z.string().optional().default("gpt-4o"),
      embeddingModelId: z.string().optional().default("text-embedding-3-small"),
    })
  ),
  async (c) => {
    const { repoUrl, githubToken, modelId, embeddingModelId } = c.req.valid("json");

    try {
      let coordinates: ReturnType<typeof parseRepoUrlRef>;
      try {
        coordinates = parseRepoUrlRef(repoUrl);
      } catch {
        return c.json({ error: "Please provide a valid GitHub repository URL." }, 400);
      }

      const owner = coordinates.owner;
      const repo = coordinates.repo;
      const explicitBranch = coordinates.branch;

      let treeEntries: Array<{ path?: string; size?: number }> = [];

      try {
        const token = githubToken?.trim() ?? undefined;
        // Try explicit branch first, then HEAD (works for any default branch), then common fallbacks
        const branchesToTry = explicitBranch
          ? [explicitBranch]
          : ["HEAD", "main", "master"];

        for (const branch of branchesToTry) {
          const treeData = await fetchRepoTree(owner, repo, branch, token);
          if (treeData?.tree && Array.isArray(treeData.tree) && treeData.tree.length > 0) {
            treeEntries = treeData.tree
              .filter((item) => item.type === "blob")
              .map((item) => ({ path: item.path, size: item.size }));
            break;
          }
        }
      } catch {
        treeEntries = [];
      }

      if (treeEntries.length > 0) {
        const estimate = estimateRepoTokensFromTree(treeEntries, modelId, embeddingModelId);
        return c.json({
          success: true,
          estimate,
          label: "Estimate (verify against provider pricing)",
        });
      }

      const fallbackEstimate = estimateProjectCost(modelId, 45, 4000, embeddingModelId);
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
