import type { Prisma, PrismaClient, ProjectRole } from "@prisma/client";

const ROLE_RANK = {
  VIEWER: 0,
  CONTRIBUTOR: 1,
  EDITOR: 2,
  OWNER: 3,
} satisfies Record<ProjectRole, number>;

export async function getProjectRole(
  db: PrismaClient,
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> {
  const membership = await db.userToProject.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export function hasProjectRole(
  actual: ProjectRole | null,
  required: ProjectRole,
): boolean {
  return actual !== null && ROLE_RANK[actual] >= ROLE_RANK[required];
}

export async function recordProjectAudit(
  db: PrismaClient,
  input: {
    projectId: string;
    actorId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.projectAuditEvent.create({ data: input });
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function diffLineCounts(
  previous: string,
  next: string,
): { additions: number; deletions: number } {
  const previousLines = new Set(previous.split("\n"));
  const nextLines = new Set(next.split("\n"));
  return {
    additions: next.split("\n").filter((line) => !previousLines.has(line)).length,
    deletions: previous
      .split("\n")
      .filter((line) => !nextLines.has(line)).length,
  };
}
