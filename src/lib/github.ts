// Functions to interact with the GitHub API (Cloudflare Worker & Edge Compatible)
import { Octokit } from 'octokit';
import { db } from '~/server/db';
import { aiSummariseCommit } from './gemini';

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export type CommitResponse = {
  commitMessage: string;
  commitHash: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commmitDate: Date;
  id?: string;
  summary?: string;
};

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
  commits?: CommitResponse[];
};

export const getCommitsHashes = async (githubUrl: string): Promise<CommitResponse[]> => {
  const [owner, repo] = githubUrl.split('/').slice(-2);
  if (!owner || !repo) {
    throw new Error('Invalid GitHub URL');
  }

  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
  });

  const sortedCommits = [...data].sort((a: any, b: any) => {
    const dateB = b.commit?.author?.date ? new Date(b.commit.author.date).getTime() : 0;
    const dateA = a.commit?.author?.date ? new Date(a.commit.author.date).getTime() : 0;
    return dateB - dateA;
  });

  return sortedCommits.slice(0, 10).map((commit: any) => ({
    commitMessage: commit.commit?.message ?? '',
    commitHash: commit.sha as string,
    commitAuthorName: commit.commit?.author?.name ?? '',
    commitAuthorAvatar: commit.author?.avatar_url || '',
    commmitDate: commit.commit?.author?.date ? new Date(commit.commit.author.date) : new Date(),
  }));
};

export const getPullRequests = async (githubUrl: string): Promise<PullRequestResponse[]> => {
  const [owner, repo] = githubUrl.split('/').slice(-2);
  if (!owner || !repo) {
    throw new Error('Invalid GitHub URL');
  }

  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'all',
    per_page: 25,
  });

  return data.map((pr: any) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title ?? 'Untitled PR',
    state: pr.state === 'open' ? 'open' : 'closed',
    isDraft: !!pr.draft,
    authorName: pr.user?.login ?? 'Unknown',
    authorAvatar: pr.user?.avatar_url || '',
    createdAt: new Date(pr.created_at),
    updatedAt: new Date(pr.updated_at),
    htmlUrl: pr.html_url,
    branchName: pr.head?.ref ?? 'unknown',
    baseBranch: pr.base?.ref ?? 'main',
    body: pr.body ?? null,
    commits: [],
  }));
};

export async function fetchProjectGithubUrl(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { repoUrl: true },
  });

  if (!project?.repoUrl) {
    throw new Error(`Project with ID ${projectId} not found or does not have a repository URL.`);
  }
  return project.repoUrl;
}

export const getPullRequestsForProject = async (projectId: string): Promise<PullRequestResponse[]> => {
  const githubUrl = await fetchProjectGithubUrl(projectId);
  return await getPullRequests(githubUrl);
};

export const pollCommits = async (projectId: string) => {
  const githubUrl = await fetchProjectGithubUrl(projectId);
  const commitHashes = await getCommitsHashes(githubUrl);

  const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes);

  const summaryResponses = await Promise.allSettled(
    unprocessedCommits.map((commit) => {
      return summariseCommit(githubUrl, commit.commitHash);
    })
  );

  const summarise = summaryResponses.map((response) => {
    if (response.status === 'fulfilled') {
      return response.value;
    }
    return '';
  });

  await db.commit.createMany({
    data: summarise.map((summary, index) => {
      console.log(`processing commit ${index + 1} of ${unprocessedCommits.length}`);

      return {
        projectId,
        commitHash: unprocessedCommits[index]!.commitHash,
        commitMessage: unprocessedCommits[index]!.commitMessage,
        commitAuthorName: unprocessedCommits[index]!.commitAuthorName,
        commitAuthorAvatar: unprocessedCommits[index]!.commitAuthorAvatar,
        commmitDate: unprocessedCommits[index]!.commmitDate,
        summary: summary,
      };
    }),
  });

  return unprocessedCommits;
};

// Edge-safe standard fetch replaces Axios for Cloudflare compatibility
async function summariseCommit(githubUrl: string, commitHash: string) {
  try {
    const res = await fetch(`${githubUrl}/commit/${commitHash}.diff`, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
        'User-Agent': 'reposense-app',
      },
    });

    if (!res.ok) {
      return `Commit ${commitHash.slice(0, 7)}: No summary available`;
    }

    const diff = await res.text();
    return (await aiSummariseCommit(diff)) || '';
  } catch (error) {
    console.error(`Failed to summarise commit ${commitHash}:`, error);
    return `Commit ${commitHash.slice(0, 7)}: Summary generation failed`;
  }
}

async function filterUnprocessedCommits(projectId: string, commitHashes: CommitResponse[]) {
  const processedCommits = await db.commit.findMany({
    where: { projectId },
  });

  const unprocessedCommits = commitHashes.filter(
    (commit) => !processedCommits.some((processedCommit) => processedCommit.commitHash === commit.commitHash)
  );
  return unprocessedCommits;
}
