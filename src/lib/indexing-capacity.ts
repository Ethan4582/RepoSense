import type { PrismaClient } from "@prisma/client";

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export interface IndexingCapacityResult {
  allowed: boolean;
  retryAfterSeconds: number;
  retryAt: string;
  reason:
    | "AVAILABLE"
    | "CONCURRENCY"
    | "DAILY_JOBS"
    | "DAILY_FILES"
    | "SOFT_THROTTLE";
}

function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function secondsUntilUtcReset(now: Date): number {
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(60, Math.ceil((reset.getTime() - now.getTime()) / 1000));
}

export async function checkIndexingCapacity(
  db: PrismaClient,
  now = new Date(),
): Promise<IndexingCapacityResult> {
  const maxDailyJobs = positiveInt(process.env.MAX_DAILY_INDEXING_JOBS, 20);
  const maxDailyFiles = positiveInt(
    process.env.MAX_DAILY_INDEXED_FILES,
    50_000,
  );
  const maxConcurrentJobs = positiveInt(
    process.env.MAX_GLOBAL_INDEXING_JOBS,
    3,
  );
  const softThreshold =
    Math.min(95, positiveInt(process.env.INDEXING_BUSY_THRESHOLD_PERCENT, 80)) /
    100;
  const shortRetry = positiveInt(process.env.SERVER_BUSY_RETRY_SECONDS, 1_800);
  const startedAt = { gte: utcDayStart(now) };

  const [dailyJobs, dailyFiles, activeJobs] = await Promise.all([
    db.indexingJob.count({ where: { startedAt } }),
    db.indexingJob.aggregate({
      where: { startedAt },
      _sum: { totalFiles: true },
    }),
    db.indexingJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
  ]);

  const processedFiles = dailyFiles._sum.totalFiles ?? 0;
  const dailyRetry = secondsUntilUtcReset(now);
  const dailyRetryAt = new Date(
    now.getTime() + dailyRetry * 1000,
  ).toISOString();
  const shortRetryAt = new Date(
    now.getTime() + shortRetry * 1000,
  ).toISOString();

  if (dailyJobs >= maxDailyJobs) {
    return {
      allowed: false,
      retryAfterSeconds: dailyRetry,
      retryAt: dailyRetryAt,
      reason: "DAILY_JOBS",
    };
  }
  if (processedFiles >= maxDailyFiles) {
    return {
      allowed: false,
      retryAfterSeconds: dailyRetry,
      retryAt: dailyRetryAt,
      reason: "DAILY_FILES",
    };
  }
  if (activeJobs >= maxConcurrentJobs) {
    return {
      allowed: false,
      retryAfterSeconds: shortRetry,
      retryAt: shortRetryAt,
      reason: "CONCURRENCY",
    };
  }

  const nearDailyLimit =
    dailyJobs >= Math.floor(maxDailyJobs * softThreshold) ||
    processedFiles >= Math.floor(maxDailyFiles * softThreshold);
  if (nearDailyLimit && activeJobs >= 1) {
    return {
      allowed: false,
      retryAfterSeconds: shortRetry,
      retryAt: shortRetryAt,
      reason: "SOFT_THROTTLE",
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    retryAt: now.toISOString(),
    reason: "AVAILABLE",
  };
}

export const SERVER_BUSY_MESSAGE =
  "RepoSense is catching its breath on the free-plan treadmill. The server is busy right now—please try again shortly.";
