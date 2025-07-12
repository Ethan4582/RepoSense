// fcuniton that githb url and give all the files in it 


import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';

export const loadGithubRepo = async (repoUrl: string, githubToken?: string) => {
  const loader = githubToken
    ? new GithubRepoLoader(repoUrl, {
        accessToken: githubToken,
        branch: "main",
        ignoreFiles: [
          "packages-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock",
          "node_modules", ".git", "dist", "build"
        ],
        recursive: true,
        unknown: 'warn',
        maxConcurrency: 5,
      })
    : new GithubRepoLoader(repoUrl, {
        branch: "main",
        ignoreFiles: [
          "packages-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock",
          "node_modules", ".git", "dist", "build"
        ],
        recursive: true,
        unknown: 'warn',
        maxConcurrency: 5,
      });

  const docs = await loader.load();
  return docs;
};

console.log(await loadGithubRepo('https://github.com/Elliott-Chong/chatpdf-yt'));