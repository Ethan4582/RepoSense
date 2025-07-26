// fcuniton that githb url and give all the files in it 


import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';

import { Document } from '@langchain/core/documents';
import { generateEmbeddings, summarizeCode } from './gemini';
import { SourceCode } from 'eslint';
import { json } from 'stream/consumers';
import { db } from '~/server/db';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to detect complex files that might need more time
function isComplexFile(fileName: string, content: string): boolean {
  return content.length > 20000 || 
         fileName.includes('test') || 
         fileName.endsWith('.json');
}

export const loadGithubRepo = async (repoUrl: string, githubToken?: string) => {
  try {
    // Always try to use a token to avoid rate limits
    const token = githubToken || process.env.GITHUB_TOKEN;
    
    if (!token) {
      console.warn("⚠️ No GitHub token provided! You will hit rate limits quickly.");
    }
    
    const loader = new GithubRepoLoader(repoUrl, {
      accessToken: token, // Use the token here
      branch: "main",
      ignoreFiles: [
        "packages-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock",
        "node_modules", ".git", "dist", "build"
      ],
      recursive: true,
      unknown: 'warn',
      maxConcurrency: 2, // Lower this to avoid hitting limits
    });

    try {
      const docs = await loader.load();
      return docs;
    } catch (error: any) {
      // Better error handling for GitHub rate limits
      if (error.message?.includes('rate limit exceeded')) {
        throw new Error("GitHub API rate limit exceeded. Please provide a valid GitHub token or try again later.");
      }
      throw error;
    }
  } catch (error) {
    console.error("Error loading GitHub repo:", error);
    throw error;
  }
};


//load the file and generate embeddings for each file

export const indexGithubRepo = async (repoUrl: string, githubToken?: string, projectId?: string) => {
  try {
    // Step 1: Load all documents from GitHub
    console.log("🔍 Loading repository files...");
    const docs = await loadGithubRepo(repoUrl, githubToken);
    console.log(`📚 Found ${docs.length} files in repository`);
    
    // Step 2: First summarize ALL files with extreme rate limiting
    console.log("📝 Beginning file summarization phase (minimum 5 minutes)...");
    const summaries = await summarizeAllFilesSequentially(docs);
    console.log(`✅ Summarized ${summaries.length} files successfully`);
    
    // Step 3: Generate embeddings for all summaries with rate limiting
    console.log("🧠 Beginning embedding generation phase...");
    const embeddingsData = await generateEmbeddingsSequentially(summaries);
    console.log(`✅ Generated embeddings for ${embeddingsData.length} summaries`);
    
    // Step 4: Save all data to database sequentially
    console.log("💾 Saving data to database...");
    for (let i = 0; i < embeddingsData.length; i++) {
      const item = embeddingsData[i];
      try {
        console.log(`Saving data for ${item.fileName} (${i+1}/${embeddingsData.length})`);
        
        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
          data: { 
            summary: item.summary,
            // Remove embedding from here - it's not in your schema
            fileName: item.fileName,
            sourceCode: item.sourceCode,
            projectId,
          }
        });
        
        // Keep this part which correctly updates the vector field
        await db.$executeRaw`UPDATE "SourceCodeEmbedding" SET "summaryEmbedding" = ${item.embedding} :: vector WHERE "id" = ${sourceCodeEmbedding.id}`;
        
        // Small delay between DB operations
        await sleep(1000);
      } catch (error) {
        console.error(`Error saving data for ${item.fileName}:`, error);
      }
    }
    
    console.log("🎉 Repository processing complete!");
    return docs;
  } catch (error) {
    console.error("❌ Error in indexGithubRepo:", error);
    throw error;
  }
};

// STEP 2: Summarize all files with extreme rate limiting
async function summarizeAllFilesSequentially(docs: Document[]) {
  const summaries = [];
  const totalFiles = docs.length;
  const startTime = Date.now();
  const minimumTotalDuration = 10 * 1000; // 10 seconds minimum (reduced from 5 minutes)
  
  console.log(`Starting summarization of ${totalFiles} files`);
  
  for (let i = 0; i < totalFiles; i++) {
    const doc = docs[i];
    const fileName = doc.metadata.source;
    console.log(`Summarizing file ${i+1}/${totalFiles}: ${fileName}`);
    
    try {
      // Try to summarize with retry logic
      let summary = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          // Calculate delay based on file complexity
          const baseDelay = isComplexFile(fileName, doc.pageContent) ? 30000 : 15000; // 15-30 sec per file
          
          summary = await summarizeCode(doc);
          console.log(`✓ Successfully summarized ${fileName}`);
          break; // Success, exit retry loop
        } catch (error: any) {
          attempts++;
          console.error(`Attempt ${attempts}/${maxAttempts} failed for ${fileName}:`, error.message);
          
          if (error.status === 429 || error.message?.includes('rate limit')) {
            // If rate limited, wait longer
            const backoffTime = Math.pow(2, attempts) * 30000; // 30s, 60s, 120s
            console.log(`⏳ Rate limit hit, waiting ${backoffTime/1000}s before retry...`);
            await sleep(backoffTime);
          } else if (attempts < maxAttempts) {
            // For other errors, wait a bit less
            await sleep(10000); // 10 seconds
          } else {
            // Max attempts reached
            console.error(`❌ Failed to summarize ${fileName} after ${maxAttempts} attempts`);
            throw error;
          }
        }
      }
      
      if (summary) {
        summaries.push({
          fileName,
          summary,
          sourceCode: doc.pageContent
        });
      }

      // Ensure minimum delay between API calls (4-6 seconds)
      const baseDelay = isComplexFile(fileName, doc.pageContent) ? 4000 : 2000;
      console.log(`⏳ Waiting ${baseDelay/1000}s before next summarization...`);
      await sleep(baseDelay);
      
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error);
      // Continue with next file
    }
  }
  
  // Check if we need to wait longer to meet minimum duration
  const elapsed = Date.now() - startTime;
  const remaining = minimumTotalDuration - elapsed;
  
  if (remaining > 0) {
    console.log(`⏳ Enforcing minimum processing time - waiting ${remaining/1000}s more...`);
    await sleep(remaining);
  }
  
  console.log(`📊 Summary statistics: ${summaries.length}/${totalFiles} files successfully summarized`);
  return summaries;
}

// STEP 3: Generate embeddings sequentially with rate limiting
async function generateEmbeddingsSequentially(summaries: Array<{fileName: string, summary: string, sourceCode: string}>) {
  const results = [];
  const totalSummaries = summaries.length;
  
  console.log(`Starting embedding generation for ${totalSummaries} summaries`);
  
  for (let i = 0; i < totalSummaries; i++) {
    const { fileName, summary, sourceCode } = summaries[i];
    console.log(`Generating embedding ${i+1}/${totalSummaries}: ${fileName}`);
    
    try {
      // Try to generate embedding with retry logic
      let embedding = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          embedding = await generateEmbeddings(summary);
          console.log(`✓ Successfully generated embedding for ${fileName}`);
          break; // Success, exit retry loop
        } catch (error: any) {
          attempts++;
          console.error(`Attempt ${attempts}/${maxAttempts} failed for ${fileName}:`, error.message);
          
          if (error.status === 429 || error.message?.includes('rate limit')) {
            // If rate limited, wait longer
            const backoffTime = Math.pow(2, attempts) * 30000; // 30s, 60s, 120s
            console.log(`⏳ Rate limit hit, waiting ${backoffTime/1000}s before retry...`);
            await sleep(backoffTime);
          } else if (attempts < maxAttempts) {
            // For other errors, wait a bit less
            await sleep(10000);
          } else {
            // Max attempts reached
            console.error(`❌ Failed to generate embedding for ${fileName} after ${maxAttempts} attempts`);
            throw error;
          }
        }
      }
      
      if (embedding) {
        results.push({
          fileName,
          summary,
          embedding,
          sourceCode
        });
      }

      // Fixed delay between API calls (4-6 seconds)
      const delay = 2000 + Math.random() * 2000; // 4-6 seconds
      console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next embedding...`);
      await sleep(delay);
      
    } catch (error) {
      console.error(`Error generating embedding for ${fileName}:`, error);
      // Continue with next summary
    }
  }
  
  console.log(`📊 Embedding statistics: ${results.length}/${totalSummaries} embeddings successfully generated`);
  return results;
}