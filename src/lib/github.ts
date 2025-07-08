
// all the function to interact with the GitHub API
import { Octokit } from 'octokit';
import type { any } from 'zod';
import { db } from '~/server/db';


export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});


const githubUrl= 'https://github.com/docker/genai-stack';


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


export const pollCommits = async (projectId: string) => {

   const [project, githubUrl] = await fetchProjectGithubUrl(projectId);
   // Do something with the commits

   const commits = await getCommitsHashes(githubUrl);

   // get summary for only the new one answe have already have save the previous commits
   const unprocessedCommits = await filterUnprocessedCommits(projectId, commits);

   console.log('Unprocessed Commits:', unprocessedCommits);
}




async  function summariseCommit(githubUrl: string, commitHash: string) {
   
}



async function fetchProjectGithubUrl(projectId:string) {
   const project = await db.project.findUnique({
      where: {
         id: projectId,
      },
      select:{
         repoUrl: true,
      }
   });

   if( !project?.repoUrl) {
      throw new Error(`Project with ID ${projectId} not found or does not have a Commit.`);
   }
   return [project ,githubUrl , project.repoUrl];
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


 pollCommits('cmctv2gx40000hrr8k4kc44z4').then(console.log).catch(console.error);