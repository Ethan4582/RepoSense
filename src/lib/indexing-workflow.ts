
import { Prisma, type PrismaClient, type Project } from '@prisma/client';
import { db as defaultDb } from '~/server/db';
import {
  buildRepoSkeleton,
  chunkFile,
  type CodeChunk,
} from './chunker';
import { embedAndStoreChunks } from './embeddings';
import {
  GitHubAccessError,
  compareRepoCommits,
  decryptProjectToken,
} from './github';
import {
  loadRepoFiles,
  loadRepoTree,
  selectFilesForLoading,
  type LoadedRepoFile,
  type RepoSource,
} from './repo-filter';
import { analyzeRepository, type RepoArchitecture } from './repo-normalizer';
import { ProviderAccessError, resolveProjectKeys } from './providers/guard';
import { purgeWikiCache } from './cache';
import { diffLineCounts } from './project-access';
import {
  classifyChangedPaths,
  isStructuralChange,
  selectAffectedPages,
} from './incremental-indexing';
import {
  ensureBlueprint,
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

const MAX_FETCH_BATCH = 20;
const MAX_FETCH_BATCH_BYTES = 800 * 1024;
const EMBED_BATCH = 100;
const PAGE_CONCURRENCY = 3;

function createEmbeddingBatches(chunks: CodeChunk[]): CodeChunk[][] {
  const byFile = new Map<string, CodeChunk[]>();
  for (const chunk of chunks) {
    const fileChunks = byFile.get(chunk.filePath) ?? [];
    fileChunks.push(chunk);
    byFile.set(chunk.filePath, fileChunks);
  }

  const batches: CodeChunk[][] = [];
  let current: CodeChunk[] = [];
  for (const fileChunks of byFile.values()) {
    if (current.length > 0 && current.length + fileChunks.length > EMBED_BATCH) {
      batches.push(current);
      current = [];
    }
    if (fileChunks.length > EMBED_BATCH) {
      if (current.length > 0) batches.push(current);
      batches.push(fileChunks);
      current = [];
    } else {
      current.push(...fileChunks);
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

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

function createFetchBatches(files: RepoSource['files']): RepoSource['files'][] {
  const batches: RepoSource['files'][] = [];
  let current: RepoSource['files'] = [];
  let currentBytes = 0;

  for (const file of files) {
    const size = file.size ?? 0;
    if (
      current.length > 0 &&
      (current.length >= MAX_FETCH_BATCH || currentBytes + size > MAX_FETCH_BATCH_BYTES)
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(file);
    currentBytes += size;
  }

  if (current.length > 0) batches.push(current);
  return batches;
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
    const failedJob = await db.indexingJob
      .findUnique({ where: { id: jobId }, select: { trigger: true } })
      .catch(() => null);
    if (failedJob?.trigger === 'MERGE' || failedJob?.trigger === 'PUSH') {
      const dedupeKey = `wiki-update-failed:${projectId}:${jobId}`;
      await db.notification
        .upsert({
          where: { dedupeKey },
          create: {
            userId,
            projectId,
            dedupeKey,
            type: 'INDEXING',
            title: 'Automatic wiki update failed',
            message: info.message,
            href: `/settings/projects/${projectId}`,
          },
          update: { message: info.message },
        })
        .catch(() => undefined);
    }
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
  const job = await db.indexingJob.findUnique({ where: { id: jobId } });
  const requestedRef = job?.commitSha
    ? { commitSha: job.commitSha }
    : { branch: project.defaultBranch };

  await updateJob(db, jobId, {
    status: 'RUNNING',
    currentStep: 'LOADING_REPO',
    startedAt: new Date(),
    errorCode: null,
    errorMessage: null,
    currentDetail: 'Resolving repository ref, branch tree, and files...',
  });

  const source = await step.do('load-repository', async () => {
    const loaded = await loadRepoTree(project.repoUrl, token, requestedRef);
    return {
      owner: loaded.owner,
      repo: loaded.repo,
      repoUrl: loaded.repoUrl,
      defaultBranch: loaded.defaultBranch,
      branch: loaded.branch,
      branchKind: loaded.branchKind,
      pullRequestNumber: loaded.pullRequestNumber,
      commitSha: loaded.commitSha,
      isPrivate: loaded.isPrivate,
      fetchOwner: loaded.fetchOwner,
      fetchRepo: loaded.fetchRepo,
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
      defaultBranch: source.defaultBranch,
    },
  });

  const baseCommitSha = job?.baseCommitSha ?? project.lastIndexedCommitSha;
  const changes =
    baseCommitSha && baseCommitSha !== source.commitSha
      ? await step.do('compare-commits', () =>
          compareRepoCommits(
            source.owner,
            source.repo,
            baseCommitSha,
            source.commitSha,
            token,
          ),
        )
      : null;
  const incremental = Array.isArray(changes) && project.lastIndexedAt !== null;
  const classifiedChanges = classifyChangedPaths(changes ?? []);
  const changedNewPaths = classifiedChanges.loadPaths;
  const removedPaths = classifiedChanges.deletePaths;
  const selectedFiles = selectFilesForLoading(source.files);
  const filesToLoad = incremental
    ? selectedFiles.filter((file) => changedNewPaths.has(file.path))
    : selectedFiles;
  const batches = createFetchBatches(filesToLoad);

  await updateJob(db, jobId, {
    branch: source.branch,
    branchKind: source.branchKind,
    pullRequestNumber: source.pullRequestNumber,
    commitSha: source.commitSha,
    totalFiles: filesToLoad.length,
    processedFiles: 0,
    currentDetail: `Fetching ${filesToLoad.length} source files from ${source.branch}...`,
  });

  const loadedFiles: LoadedRepoFile[] = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index] ?? [];
    const offset = batches.slice(0, index).reduce((sum, item) => sum + item.length, 0);
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
      processedFiles: Math.min(offset + batch.length, filesToLoad.length),
      currentDetail: `Loaded ${loadedFiles.length}/${filesToLoad.length} files from ${source.branch}...`,
    });
  }

  if (loadedFiles.length === 0 && !incremental) {
    throw new Error('No readable source files were found in this repository.');
  }

  if (incremental) {
    const unchanged = await db.sourceCodeEmbedding.findMany({
      where: {
        projectId: project.id,
        branch: source.branch,
        chunkIndex: 0,
        filePath: {
          notIn: [...changedNewPaths, ...removedPaths],
        },
        fullFileContent: { not: null },
      },
      select: { filePath: true, fullFileContent: true },
    });
    loadedFiles.push(
      ...unchanged.flatMap((file) =>
        file.fullFileContent === null
          ? []
          : [
              {
                path: file.filePath,
                size: new TextEncoder().encode(file.fullFileContent).byteLength,
                content: file.fullFileContent,
                lineCount: file.fullFileContent.split('\n').length,
              },
            ],
      ),
    );
  }

  await updateJob(db, jobId, {
    currentStep: 'CHUNKING_AND_EMBEDDING',
    currentDetail: 'Building repository skeleton and line-aware chunks...',
  });

  const skeleton = await step.do('build-skeleton', async () => {
    const built = buildRepoSkeleton(loadedFiles);
    await db.project.update({
      where: { id: project.id },
      data: { repoSkeleton: built as unknown as Prisma.InputJsonValue },
    });
    return built;
  });

  const architecture: RepoArchitecture = await step.do('normalize-repository', async () =>
    analyzeRepository({
      files: loadedFiles,
      skeleton,
      allPaths: source.files.map((file) => file.path),
    })
  );

  const changedLoadedFiles = incremental
    ? loadedFiles.filter((file) => changedNewPaths.has(file.path))
    : loadedFiles;
  const chunks: CodeChunk[] = [];
  for (const file of changedLoadedFiles) {
    chunks.push(...chunkFile({ path: file.path, content: file.content }));
  }

  if (removedPaths.size > 0) {
    await db.sourceCodeEmbedding.deleteMany({
      where: {
        projectId: project.id,
        branch: source.branch,
        filePath: { in: [...removedPaths] },
      },
    });
  }

  let embedded = 0;
  const embeddingBatches = createEmbeddingBatches(chunks);
  for (let index = 0; index < embeddingBatches.length; index += 1) {
    const batch = embeddingBatches[index] ?? [];
    const count = await step.do(`embed-chunks-${index}`, async () => {
      return embedAndStoreChunks({
        db,
        projectId: project.id,
        branch: source.branch,
        commitSha: source.commitSha,
        chunks: batch,
        provider: keys.embeddingProvider,
        model: keys.embeddingModel,
        apiKey: keys.embeddingApiKey,
        replaceFilePaths: Array.from(new Set(batch.map((chunk) => chunk.filePath))),
      });
    });
    embedded += count;

    await updateJob(db, jobId, {
      processedChunks: embedded,
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
    branch: source.branch,
    branchKind: source.branchKind,
    pullRequestNumber: source.pullRequestNumber,
    skeleton,
    architecture,
    files: loadedFiles.map((file) => ({ path: file.path, content: file.content })),
    provider: keys.chatProvider,
    model: keys.chatModel,
    apiKey: keys.chatApiKey,
  };

  let plan: WikiPlan;
  const existingPages = incremental
    ? await db.wikiPage.findMany({
        where: { projectId: project.id, branch: source.branch },
        orderBy: [{ sectionOrder: 'asc' }, { pageOrder: 'asc' }],
      })
    : [];
  const changedPaths = classifiedChanges.changedPaths;
  const structuralChange = isStructuralChange(changedPaths);
  const affectedPages = selectAffectedPages(existingPages, changedPaths);
  const requiresFullPlan =
    !incremental ||
    structuralChange ||
    (changedNewPaths.size > 0 && affectedPages.length === 0);

  if (!requiresFullPlan) {
    const sections = new Map<
      string,
      { sectionTitle: string; sectionOrder: number; pages: WikiPlan['sections'][number]['pages'] }
    >();
    for (const page of affectedPages) {
      const section = sections.get(page.sectionTitle) ?? {
        sectionTitle: page.sectionTitle,
        sectionOrder: page.sectionOrder,
        pages: [],
      };
      section.pages.push({
        slug: page.slug,
        title: page.title,
        pageOrder: page.pageOrder,
        relevantFiles: page.relevantFiles,
      });
      sections.set(page.sectionTitle, section);
    }
    plan = { sections: [...sections.values()] };
  } else {
    try {
      plan = await step.do('plan-wiki', async () => planWiki(context));
    } catch (err) {
      console.warn('[indexing] Wiki planning failed, using fallback plan:', err);
      plan = ensureBlueprint(
        fallbackPlan(context.skeleton, context.architecture),
        context.architecture,
      );
    }
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

  let completedPages = 0;

  for (let offset = 0; offset < pageTaskList.length; offset += PAGE_CONCURRENCY) {
    const batch = pageTaskList.slice(offset, offset + PAGE_CONCURRENCY);

    const generated = await step.do(`generate-pages-${offset}`, async () =>
      Promise.all(
        batch.map((task) =>
          generateWikiPage({
            context,
            plan,
            page: task.page,
            sectionTitle: task.sectionTitle,
            sectionOrder: task.sectionOrder,
          })
        )
      )
    );

    for (const page of generated) {
      const existingPage = await db.wikiPage.findUnique({
        where: {
          projectId_branch_slug: {
            projectId: project.id,
            branch: source.branch,
            slug: page.slug,
          },
        },
        include: {
          revisions: {
            where: { status: 'PUBLISHED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      const latestRevision = existingPage?.revisions[0];
      const preservesManualEdit =
        (job?.trigger === 'MERGE' || job?.trigger === 'PUSH') &&
        existingPage &&
        latestRevision?.actorId;
      if (preservesManualEdit) {
        const diff = diffLineCounts(existingPage.content, page.content);
        await db.wikiPageRevision.upsert({
          where: {
            pageId_sourceCommitSha_status: {
              pageId: existingPage.id,
              sourceCommitSha: source.commitSha,
              status: 'PENDING',
            },
          },
          create: {
            pageId: existingPage.id,
            status: 'PENDING',
            title: page.title,
            sectionTitle: page.sectionTitle,
            content: page.content,
            relevantFiles: page.relevantFiles,
            headings: page.headings,
            additions: diff.additions,
            deletions: diff.deletions,
            sourceCommitSha: source.commitSha,
          },
          update: {
            title: page.title,
            sectionTitle: page.sectionTitle,
            content: page.content,
            relevantFiles: page.relevantFiles,
            headings: page.headings,
            additions: diff.additions,
            deletions: diff.deletions,
          },
        });
        continue;
      }

      const storedPage = await db.wikiPage.upsert({
        where: {
          projectId_branch_slug: {
            projectId: project.id,
            branch: source.branch,
            slug: page.slug,
          },
        },
        create: {
          projectId: project.id,
          branch: source.branch,
          commitSha: source.commitSha,
          slug: page.slug,
          title: page.title,
          sectionTitle: page.sectionTitle,
          sectionOrder: page.sectionOrder,
          pageOrder: page.pageOrder,
          content: page.content,
          relevantFiles: page.relevantFiles,
          headings: page.headings,
        },
        update: {
          commitSha: source.commitSha,
          title: page.title,
          sectionTitle: page.sectionTitle,
          sectionOrder: page.sectionOrder,
          pageOrder: page.pageOrder,
          content: page.content,
          relevantFiles: page.relevantFiles,
          headings: page.headings,
        },
      });
      const previousContent = existingPage?.content ?? '';
      const diff = diffLineCounts(previousContent, page.content);
      await db.wikiPageRevision.upsert({
        where: {
          pageId_sourceCommitSha_status: {
            pageId: storedPage.id,
            sourceCommitSha: source.commitSha,
            status: 'PUBLISHED',
          },
        },
        create: {
          pageId: storedPage.id,
          status: 'PUBLISHED',
          title: storedPage.title,
          sectionTitle: storedPage.sectionTitle,
          content: storedPage.content,
          relevantFiles: storedPage.relevantFiles,
          headings: storedPage.headings ?? Prisma.JsonNull,
          additions: diff.additions,
          deletions: diff.deletions,
          sourceCommitSha: source.commitSha,
        },
        update: {
          title: storedPage.title,
          sectionTitle: storedPage.sectionTitle,
          content: storedPage.content,
          relevantFiles: storedPage.relevantFiles,
          headings: storedPage.headings ?? Prisma.JsonNull,
          additions: diff.additions,
          deletions: diff.deletions,
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
      where: { projectId: project.id, branch: source.branch },
      select: { slug: true },
    });
    if (requiresFullPlan) {
      await db.wikiPage.deleteMany({
        where: {
          projectId: project.id,
          branch: source.branch,
          slug: { notIn: keepSlugs },
        },
      });
    }
    await db.project.update({
      where: { id: project.id },
      data: {
        lastIndexedAt: new Date(),
        lastIndexedBranch: source.defaultBranch,
        lastIndexedBranchKind: 'MAIN',
        lastIndexedPullRequest: null,
        lastIndexedCommitSha: source.commitSha,
      },
    });
    await purgeWikiCache(
      project.id,
      [...previousPages.map((page) => page.slug), ...keepSlugs],
      [source.branch]
    );
    if (job?.trigger === 'MERGE' || job?.trigger === 'PUSH') {
      const pendingReviews = await db.wikiPageRevision.count({
        where: {
          page: { projectId: project.id },
          sourceCommitSha: source.commitSha,
          status: 'PENDING',
        },
      });
      const dedupeKey = `wiki-update:${project.id}:${source.commitSha}`;
      await db.notification.upsert({
        where: { dedupeKey },
        create: {
          userId: project.ownerId,
          projectId: project.id,
          dedupeKey,
          type: pendingReviews > 0 ? 'REVIEW_REQUIRED' : 'WIKI_UPDATED',
          title:
            pendingReviews > 0
              ? 'Wiki update needs review'
              : 'Your wiki was updated after a merge',
          message:
            pendingReviews > 0
              ? `${pendingReviews} generated page update${pendingReviews === 1 ? '' : 's'} need review because those pages contain manual edits.`
              : `The default-branch wiki for ${project.name} is up to date.`,
          href:
            pendingReviews > 0
              ? `/settings/projects/${project.id}/history`
              : `/wiki/${project.id}`,
        },
        update: {},
      });
    }
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

