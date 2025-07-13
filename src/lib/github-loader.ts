// fcuniton that githb url and give all the files in it 


import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';

import { Document } from '@langchain/core/documents';
import { summarizeCode } from './gemini';
import { SourceCode } from 'eslint';
import { json } from 'stream/consumers';
import { db } from '~/server/db';

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


//load the file and generate embeddings for each file

export const indexGithubRepo = async (repoUrl: string, githubToken?: string, projectId?: string) => {
  const docs = await loadGithubRepo(repoUrl, githubToken);
  const allEmbedding = await generateEmbeddingsForDocs(docs);

  await Promise.allSettled(allEmbedding.map(async (embedding, index) => {
    console.log(`File: ${index}, Summary: ${allEmbedding.length}`);
    if (!embedding) return;

    const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
      data: { 
        summary: embedding.summary,
        embedding: embedding.embedding,
        fileName: embedding.fileName,
        sourceCode: embedding.SourceCode,
        projectId,
      }
    });

    await db.$executeRaw`UPDATE "SourceCodeEmbedding" SET "summaryEmbedding" = ${embedding.embedding} :: vector WHERE "id" = ${sourceCodeEmbedding.id}`;
  }));

  return docs;
}

// Generate embeddings for each file in the repo
const generateEmbeddingsForDocs = async (docs: Document[]) => {
  return await Promise.all(
    docs.map(async doc => {
      const summary = await summarizeCode(doc);
      const embedding = await generateEmbeddings(summary);
      return {
        summary,
        embedding,
        SourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
        fileName: doc.metadata.source,
      };
    })
  );
}