// all the function to interact with the GitHub API
import { Octokit } from 'octokit';
import { db } from '~/server/db';
import axios from 'axios';
import { aiSummariseCommit } from './gemini';

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

type CommitResponse = {
  commitMessage: string;
  commitHash: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commmitDate: Date;
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
      return response.value as string;
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

async function summariseCommit(githubUrl: string, commitHash: string) {
  const { data } = await axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
    headers: {
      Accept: 'application/vnd.github.v3.diff',
      'User-Agent': 'genai-stack',
    },
  });

  return (await aiSummariseCommit(data)) || '';
}

async function fetchProjectGithubUrl(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { repoUrl: true },
  });

  if (!project?.repoUrl) {
    throw new Error(`Project with ID ${projectId} not found or does not have a Commit.`);
  }
  return project.repoUrl;
}

async function filterUnprocessedCommits(projectId: string, commitHashes: CommitResponse[]) {
  const processedCommits = await db.commit.findMany({
    where: { projectId },
  });

  const unprocessedCommits = commitHashes.filter((commit) => {
    return !processedCommits.some((processed) => processed.commitHash === commit.commitHash);
  });
  return unprocessedCommits;
}
