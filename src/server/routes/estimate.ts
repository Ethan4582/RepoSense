import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import { estimateProjectCost, estimateRepoTokensFromTree } from "~/lib/estimate";
import { parseRepoUrlRef } from "~/lib/github";

const GITHUB_REQUEST_TIMEOUT = 20_000;

type GitHubRepoResponse = {
  private?: boolean;
  default_branch?: string;
};

type GitHubTreeEntry = {
  type?: string;
  path?: string;
  size?: number;
};

type GitHubTreeResponse = {
  tree?: GitHubTreeEntry[];
};

async function checkGitHubRepo(
  owner: string,
  repo: string,
  userToken?: string
): Promise<GitHubRepoResponse> {
  const headers: Record<string, string> = {
    "User-Agent": "reposense-app",
    Accept: "application/vnd.github.v3+json",
  };

  const token = userToken ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT),
  });

  // If token is invalid or unauthorized, retry unauthenticated for public repositories
  if (res.status === 401 && headers.Authorization) {
    delete headers.Authorization;
    const retryRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT),
    });
    if (retryRes.ok) {
      res = retryRes;
    } else {
      throw new Error("GitHub authentication failed (401 Bad credentials). The provided GitHub token may be expired or invalid. Please check your token or use a public repository.");
    }
  }

  if (!res.ok) {
    throw new Error("Repository not found or inaccessible. Please verify the URL or provide a valid GitHub token.");
  }

  const data = (await res.json()) as GitHubRepoResponse;
  if (data?.private && !userToken?.trim()) {
    throw new Error("Repository not found or inaccessible. Please provide a GitHub token for private repositories.");
  }
  return data;
}

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
}

export const estimateRoutes = new Hono<AuthContext>().post(
  "/",
  zValidator(
    "json",
    z.object({
      repoUrl: z.string().min(1).max(500, "Please provide a GitHub repository URL."),
      githubToken: z.string().max(500).optional(),
      modelId: z.string().optional().default("gpt-6.1-sol"),
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

      // Check reachability of the repository
      let defaultBranch = "main";
      try {
        const repoData = await checkGitHubRepo(owner, repo, githubToken?.trim() ?? undefined);
        defaultBranch = repoData.default_branch ?? "main";
      } catch {
        return c.json(
          { error: "Please provide a valid, public GitHub repository URL." },
          400
        );
      }

      // Fetch repository tree (recursive)
      let fileCount = 0;
      let treeEntries: Array<{ path?: string; size?: number }> = [];

      try {
        const treeData = await fetchRepoTree(owner, repo, coordinates.branch ?? defaultBranch, githubToken?.trim() ?? undefined);

        if (treeData && Array.isArray(treeData.tree)) {
          treeEntries = treeData.tree
            .filter((item) => item.type === "blob")
            .map((item) => ({ path: item.path, size: item.size }));
          fileCount = treeEntries.length;
        }
      } catch {
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

