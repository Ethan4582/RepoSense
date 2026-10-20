import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';
import { type Document } from '@langchain/core/documents';
import { generateEmbeddings, summarizeCode } from './gemini';
import { db } from '~/server/db';

function cleanRepoFileName(doc: Document): string {
  const raw = doc.metadata?.source ?? doc.metadata?.path ?? "unknown";
  if (typeof raw !== 'string') return "unknown";
  const blobMatch = raw.match(/blob\/[^/]+\/(.+)$/);
  if (blobMatch?.[1]) {
    return blobMatch[1];
  }
  return raw.replace(/^[/\\\\]+/, '');
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await fn(item, index);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

export const loadGithubRepo = async (repoUrl: string, githubToken?: string) => {
  try {
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
      maxConcurrency: 5,
    });

    try {
      const docs = await loader.load();
      return docs;
    } catch (error: any) {
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

// Load repository and generate embeddings with bounded concurrency (Phase 6)
export const indexGithubRepo = async (repoUrl: string, githubToken?: string, projectId?: string) => {
  try {
    console.log("🔍 Loading repository files...");
    const docs = await loadGithubRepo(repoUrl, githubToken);
    console.log(`📚 Found ${docs.length} eligible files in repository`);

    // Bounded Concurrency Summarization (10 concurrent workers)
    console.log("📝 Generating file summaries with bounded concurrency...");
    const rawSummaries = await runWithConcurrency(docs, 10, async (doc) => {
      const fileName = cleanRepoFileName(doc);
      try {
        const summary = await summarizeCode(doc);
        return {
          fileName,
          summary,
          sourceCode: doc.pageContent,
        };
      } catch (err) {
        console.warn(`Warning: failed to summarize ${fileName}, skipping.`);
        return null;
      }
    });

    const summaries = rawSummaries.filter(Boolean) as Array<{
      fileName: string;
      summary: string;
      sourceCode: string;
    }>;
    console.log(`✅ Summarized ${summaries.length} files`);

    // Generate embeddings with bounded concurrency (5 concurrent workers)
    console.log("🧠 Generating embeddings with bounded concurrency...");
    const rawEmbeddings = await runWithConcurrency(summaries, 5, async (item) => {
      try {
        const embedding = await generateEmbeddings(item.summary);
        return {
          ...item,
          embedding,
        };
      } catch (err) {
        console.warn(`Warning: failed to embed ${item.fileName}, skipping.`);
        return null;
      }
    });

    const embeddingsData = rawEmbeddings.filter(Boolean) as Array<{
      fileName: string;
      summary: string;
      sourceCode: string;
      embedding: number[];
    }>;
    console.log(`✅ Generated ${embeddingsData.length} embeddings`);

    // Save all data to database in parallel batches
    console.log("💾 Persisting embeddings to database...");
    await runWithConcurrency(embeddingsData, 5, async (embedding) => {
      try {
        const data: any = {
          summary: embedding.summary,
          fileName: embedding.fileName,
          sourceCode: embedding.sourceCode,
        };
        if (projectId !== undefined) {
          data.projectId = projectId;
        }

        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
          data,
        });

        await db.$executeRaw`UPDATE "SourceCodeEmbedding" SET "summaryEmbeddingGemini" = ${embedding.embedding} :: vector WHERE "id" = ${sourceCodeEmbedding.id}`;
      } catch (error) {
        console.error(`Error saving data for ${embedding.fileName}:`, error);
      }
    });

    console.log("🎉 Repository processing complete!");
    return docs;
  } catch (error) {
    console.error("❌ Error in indexGithubRepo:", error);
    throw error;
  }
};
