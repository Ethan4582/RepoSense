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
  const defaultIgnoreFiles = [
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
    ".vercel",
    ".netlify",

    // Version control & ide
    ".git",
    ".github",
    ".gitlab",
    ".svn",
    ".hg",
    ".idea",
    ".vscode",
    ".vs",
    "*.swp",
    "*.swo",

    // Environment & secrets
    ".env",
    ".env.*",
    "*.env",
    "*.pem",
    "*.key",
    "*.cert",
    "*.crt",
    "credentials.json",

    // Test coverage & reports
    "coverage",
    ".nyc_output",
    "lcov-report",
    "reports",
    "jest-coverage",

    // Logs
    "logs",
    "*.log",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    "pnpm-debug.log*",

    // Temporary & cache files
    "tmp",
    "temp",
    ".cache",
    ".parcel-cache",
    ".turbo",
    ".eslintcache",
    "tsconfig.tsbuildinfo",

    // Static media / binary / audio-visual assets
    "*.jpg",
    "*.jpeg",
    "*.png",
    "*.gif",
    "*.ico",
    "*.svg",
    "*.webp",
    "*.avif",
    "*.bmp",
    "*.tiff",
    "*.mp4",
    "*.webm",
    "*.mov",
    "*.mp3",
    "*.wav",
    "*.ogg",
    "*.pdf",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.rar",
    "*.7z",
    "*.exe",
    "*.dmg",
    "*.iso",
    "*.bin",
    "*.wasm",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "*.otf",

    // Documentation & non-code extras
    "LICENSE",
    "LICENSE.*",
    "*.license",
    "CHANGELOG.md",
    "CHANGELOG",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CNAME",
    ".prettierignore",
    ".eslintignore",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".npmrc",
    ".yarnrc",
    ".dockerignore",
    "Dockerfile*",
    "docker-compose*.yml",
    "docker-compose*.yaml",
    "Procfile",
  ];

  const fetchDocs = async (token?: string) => {
    const loader = new GithubRepoLoader(repoUrl, {
      accessToken: token,
      branch: "",
      ignoreFiles: defaultIgnoreFiles,
      recursive: true,
      unknown: "warn",
      maxConcurrency: 5,
    });
    return await loader.load();
  };

  try {
    const token = (githubToken?.trim()) || process.env.GITHUB_TOKEN;
    let docs: Document[] = [];

    try {
      docs = await fetchDocs(token);
    } catch (err: any) {
      const isAuthError =
        err?.message?.includes("401") ||
        err?.message?.includes("Bad credentials") ||
        err?.status === 401;

      if (isAuthError && token) {
        console.warn("⚠️ GitHub token failed with 401 Bad credentials. Retrying unauthenticated for public repository...");
        docs = await fetchDocs(undefined);
      } else {
        throw err;
      }
    }

    const textExtensions = new Set([
      "ts", "tsx", "js", "jsx", "mjs", "cjs",
      "py", "go", "rs", "java", "c", "cpp", "h", "hpp", "cs",
      "rb", "php", "swift", "kt", "scala", "sh", "bash", "zsh",
      "sql", "prisma", "graphql", "gql",
      "html", "css", "scss", "sass", "less",
      "json", "yaml", "yml", "toml", "md", "mdx", "txt"
    ]);

    const filteredDocs = docs.filter((doc) => {
      const fileName = cleanRepoFileName(doc);
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      if (!textExtensions.has(ext)) {
        return false;
      }

      const content = doc.pageContent ?? '';
      const charCount = content.length;
      if (charCount < 40 || charCount > 100_000) {
        return false;
      }

      return true;
    });

    return filteredDocs;
  } catch (error) {
    console.error("Error loading GitHub repo:", error);
    throw error;
  }
};

export const indexGithubRepo = async (repoUrl: string, githubToken?: string, projectId?: string) => {
  try {
    const docs = await loadGithubRepo(repoUrl, githubToken);
    console.log(`[RAG Indexing] Processing ${docs.length} files from repository`);

    // Summarize files with concurrency
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
        return null;
      }
    });

    const summaries = rawSummaries.filter(Boolean) as Array<{
      fileName: string;
      summary: string;
      sourceCode: string;
    }>;

    // Generate embeddings
    const rawEmbeddings = await runWithConcurrency(summaries, 5, async (item) => {
      try {
        const embedding = await generateEmbeddings(item.summary);
        return {
          ...item,
          embedding,
        };
      } catch (err) {
        return null;
      }
    });

    const embeddingsData = rawEmbeddings.filter(Boolean) as Array<{
      fileName: string;
      summary: string;
      sourceCode: string;
      embedding: number[];
    }>;

    // Persist embeddings
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

    console.log(`[RAG Indexing] Complete: ${embeddingsData.length} files indexed`);
    return docs;
  } catch (error) {
    console.error("[RAG Indexing] Error:", error);
    throw error;
  }
};
