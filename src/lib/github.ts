// all the function to interact with the GitHub API
import { Octokit } from 'octokit';
import type { any } from 'zod';
import { db } from '~/server/db';

import axios from 'axios';
import {  aiSummariseCommit } from './gemini';

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});


type Response = {
   commitMessage: string;
   commitHash: string;
   commitAuthorName: string;
   commitAuthorAvatar: string;
   commmitDate: Date;
}

export const getCommitsHashes = async (githubUrl:string):Promise<Response[]> => {
    const [owner , repo] = githubUrl.split('/').slice(-2);
    if (!owner || !repo) {
        throw new Error('Invalid GitHub URL');
    }

   const {data}= await octokit.rest.repos.listCommits({
      owner,
      repo,
      })

      const sortedCommits = data.sort((a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()) as any[];


      return sortedCommits.slice(0, 10).map((commit:any )=> ({
         commitMessage: commit.commit.message ?? '',
         commitHash: commit.sha as string,
         commitAuthorName: commit.commit?.author?.name ?? '',
         commitAuthorAvatar: commit.author?.avatar_url || '',
         commmitDate: commit.commit?.author?.date ?? " "
      }));
}


// console.log(await getCommitsHashes(githubUrl));

//!pull the commits from the github repo and filter the unprocessed commits

// export const pollCommits = async (projectId: string) => {

//    const {project, repoUrl} = await fetchProjectGithubUrl(projectId);
//    // Do something with the commits

//    const commits = await getCommitsHashes(repoUrl);

//    // get summary for only the new one answe have already have save the previous commits
//    const unprocessedCommits = await filterUnprocessedCommits(projectId, commits);

//    console.log('Unprocessed Commits:', unprocessedCommits);
// }


export const pollCommits = async (projectId: string) => {
   const githubUrl = await fetchProjectGithubUrl(projectId); // <-- Use dynamic URL
   const commitHashes = await getCommitsHashes(githubUrl);

   // get summary for only the new one answe have already have save the previous commits
   const unprocessedCommits = await filterUnprocessedCommits(projectId,  commitHashes);

   const summaryResponses = await Promise.allSettled(unprocessedCommits.map(commit=>{
      return summariseCommit(githubUrl, commit.commitHash);
   }))


   const summarise = summaryResponses.map((response) => {
      if (response.status === 'fulfilled') {
         return response.value as string;
      } 
      return ""
   });

   const commits =await db.commit.createMany({
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
         }
      })
   });

  return unprocessedCommits


}

//! the main logic take the url and hash and return the summary

async  function summariseCommit(githubUrl: string, commitHash: string) {
   //get the diff and the in ai 

   const {data}  = await  axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
      headers: {
         'Accept': 'application/vnd.github.v3.diff',
         'User-Agent': 'genai-stack',
      }
   });

   return await  aiSummariseCommit(data) || '';
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


async function filterUnprocessedCommits(projectId: string, commitHashes: Response[]) {
    const processedCommits = await db.commit.findMany({
        where: { projectId },
    });

    const unprocessedCommits = commitHashes.filter((commit) => {
        return !processedCommits.some((processed) => processed.commitHash === commit.commitHash);
    });
    return unprocessedCommits;
}
