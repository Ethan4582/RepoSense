import { Hono } from "hono";
import { z } from "zod";
import { db } from "~/server/db";

const pullRequestWebhookSchema = z.object({
  action: z.string(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    default_branch: z.string(),
    owner: z.object({ login: z.string() }),
  }),
  pull_request: z.object({
    number: z.number(),
    merged: z.boolean().nullable(),
    merge_commit_sha: z.string().nullable(),
    base: z.object({ ref: z.string() }),
  }),
});

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyGithubSignature(rawBody: string, signature: string): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return safeEqual(`sha256=${bytesToHex(digest)}`, signature.toLowerCase());
}

export const webhookRoutes = new Hono().post("/github", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Hub-Signature-256") ?? "";
  if (!(await verifyGithubSignature(rawBody, signature))) {
    return c.json({ error: "Invalid webhook signature" }, 401);
  }

  const deliveryId = c.req.header("X-GitHub-Delivery");
  const event = c.req.header("X-GitHub-Event") ?? "unknown";
  if (!deliveryId) return c.json({ error: "Missing delivery ID" }, 400);

  const claimed = await db.githubWebhookDelivery
    .create({ data: { id: deliveryId, event } })
    .then(() => true)
    .catch(() => false);
  if (!claimed) return c.json({ accepted: true, duplicate: true });
  if (event !== "pull_request") return c.json({ accepted: true, ignored: true });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ accepted: true, ignored: true });
  }
  const parsed = pullRequestWebhookSchema.safeParse(body);
  if (!parsed.success) return c.json({ accepted: true, ignored: true });
  const payload = parsed.data;
  if (
    payload.action !== "closed" ||
    payload.pull_request.merged !== true ||
    !payload.pull_request.merge_commit_sha ||
    payload.pull_request.base.ref !== payload.repository.default_branch
  ) {
    return c.json({ accepted: true, ignored: true });
  }

  const project = await db.project.findFirst({
    where: {
      deletedAt: null,
      automaticUpdatesEnabled: true,
      OR: [
        { githubRepositoryId: String(payload.repository.id) },
        {
          repoOwner: { equals: payload.repository.owner.login, mode: "insensitive" },
          repoName: { equals: payload.repository.name, mode: "insensitive" },
        },
      ],
    },
  });
  if (!project) return c.json({ accepted: true, ignored: true });

  const targetCommitSha = payload.pull_request.merge_commit_sha;
  const delayMs = (5 * 60 + Math.floor(Math.random() * 5 * 60)) * 1000;
  const availableAt = new Date(Date.now() + delayMs);
  const queued = await db.indexingJob.findFirst({
    where: { projectId: project.id, status: "QUEUED", trigger: "MERGE" },
    orderBy: { availableAt: "desc" },
  });
  const job = queued
    ? await db.indexingJob.update({
        where: { id: queued.id },
        data: {
          commitSha: targetCommitSha,
          pullRequestNumber: payload.pull_request.number,
          githubDeliveryId: deliveryId,
          availableAt,
          currentDetail: "Waiting for the automatic update window...",
        },
      })
    : await db.indexingJob.create({
        data: {
          projectId: project.id,
          branch: payload.repository.default_branch,
          branchKind: "MAIN",
          pullRequestNumber: payload.pull_request.number,
          baseCommitSha: project.lastIndexedCommitSha,
          commitSha: targetCommitSha,
          trigger: "MERGE",
          requestedByUserId: project.ownerId,
          priority: 200,
          availableAt,
          githubDeliveryId: deliveryId,
          status: "QUEUED",
          currentStep: "LOADING_REPO",
          currentDetail: "Waiting for the automatic update window...",
        },
      });

  const dedupeKey = `wiki-update-queued:${project.id}:${job.id}`;
  await db.notification.upsert({
    where: { dedupeKey },
    create: {
      userId: project.ownerId,
      projectId: project.id,
      dedupeKey,
      type: "INDEXING",
      title: "Wiki update queued",
      message: `Merge #${payload.pull_request.number} will be processed in about 5-10 minutes.`,
      href: `/wiki/${project.id}`,
    },
    update: {
      message: `The latest merge will be processed in about 5-10 minutes.`,
    },
  });

  return c.json({ accepted: true, jobId: job.id }, 202);
});
