import { Octokit } from 'octokit';
import { decryptKey, getEncryptionSecret } from './providers/crypto';

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
  const raw = repoUrl.trim();
  let owner: string | undefined;
  let repo: string | undefined;

  const scp = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(raw);
  if (scp?.[1] && scp[2]) {
    owner = scp[1];
    repo = scp[2];
  } else {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const url = new URL(withProtocol);
      if (url.hostname.toLowerCase() !== 'github.com' && url.hostname.toLowerCase() !== 'www.github.com') {
        throw new Error('not github');
      }

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length !== 2) throw new Error('not a repo path');
      owner = parts[0];
      repo = parts[1]?.replace(/\.git$/i, '');
    } catch {
      throw new GitHubAccessError(
        'NOT_FOUND',
        'Only GitHub repositories are supported. Use a URL like https://github.com/owner/repo.'
      );
    }
  }

  const validSegment = (value: string) =>
    value.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(value) && !/^\.+$/.test(value);

  if (!owner || !repo || !validSegment(owner) || !validSegment(repo)) {
    throw new GitHubAccessError(
      'NOT_FOUND',
      'Only GitHub repositories are supported. Use a URL like https://github.com/owner/repo.'
    );
  }

  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
}

export function getOctokit(token?: string | null) {
  const trimmedToken = token?.trim();
  const authToken = trimmedToken ?? process.env.GITHUB_TOKEN;
  return new Octokit({
    ...(authToken ? { auth: authToken } : {}),
    request: { timeout: 20_000 },
  });
}

export const octokit = getOctokit();

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
  if (err instanceof GitHubAccessError) throw err;

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
  throw new GitHubAccessError('UNKNOWN', e?.message ?? 'GitHub request failed.');
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

    if (data.private && !token?.trim()) {
      throw new GitHubAccessError(
        'NOT_FOUND',
        'Repository not found or you do not have access to it. Add a GitHub token to index private repositories.'
      );
    }

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

export type RepoBranchKind = 'MAIN' | 'BRANCH' | 'PULL_REQUEST';

export interface RepoRefRequest {
  branch?: string | null;
  pullRequestNumber?: number | null;
}

export interface ResolvedRepoRef {
  owner: string;
  repo: string;
  repoUrl: string;
  fetchOwner: string;
  fetchRepo: string;
  branch: string;
  branchKind: RepoBranchKind;
  pullRequestNumber: number | null;
  commitSha: string;
  defaultBranch: string;
  isPrivate: boolean;
  sizeKb: number;
}

export function normalizeBranchName(value: string): string {
  const branch = value.trim().replace(/^refs\/heads\//i, '');

  if (!branch) {
    throw new GitHubAccessError('NOT_FOUND', 'Enter a branch name or pull request number.');
  }
  if (
    branch.length > 255 ||
    branch.startsWith('/') ||
    branch.endsWith('/') ||
    branch.startsWith('.') ||
    branch.endsWith('.') ||
    branch.endsWith('.lock') ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch === '@' ||
    branch.includes('//') ||
    /[\u0000-\u0020]/.test(branch) ||
    /[~^:?*\[\]\\]/.test(branch)
  ) {
    throw new GitHubAccessError('NOT_FOUND', 'That branch name is not valid for GitHub.');
  }

  return branch;
}

export async function resolveRepoRef(
  repoUrl: string,
  input: RepoRefRequest = {},
  token?: string | null
): Promise<ResolvedRepoRef> {
  const meta = await getRepoMetadata(repoUrl, token);
  const client = getOctokit(token);

  try {
    if (input.pullRequestNumber) {
      const pullNumber = input.pullRequestNumber;
      if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) {
        throw new GitHubAccessError('NOT_FOUND', 'Pull request number is not valid.');
      }

      const { data: pull } = await client.rest.pulls.get({
        owner: meta.owner,
        repo: meta.repo,
        pull_number: pullNumber,
      });

      return {
        owner: meta.owner,
        repo: meta.repo,
        repoUrl: meta.repoUrl,
        fetchOwner: pull.head.repo?.owner?.login ?? meta.owner,
        fetchRepo: pull.head.repo?.name ?? meta.repo,
        branch: pull.head.ref || `pull-${pullNumber}`,
        branchKind: 'PULL_REQUEST',
        pullRequestNumber: pullNumber,
        commitSha: pull.head.sha,
        defaultBranch: meta.defaultBranch,
        isPrivate: meta.isPrivate,
        sizeKb: meta.sizeKb,
      };
    }

    const branch = input.branch?.trim()
      ? normalizeBranchName(input.branch)
      : meta.defaultBranch;
    const kind: RepoBranchKind = branch === meta.defaultBranch ? 'MAIN' : 'BRANCH';

    const { data: ref } = await client.rest.git.getRef({
      owner: meta.owner,
      repo: meta.repo,
      ref: `heads/${branch}`,
    });

    return {
      owner: meta.owner,
      repo: meta.repo,
      repoUrl: meta.repoUrl,
      fetchOwner: meta.owner,
      fetchRepo: meta.repo,
      branch,
      branchKind: kind,
      pullRequestNumber: null,
      commitSha: ref.object.sha,
      defaultBranch: meta.defaultBranch,
      isPrivate: meta.isPrivate,
      sizeKb: meta.sizeKb,
    };
  } catch (err) {
    if (err instanceof GitHubAccessError) throw err;
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
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${encodedPath}`;
  const headers: Record<string, string> = { 'User-Agent': 'reposense-app' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
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
        const binary = atob(data.content.replace(/\n/g, ''));
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
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
  labels: string[];
  mergedAt: Date | null;
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
      authorAvatar: pr.user?.avatar_url ?? '',
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      htmlUrl: pr.html_url,
      branchName: pr.head?.ref ?? 'unknown',
      baseBranch: pr.base?.ref ?? 'main',
      body: pr.body ?? null,
      labels: (pr.labels ?? []).map((label) =>
        typeof label === 'string' ? label : (label.name ?? '')
      ).filter(Boolean),
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
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
