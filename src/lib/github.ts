import { Octokit } from 'octokit';
import { decryptKey } from './providers/crypto';

export interface RepoCoordinates {
  owner: string;
  repo: string;
  repoUrl: string;
}

export class GitHubAccessError extends Error {
  readonly code: 'INVALID_TOKEN' | 'NOT_FOUND' | 'UNKNOWN';

  constructor(code: GitHubAccessError['code'], message: string) {
    super(message);
    this.name = 'GitHubAccessError';
    this.code = code;
  }
}

export function parseRepoUrl(repoUrl: string): RepoCoordinates {
  const cleaned = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = /github\.com[/:]([^/]+)\/([^/]+)/i.exec(cleaned);

  if (!match?.[1] || !match[2]) {
    throw new GitHubAccessError(
      'NOT_FOUND',
      'Only GitHub repositories are supported. Use a URL like https://github.com/owner/repo.'
    );
  }

  const owner = match[1];
  const repo = match[2];
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
}

export function getOctokit(token?: string | null) {
  const authToken = token?.trim() || process.env.GITHUB_TOKEN;
  return new Octokit(authToken ? { auth: authToken } : {});
}

export const octokit = getOctokit();

export function getEncryptionSecret(): string {
  return (
    process.env.ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  );
}

export async function decryptProjectToken(
  project: { encryptedGithubToken?: string | null; githubTokenIv?: string | null }
): Promise<string | null> {
  if (!project.encryptedGithubToken || !project.githubTokenIv) return null;
  try {
    return await decryptKey(
      { encryptedKey: project.encryptedGithubToken, iv: project.githubTokenIv },
      getEncryptionSecret()
    );
  } catch {
    throw new GitHubAccessError(
      'INVALID_TOKEN',
      'Your GitHub Personal Access Token could not be decrypted. Please re-enter it in project settings.'
    );
  }
}

function isBadCredentials(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 401 || Boolean(e?.message?.includes('Bad credentials'));
}

function wrapGithubError(err: unknown, hasToken: boolean): never {
  if (isBadCredentials(err)) {
    throw new GitHubAccessError(
      'INVALID_TOKEN',
      hasToken
        ? 'Your GitHub Personal Access Token is invalid or expired. Please remove it for public repos or provide a new token.'
        : 'GitHub rejected the request. The repository may be private; add a valid GitHub token.'
    );
  }
  const e = err as { status?: number; message?: string };
  if (e?.status === 404) {
    throw new GitHubAccessError('NOT_FOUND', 'Repository not found or you do not have access to it.');
  }
  throw new GitHubAccessError('UNKNOWN', e?.message || 'GitHub request failed.');
}

export async function getRepoMetadata(
  repoUrl: string,
  token?: string | null
): Promise<{
  owner: string;
  repo: string;
  repoUrl: string;
  defaultBranch: string;
  commitSha: string;
  isPrivate: boolean;
  sizeKb: number;
}> {
  const { owner, repo, repoUrl: normalized } = parseRepoUrl(repoUrl);
  const client = getOctokit(token);

  try {
    const { data } = await client.rest.repos.get({ owner, repo });
    const ref = await client.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${data.default_branch}`,
    });

    return {
      owner,
      repo,
      repoUrl: normalized,
      defaultBranch: data.default_branch,
      commitSha: ref.data.object.sha,
      isPrivate: data.private,
      sizeKb: data.size,
    };
  } catch (err) {
    wrapGithubError(err, Boolean(token));
  }
}

export interface RepoTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha?: string;
}

export async function getRepoTree(
  owner: string,
  repo: string,
  commitSha: string,
  token?: string | null
): Promise<RepoTreeEntry[]> {
  const client = getOctokit(token);
  try {
    const { data } = await client.rest.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: 'true',
    });
    return data.tree as RepoTreeEntry[];
  } catch (err) {
    wrapGithubError(err, Boolean(token));
  }
}

export async function fetchRawFile(
  owner: string,
  repo: string,
  commitSha: string,
  path: string,
  token?: string | null
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${path}`;
  const headers: Record<string, string> = { 'User-Agent': 'reposense-app' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (res.ok) return await res.text();

  if (res.status === 404) {
    // Private repos may not allow raw access with a Bearer token.
    if (!token) return null;
    const client = getOctokit(token);
    try {
      const { data } = await client.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: commitSha,
      });
      if (!Array.isArray(data) && data.type === 'file' && 'content' in data) {
        return atob(data.content.replace(/\n/g, ''));
      }
      return null;
    } catch (err) {
      wrapGithubError(err, true);
    }
  }

  return null;
}

export type PullRequestResponse = {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  isDraft: boolean;
  authorName: string;
  authorAvatar: string;
  createdAt: Date;
  updatedAt: Date;
  htmlUrl: string;
  branchName: string;
  baseBranch: string;
  body?: string | null;
};

export const getPullRequests = async (
  githubUrl: string,
  token?: string | null
): Promise<PullRequestResponse[]> => {
  const { owner, repo } = parseRepoUrl(githubUrl);
  const client = getOctokit(token);

  try {
    const res = await client.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      per_page: 50,
    });

    return res.data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title ?? 'Untitled PR',
      state: pr.state === 'open' ? 'open' : 'closed',
      isDraft: Boolean(pr.draft),
      authorName: pr.user?.login ?? 'Unknown',
      authorAvatar: pr.user?.avatar_url || '',
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      htmlUrl: pr.html_url,
      branchName: pr.head?.ref ?? 'unknown',
      baseBranch: pr.base?.ref ?? 'main',
      body: pr.body ?? null,
    }));
  } catch (err) {
    wrapGithubError(err, Boolean(token));
  }
};

export async function fetchProjectGithubDetails(projectId: string) {
  const { db } = await import('~/server/db');
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      repoUrl: true,
      encryptedGithubToken: true,
      githubTokenIv: true,
    },
  });

  if (!project?.repoUrl) {
    throw new Error(`Project with ID ${projectId} not found or does not have a repository URL.`);
  }

  const githubToken = await decryptProjectToken(project);
  return { repoUrl: project.repoUrl, githubToken };
}

export async function fetchProjectGithubUrl(projectId: string) {
  const details = await fetchProjectGithubDetails(projectId);
  return details.repoUrl;
}

export const getPullRequestsForProject = async (
  projectId: string
): Promise<PullRequestResponse[]> => {
  const { repoUrl, githubToken } = await fetchProjectGithubDetails(projectId);
  return getPullRequests(repoUrl, githubToken);
};
