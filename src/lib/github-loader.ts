import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';
import { type Document } from '@langchain/core/documents';
import { generateEmbeddings, summarizeCode } from './gemini';
import { db } from '~/server/db';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isComplexFile(fileName: string, content: string): boolean {
  return content.length > 20000 ||
    fileName.includes('test') ||
    fileName.endsWith('.json');
}

function cleanRepoFileName(doc: Document): string {
  const raw = doc.metadata?.source ?? doc.metadata?.path ?? "unknown";
  if (typeof raw !== 'string') return "unknown";
  const blobMatch = raw.match(/blob\/[^/]+\/(.+)$/);
  if (blobMatch?.[1]) {
    return blobMatch[1];
  }
  return raw.replace(/^[/\\]+/, '');
}

export const loadGithubRepo = async (repoUrl: string, githubToken?: string) => {
  try {
    // Always try to use a token to avoid rate limits
    const token = githubToken || process.env.GITHUB_TOKEN;

    if (!token) {
      console.warn("⚠️ No GitHub token provided! You will hit rate limits quickly.");
    }

    const loader = new GithubRepoLoader(repoUrl, {
      accessToken: token,
      ignoreFiles: [
        // Dependency lock files
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lock",
        "shrinkwrap.yaml",

        // Dependency directories
        "node_modules",
        ".yarn",
        ".pnp",
        ".yarn/cache",
        ".yarn/unplugged",
        ".yarn/install-state.gz",

        // Build outputs
        "dist",
        "build",
        "out",
        ".next",
        ".nuxt",
        ".output",
        ".turbo",
        ".vercel",

        // Cache and temp
        ".cache",
        ".parcel-cache",
        ".npm",
        ".eslintcache",

        // Environment and secrets
        ".env",
        ".env.local",
        ".env.development",
        ".env.test",
        ".env.production",
        "*.pem",
        "*.key",
        "*.cert",

        // Binary and media files
        "*.png",
        "*.jpg",
        "*.jpeg",
        "*.gif",
        "*.svg",
        "*.ico",
        "*.webp",
        "*.avif",
        "*.mp4",
        "*.webm",
        "*.ogg",
        "*.mp3",
        "*.wav",
        "*.flac",
        "*.pdf",
        "*.zip",
        "*.tar.gz",
        "*.tgz",
        "*.rar",
        "*.7z",
        "*.wasm",
        "*.exe",
        "*.dll",
        "*.so",
        "*.dylib",

        // Fonts
        "*.woff",
        "*.woff2",
        "*.ttf",
        "*.eot",
        "*.otf",

        // Large data files
        "*.csv",
        "*.tsv",
        "*.parquet",
        "*.sql",
        "*.dump",
        "*.sqlite",
        "*.db",

        // IDE files
        ".vscode",
        ".idea",
        "*.swp",
        "*.swo",
        ".DS_Store",
        "Thumbs.db",

        // Logs
        "logs",
        "*.log",
        "npm-debug.log*",
        "yarn-debug.log*",
        "yarn-error.log*",
        "pnpm-debug.log*",

        // Coverage reports
        "coverage",
        ".nyc_output",
        "*.lcov",

        // Temporary files
        ".tmp",
        ".temp",
        "temp",
        "tmp",
        "*.tmp",
        "*.temp",

        // Version control
        ".git",
        ".svn",
        ".hg",

        // Documentation
        "CHANGES.md",
        "CHANGELOG.md",
        "LICENSE.md",
        "LICENSE.txt",

        // Config overrides
        ".eslintignore",
        ".prettierignore",
        ".stylelintignore",

        // Miscellaneous
        ".yarnrc.yml",
        ".yarnrc",
        ".npmrc",
        ".prettierrc",
        ".eslintrc.js",
        ".stylelintrc.js",
        "jest.config.js",
        "webpack.config.js",
        "vite.config.js",
        "tsconfig.json",
        "jsconfig.json",
        ".dockerignore",
        ".gitattributes",
        ".gitignore",
        ".editorconfig",
        ".babelrc",
        ".commitlintrc.js"
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
      const embedding = embeddingsData[i];
      if (!embedding) continue; // Type guard: skip if undefined

      try {
        console.log(`Saving data for ${embedding.fileName} (${i + 1}/${embeddingsData.length})`);

        const data: any = {
          summary: embedding.summary,
          fileName: embedding.fileName,
          sourceCode: embedding.sourceCode,
        };
        if (projectId !== undefined) {
          data.projectId = projectId;
        }

        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
          data
        });

        await db.$executeRaw`UPDATE "SourceCodeEmbedding" SET "summaryEmbeddingGemini" = ${embedding.embedding} :: vector WHERE "id" = ${sourceCodeEmbedding.id}`;

        await sleep(1000);
      } catch (error) {
        console.error(`Error saving data for ${embedding?.fileName ?? "unknown"}:`, error);
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
    if (!doc) continue; // Type guard: skip if undefined
    const fileName = cleanRepoFileName(doc);
    console.log(`Summarizing file ${i + 1}/${totalFiles}: ${fileName}`);

    try {
      // Try to summarize with retry logic
      let summary = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          summary = await summarizeCode(doc);
          console.log(`✓ Successfully summarized ${fileName}`);
          break; // Success, exit retry loop
        } catch (error: any) {
          attempts++;
          console.error(`Attempt ${attempts}/${maxAttempts} failed for ${fileName}:`, error.message);

          if (error.status === 429 || error.message?.includes('rate limit')) {
            // If rate limited, wait longer
            const backoffTime = Math.pow(2, attempts) * 30000; // 30s, 60s, 120s
            console.log(`⏳ Rate limit hit, waiting ${backoffTime / 1000}s before retry...`);
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
      console.log(`⏳ Waiting ${baseDelay / 1000}s before next summarization...`);
      await sleep(baseDelay);
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error);
    }
  }

  // Check if we need to wait longer to meet minimum duration
  const elapsed = Date.now() - startTime;
  if (elapsed < minimumTotalDuration) {
    const remainingTime = minimumTotalDuration - elapsed;
    console.log(`⏳ Waiting additional ${remainingTime / 1000}s to meet minimum duration requirement...`);
    await sleep(remainingTime);
  }

  return summaries;
}

// STEP 3: Generate embeddings for all summaries with rate limiting
async function generateEmbeddingsSequentially(summaries: Array<{ fileName: string, summary: string, sourceCode: string }>) {
  const embeddings = [];
  const totalSummaries = summaries.length;

  console.log(`Starting embedding generation for ${totalSummaries} summaries`);

  for (let i = 0; i < totalSummaries; i++) {
    const summaryObj = summaries[i];
    if (!summaryObj) continue; // Type guard: skip if undefined
    const { fileName, summary, sourceCode } = summaryObj;
    console.log(`Generating embedding ${i + 1}/${totalSummaries}: ${fileName}`);

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
            console.log(`⏳ Rate limit hit, waiting ${backoffTime / 1000}s before retry...`);
            await sleep(backoffTime);
          } else if (attempts < maxAttempts) {
            // For other errors, wait a bit less
            await sleep(10000); // 10 seconds
          } else {
            // Max attempts reached
            console.error(`❌ Failed to generate embedding for ${fileName} after ${maxAttempts} attempts`);
            throw error;
          }
        }
      }

      if (embedding) {
        embeddings.push({
          fileName,
          summary,
          sourceCode,
          embedding
        });
      }

      // Ensure minimum delay between API calls (4-6 seconds)
      const baseDelay = 4000; // 4 seconds between embeddings
      console.log(`⏳ Waiting ${baseDelay / 1000}s before next embedding...`);
      await sleep(baseDelay);
    } catch (error) {
      console.error(`Error generating embedding for ${fileName}:`, error);
    }
  }

  return embeddings;
}
