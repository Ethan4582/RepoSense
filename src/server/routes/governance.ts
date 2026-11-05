import { Prisma, type ProjectRole } from "@prisma/client";
import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  createInvitationToken,
  getProjectRole,
  hasProjectRole,
  recordProjectAudit,
  sha256,
} from "~/lib/project-access";
import type { AuthContext } from "../auth";

const ASSIGNABLE_ROLES = ["EDITOR", "CONTRIBUTOR", "VIEWER"] as const;

async function requireRole(
  c: Context<AuthContext>,
  projectId: string,
  minimum: ProjectRole,
) {
  const role = await getProjectRole(c.get("db"), projectId, c.get("userId"));
  return hasProjectRole(role, minimum) ? role : null;
}

export const governanceRoutes = new Hono<AuthContext>()
  .get("/:id/governance", async (c) => {
    const projectId = c.req.param("id");
    const role = await getProjectRole(c.get("db"), projectId, c.get("userId"));
    if (!role) return c.json({ error: "Project not found" }, 404);

    const project = await c.get("db").project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        automaticUpdatesEnabled: true,
        directEditNotifications: true,
      },
    });
    if (!project) return c.json({ error: "Project not found" }, 404);
    return c.json({ role, ...project });
  })
  .patch(
    "/:id/governance",
    zValidator(
      "json",
      z.object({
        automaticUpdatesEnabled: z.boolean().optional(),
        directEditNotifications: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const projectId = c.req.param("id");
      const role = await requireRole(c, projectId, "OWNER");
      if (!role) return c.json({ error: "Project not found" }, 404);
      const body = c.req.valid("json");
      const project = await c.get("db").project.update({
        where: { id: projectId },
        data: body,
        select: {
          automaticUpdatesEnabled: true,
          directEditNotifications: true,
        },
      });
      await recordProjectAudit(c.get("db"), {
        projectId,
        actorId: c.get("userId"),
        action: "PROJECT_SETTINGS_UPDATED",
        metadata: body as Prisma.InputJsonValue,
      });
      return c.json({ project });
    },
  )
  .get("/:id/access/members", async (c) => {
    const projectId = c.req.param("id");
    if (!(await requireRole(c, projectId, "VIEWER"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const members = await c.get("db").userToProject.findMany({
      where: { projectId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            emailAddress: true,
            imageUrl: true,
          },
        },
      },
    });
    return c.json({ members });
  })
  .post(
    "/:id/access/invitations",
    zValidator("json", z.object({ role: z.enum(ASSIGNABLE_ROLES) })),
    async (c) => {
      const projectId = c.req.param("id");
      if (!(await requireRole(c, projectId, "OWNER"))) {
        return c.json({ error: "Project not found" }, 404);
      }
      const token = createInvitationToken();
      const invitation = await c.get("db").projectInvitation.create({
        data: {
          projectId,
          createdById: c.get("userId"),
          tokenHash: await sha256(token),
          role: c.req.valid("json").role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true, role: true, expiresAt: true },
      });
      await recordProjectAudit(c.get("db"), {
        projectId,
        actorId: c.get("userId"),
        action: "INVITATION_CREATED",
        targetType: "ProjectInvitation",
        targetId: invitation.id,
        metadata: { role: invitation.role },
      });
      return c.json({ invitation, token }, 201);
    },
  )
  .post("/access/invitations/:token/accept", async (c) => {
    const tokenHash = await sha256(c.req.param("token"));
    const db = c.get("db");
    const userId = c.get("userId");
    const invitation = await db.projectInvitation.findUnique({
      where: { tokenHash },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      return c.json({ error: "This invitation is invalid or expired." }, 410);
    }

    await db.$transaction(async (tx) => {
      await tx.userToProject.upsert({
        where: { userId_projectId: { userId, projectId: invitation.projectId } },
        create: { userId, projectId: invitation.projectId, role: invitation.role },
        update: { role: invitation.role },
      });
      await tx.projectInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedById: userId },
      });
      await tx.projectAuditEvent.create({
        data: {
          projectId: invitation.projectId,
          actorId: userId,
          action: "INVITATION_ACCEPTED",
          targetType: "User",
          targetId: userId,
          metadata: { role: invitation.role },
        },
      });
    });
    return c.json({ projectId: invitation.projectId, role: invitation.role });
  })
  .patch(
    "/:id/access/members/:memberId",
    zValidator("json", z.object({ role: z.enum(ASSIGNABLE_ROLES) })),
    async (c) => {
      const projectId = c.req.param("id");
      if (!(await requireRole(c, projectId, "OWNER"))) {
        return c.json({ error: "Project not found" }, 404);
      }
      const memberId = c.req.param("memberId");
      const member = await c.get("db").userToProject.findUnique({
        where: { userId_projectId: { userId: memberId, projectId } },
      });
      if (!member || member.role === "OWNER") {
        return c.json({ error: "Member not found" }, 404);
      }
      const role = c.req.valid("json").role;
      await c.get("db").userToProject.update({
        where: { userId_projectId: { userId: memberId, projectId } },
        data: { role },
      });
      await recordProjectAudit(c.get("db"), {
        projectId,
        actorId: c.get("userId"),
        action: "MEMBER_ROLE_CHANGED",
        targetType: "User",
        targetId: memberId,
        metadata: { role },
      });
      return c.json({ success: true });
    },
  )
  .delete("/:id/access/members/:memberId", async (c) => {
    const projectId = c.req.param("id");
    if (!(await requireRole(c, projectId, "OWNER"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const memberId = c.req.param("memberId");
    const member = await c.get("db").userToProject.findUnique({
      where: { userId_projectId: { userId: memberId, projectId } },
    });
    if (!member || member.role === "OWNER") {
      return c.json({ error: "Member not found" }, 404);
    }
    await c.get("db").userToProject.delete({
      where: { userId_projectId: { userId: memberId, projectId } },
    });
    await recordProjectAudit(c.get("db"), {
      projectId,
      actorId: c.get("userId"),
      action: "MEMBER_REMOVED",
      targetType: "User",
      targetId: memberId,
    });
    return c.json({ success: true });
  })
  .post(
    "/:id/access/transfer",
    zValidator("json", z.object({ userId: z.string().min(1) })),
    async (c) => {
      const projectId = c.req.param("id");
      const currentOwnerId = c.get("userId");
      if (!(await requireRole(c, projectId, "OWNER"))) {
        return c.json({ error: "Project not found" }, 404);
      }
      const nextOwnerId = c.req.valid("json").userId;
      const nextOwner = await c.get("db").userToProject.findUnique({
        where: { userId_projectId: { userId: nextOwnerId, projectId } },
      });
      if (!nextOwner) return c.json({ error: "Member not found" }, 404);

      await c.get("db").$transaction(async (tx) => {
        await tx.userToProject.update({
          where: { userId_projectId: { userId: currentOwnerId, projectId } },
          data: { role: "EDITOR" },
        });
        await tx.userToProject.update({
          where: { userId_projectId: { userId: nextOwnerId, projectId } },
          data: { role: "OWNER" },
        });
        await tx.project.update({
          where: { id: projectId },
          data: { ownerId: nextOwnerId },
        });
        await tx.projectAuditEvent.create({
          data: {
            projectId,
            actorId: currentOwnerId,
            action: "OWNERSHIP_TRANSFERRED",
            targetType: "User",
            targetId: nextOwnerId,
          },
        });
      });
      return c.json({ success: true });
    },
  )
  .get("/:id/pages/:pageId/revisions", async (c) => {
    const projectId = c.req.param("id");
    if (!(await requireRole(c, projectId, "VIEWER"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const pageId = c.req.param("pageId");
    const page = await c.get("db").wikiPage.findFirst({
      where: { id: pageId, projectId },
      select: { id: true },
    });
    if (!page) return c.json({ error: "Page not found" }, 404);
    const revisions = await c.get("db").wikiPageRevision.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });
    return c.json({ revisions });
  })
  .post("/:id/revisions/:revisionId/approve", async (c) => {
    const projectId = c.req.param("id");
    const actorId = c.get("userId");
    if (!(await requireRole(c, projectId, "EDITOR"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const revision = await c.get("db").wikiPageRevision.findFirst({
      where: {
        id: c.req.param("revisionId"),
        status: "PENDING",
        page: { projectId },
      },
      include: { page: true },
    });
    if (!revision) return c.json({ error: "Revision not found" }, 404);

    await c.get("db").$transaction(async (tx) => {
      await tx.wikiPage.update({
        where: { id: revision.pageId },
        data: {
          title: revision.title,
          sectionTitle: revision.sectionTitle,
          content: revision.content,
          relevantFiles: revision.relevantFiles,
          headings: revision.headings ?? Prisma.JsonNull,
        },
      });
      await tx.wikiPageRevision.update({
        where: { id: revision.id },
        data: { status: "PUBLISHED" },
      });
      await tx.projectAuditEvent.create({
        data: {
          projectId,
          actorId,
          action: "WIKI_REVISION_APPROVED",
          targetType: "WikiPageRevision",
          targetId: revision.id,
        },
      });
    });
    return c.json({ success: true });
  })
  .post("/:id/revisions/:revisionId/rollback", async (c) => {
    const projectId = c.req.param("id");
    const actorId = c.get("userId");
    if (!(await requireRole(c, projectId, "EDITOR"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const revision = await c.get("db").wikiPageRevision.findFirst({
      where: {
        id: c.req.param("revisionId"),
        status: "PUBLISHED",
        page: { projectId },
      },
      include: { page: true },
    });
    if (!revision) return c.json({ error: "Revision not found" }, 404);
    const diff = {
      additions: revision.content.split("\n").length,
      deletions: revision.page.content.split("\n").length,
    };
    await c.get("db").$transaction(async (tx) => {
      await tx.wikiPage.update({
        where: { id: revision.pageId },
        data: {
          title: revision.title,
          sectionTitle: revision.sectionTitle,
          content: revision.content,
          relevantFiles: revision.relevantFiles,
          headings: revision.headings ?? Prisma.JsonNull,
        },
      });
      await tx.wikiPageRevision.create({
        data: {
          pageId: revision.pageId,
          actorId,
          status: "PUBLISHED",
          title: revision.title,
          sectionTitle: revision.sectionTitle,
          content: revision.content,
          relevantFiles: revision.relevantFiles,
          headings: revision.headings ?? Prisma.JsonNull,
          additions: diff.additions,
          deletions: diff.deletions,
          sourceCommitSha: revision.sourceCommitSha,
        },
      });
      await tx.projectAuditEvent.create({
        data: {
          projectId,
          actorId,
          action: "WIKI_REVISION_RESTORED",
          targetType: "WikiPageRevision",
          targetId: revision.id,
        },
      });
    });
    return c.json({ success: true });
  })
  .get("/:id/revisions", async (c) => {
    const projectId = c.req.param("id");
    if (!(await requireRole(c, projectId, "VIEWER"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const revisions = await c.get("db").wikiPageRevision.findMany({
      where: { page: { projectId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        page: { select: { id: true, slug: true, title: true } },
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });
    return c.json({ revisions });
  })
  .get("/:id/audit", async (c) => {
    const projectId = c.req.param("id");
    if (!(await requireRole(c, projectId, "OWNER"))) {
      return c.json({ error: "Project not found" }, 404);
    }
    const events = await c.get("db").projectAuditEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: { firstName: true, lastName: true, emailAddress: true },
        },
      },
    });
    return c.json({ events });
  });
