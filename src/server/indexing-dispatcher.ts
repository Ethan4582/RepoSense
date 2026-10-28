import type { PrismaClient } from "@prisma/client";

interface WorkflowBinding {
  create(options: {
    id?: string;
    params: { projectId: string; jobId: string; userId: string };
  }): Promise<unknown>;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function dispatchIndexingJobs(
  db: PrismaClient,
  workflow: WorkflowBinding,
  now = new Date(),
): Promise<number> {
  const maxGlobal = positiveInt(process.env.MAX_GLOBAL_INDEXING_JOBS, 3);
  const running = await db.indexingJob.count({ where: { status: "RUNNING" } });
  const slots = Math.max(0, maxGlobal - running);
  if (slots === 0) return 0;

  const candidates = await db.indexingJob.findMany({
    where: {
      status: "QUEUED",
      availableAt: { lte: now },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
    },
    orderBy: [{ priority: "asc" }, { availableAt: "asc" }],
    take: slots * 3,
    include: { project: { select: { ownerId: true } } },
  });

  const runningOwners = new Set(
    (
      await db.indexingJob.findMany({
        where: { status: "RUNNING", requestedByUserId: { not: null } },
        select: { requestedByUserId: true },
      })
    ).flatMap((job) => (job.requestedByUserId ? [job.requestedByUserId] : [])),
  );

  let started = 0;
  for (const job of candidates) {
    if (started >= slots) break;
    const ownerId = job.requestedByUserId ?? job.project.ownerId;
    if (runningOwners.has(ownerId)) continue;

    const leaseOwner = crypto.randomUUID();
    const claimed = await db.indexingJob.updateMany({
      where: {
        id: job.id,
        status: "QUEUED",
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        leaseOwner,
        leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count === 0) continue;

    try {
      await workflow.create({
        id: job.id,
        params: { projectId: job.projectId, jobId: job.id, userId: ownerId },
      });
      runningOwners.add(ownerId);
      started += 1;
    } catch (error) {
      const exhausted = job.attemptCount + 1 >= job.maxAttempts;
      await db.indexingJob.update({
        where: { id: job.id },
        data: exhausted
          ? {
              status: "FAILED",
              errorCode: "WORKFLOW_START_FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Workflow start failed.",
              finishedAt: new Date(),
              leaseOwner: null,
              leaseExpiresAt: null,
            }
          : {
              availableAt: new Date(
                now.getTime() + Math.min(30, 2 ** job.attemptCount) * 60_000,
              ),
              leaseOwner: null,
              leaseExpiresAt: null,
            },
      });
    }
  }
  return started;
}
