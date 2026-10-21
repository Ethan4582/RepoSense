import pLimit from 'p-limit';
import type { Prisma, PrismaClient, Project } from '@prisma/client';
import { db as defaultDb } from '~/server/db';
import {
  buildRepoSkeleton,
  chunkFile,
  type CodeChunk,
  type RepoSkeleton,
} from './chunker';
import { embedAndStoreChunks } from './embeddings';
import {
  GitHubAccessError,
  decryptProjectToken,
  parseRepoUrl,
} from './github';
import {
  loadRepoFiles,
  loadRepoTree,
  type FilteredRepoFile,
  type LoadedRepoFile,
  type RepoSource,
} from './repo-filter';
import { ProviderAccessError, resolveProjectKeys } from './providers/guard';
import { purgeWikiCache } from './cache';
import {
  fallbackPlan,
  generateWikiPage,
  planWiki,
  type WikiGenerationContext,
  type WikiPlan,
} from './wiki-generator';

export interface StepRunner {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

export const inlineStepRunner: StepRunner = {
  do: async (_name, fn) => fn(),
};

const FILE_FETCH_BATCH = 10;
const EMBED_BATCH = 400;
const PAGE_CONCURRENCY = 3;

function errorInfo(err: unknown): { code: string; message: string } {
  if (err instanceof GitHubAccessError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof ProviderAccessError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    const message = err.message || 'Indexing failed';
    if (/rate limit/i.test(message)) return { code: 'GITHUB_RATE_LIMIT', message };
    return { code: 'WORKER_ERROR', message };
  }
  return { code: 'WORKER_ERROR', message: 'Indexing failed unexpectedly.' };
}

async function updateJob(
  db: PrismaClient,
  jobId: string,
  data: Prisma.IndexingJobUpdateInput
) {
  await db.indexingJob.update({ where: { id: jobId }, data });
}

export interface IndexingResult {
  wikiPages: number;
  chunks: number;
}

export async function runIndexingWorkflow(opts: {
  projectId: string;
  jobId: string;
  userId: string;
  step: StepRunner;
  db?: PrismaClient;
}): Promise<IndexingResult> {
  const db = opts.db ?? defaultDb;
  const { projectId, jobId, step, userId } = opts;

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  try {
    const token = await decryptProjectToken(project);
    const keys = await resolveProjectKeys(userId, project);

    return await executePipeline({ db, project, jobId, step, token, keys });
  } catch (err) {
    const info = errorInfo(err);
    await updateJob(db, jobId, {
      status: 'FAILED',
      errorCode: info.code,
      errorMessage: info.message,
      currentDetail: null,
      finishedAt: new Date(),
    }).catch(() => undefined);
    throw err;
  }
}

async function executePipeline(opts: {
  db: PrismaClient;
  project: Project;
  jobId: string;
  step: StepRunner;
  token: string | null;
  keys: Awaited<ReturnType<typeof resolveProjectKeys>>;
}): Promise<IndexingResult> {
  const { db, project, jobId, step, token, keys } = opts;

  await updateJob(db, jobId, {
    status: 'RUNNING',
    currentStep: 'LOADING_REPO',
    startedAt: new Date(),
    errorCode: null,
    errorMessage: null,
    currentDetail: 'Resolving default branch and repository tree...',
  });

  const source = await step.do('load-repository', async () => {
    const loaded = await loadRepoTree(project.repoUrl, token);
    return {
      owner: loaded.owner,
      repo: loaded.repo,
      repoUrl: loaded.repoUrl,
      defaultBranch: loaded.defaultBranch,
      commitSha: loaded.commitSha,
      isPrivate: loaded.isPrivate,
      files: loaded.files,
    } satisfies RepoSource;
  });

  await db.project.update({
    where: { id: project.id },
    data: {
      name: `${source.owner}/${source.repo}`,
      repoOwner: source.owner,
      repoName: source.repo,
      repoUrl: source.repoUrl,
      isPrivateRepo: source.isPrivate,
      isPublicWiki: source.isPrivate ? false : project.isPublicWiki,
      lastIndexedCommitSha: source.commitSha,
    },
  });

  await updateJob(db, jobId, {
    totalFiles: source.files.length,
    processedFiles: 0,
    currentDetail: `Fetching ${source.files.length} source files...`,
  });

  const loadedFiles: LoadedRepoFile[] = [];

  for (let offset = 0; offset < source.files.length; offset += FILE_FETCH_BATCH) {
    const batch = source.files.slice(offset, offset + FILE_FETCH_BATCH);
    const loaded = await step.do(`fetch-files-${offset}`, async () => {
      const files = await loadRepoFiles(source, token, batch);
      return files.map((file) => ({
        path: file.path,
        size: file.size,
        content: file.content,
        lineCount: file.lineCount,
      }));
    });

    loadedFiles.push(...loaded);
    await updateJob(db, jobId, {
      processedFiles: Math.min(offset + batch.length, source.files.length),
      currentDetail: `Loaded ${loadedFiles.length}/${source.files.length} files...`,
    });
  }

  if (loadedFiles.length === 0) {
    throw new Error('No readable source files were found in this repository.');
  }

  await updateJob(db, jobId, {
    currentStep: 'CHUNKING_AND_EMBEDDING',
    currentDetail: 'Building repository skeleton and line-aware chunks...',
  });

  const skeleton = await step.do('build-skeleton', async () => {
    const built = buildRepoSkeleton(loadedFiles);
    await db.project.update({
      where: { id: project.id },
      data: { repoSkeleton: built as unknown as object },
    });
    return built;
  });

  const chunks: CodeChunk[] = [];
  for (const file of loadedFiles) {
    chunks.push(...chunkFile({ path: file.path, content: file.content }));
  }

  await db.sourceCodeEmbedding.deleteMany({ where: { projectId: project.id } });

  let embedded = 0;
  for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH) {
    const batch = chunks.slice(offset, offset + EMBED_BATCH);
    const count = await step.do(`embed-chunks-${offset}`, async () => {
      return embedAndStoreChunks({
        db,
        projectId: project.id,
        chunks: batch,
        provider: keys.embeddingProvider,
        model: keys.embeddingModel,
        apiKey: keys.embeddingApiKey,
      });
    });
    embedded += count;

    await updateJob(db, jobId, {
      currentDetail: `Embedding code chunks (${embedded}/${chunks.length})...`,
    });
  }

  await updateJob(db, jobId, {
    currentStep: 'PLANNING_WIKI',
    currentDetail: 'Planning the DeepWiki architecture...',
  });

  const context: WikiGenerationContext = {
    projectName: `${source.owner}/${source.repo}`,
    repoUrl: source.repoUrl,
    skeleton: skeleton as RepoSkeleton,
    files: loadedFiles.map((file) => ({ path: file.path, content: file.content })),
    provider: keys.chatProvider,
    model: keys.chatModel,
    apiKey: keys.chatApiKey,
  };

  let plan: WikiPlan;
  try {
    plan = await step.do('plan-wiki', async () => planWiki(context));
  } catch (err) {
    console.warn('[indexing] Wiki planning failed, using fallback plan:', err);
    plan = fallbackPlan(context.skeleton);
  }

  const totalPages = plan.sections.reduce((sum, section) => sum + section.pages.length, 0);

  await updateJob(db, jobId, {
    currentStep: 'GENERATING_PAGES',
    totalWikiPages: totalPages,
    completedWikiPages: 0,
    estimatedSecondsRemaining: totalPages * 15,
    currentDetail: `Generating ${totalPages} wiki pages...`,
  });

  const pageTaskList = plan.sections.flatMap((section) =>
    section.pages.map((page) => ({
      sectionTitle: section.sectionTitle,
      sectionOrder: section.sectionOrder,
      page,
    }))
  );

  const limit = pLimit(PAGE_CONCURRENCY);
  let completedPages = 0;

  for (let offset = 0; offset < pageTaskList.length; offset += PAGE_CONCURRENCY) {
    const batch = pageTaskList.slice(offset, offset + PAGE_CONCURRENCY);

    const generated = await step.do(`generate-pages-${offset}`, async () =>
      limit.map(batch, async (task) =>
        generateWikiPage({
          context,
          plan,
          page: task.page,
          sectionTitle: task.sectionTitle,
          sectionOrder: task.sectionOrder,
        })
      )
    );

    for (const page of generated) {
      await db.wikiPage.upsert({
        where: { projectId_slug: { projectId: project.id, slug: page.slug } },
        create: {
          projectId: project.id,
          slug: page.slug,
          title: page.title,
          sectionTitle: page.sectionTitle,
          sectionOrder: page.sectionOrder,
          pageOrder: page.pageOrder,
          content: page.content,
          relevantFiles: page.relevantFiles,
          headings: page.headings as unknown as object,
        },
        update: {
          title: page.title,
          sectionTitle: page.sectionTitle,
          sectionOrder: page.sectionOrder,
          pageOrder: page.pageOrder,
          content: page.content,
          relevantFiles: page.relevantFiles,
          headings: page.headings as unknown as object,
        },
      });
    }

    completedPages += generated.length;
    const remaining = totalPages - completedPages;
    await updateJob(db, jobId, {
      completedWikiPages: completedPages,
      estimatedSecondsRemaining: Math.max(0, remaining * 15),
      currentDetail: `Generated ${completedPages}/${totalPages} wiki pages...`,
    });
  }

  await updateJob(db, jobId, {
    currentStep: 'FINALIZING',
    currentDetail: 'Finalizing documentation...',
  });

  await step.do('finalize', async () => {
    const keepSlugs = plan.sections.flatMap((section) => section.pages.map((page) => page.slug));
    const previousPages = await db.wikiPage.findMany({
      where: { projectId: project.id },
      select: { slug: true },
    });
    await db.wikiPage.deleteMany({
      where: { projectId: project.id, slug: { notIn: keepSlugs } },
    });
    await db.project.update({
      where: { id: project.id },
      data: { lastIndexedAt: new Date() },
    });
    await purgeWikiCache(project.id, [
      ...previousPages.map((page) => page.slug),
      ...keepSlugs,
    ]);
  });

  await updateJob(db, jobId, {
    status: 'COMPLETED',
    currentStep: 'DONE',
    completedWikiPages: totalPages,
    estimatedSecondsRemaining: 0,
    currentDetail: null,
    finishedAt: new Date(),
  });

  return { wikiPages: totalPages, chunks: embedded };
}

