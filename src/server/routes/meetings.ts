import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";

export const meetingsRoutes = new Hono<AuthContext>()
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        meetingUrl: z.string(),
        name: z.string(),
      })
    ),
    async (c) => {
      const db = c.get("db");
      const userId = c.get("userId");
      const { projectId, meetingUrl, name } = c.req.valid("json");

      const member = await db.userToProject.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { id: true },
      });
      if (!member) return c.json({ error: "Project not found" }, 404);

      const meeting = await db.meeting.create({
        data: {
          meetingUrl,
          projectId,
          name,
          status: "PROCESSING",
        },
      });

      return c.json({ meeting });
    }
  )
  .get("/", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId query parameter required" }, 400);
    }

    const member = await db.userToProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    if (!member) return c.json({ error: "Project not found" }, 404);

    const meetings = await db.meeting.findMany({
      where: { projectId },
      include: { issues: true },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ meetings });
  })
  .get("/:meetingId", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const meetingId = c.req.param("meetingId");

    const meeting = await db.meeting.findFirst({
      where: {
        id: meetingId,
        project: { userToProjects: { some: { userId } } },
      },
      include: { issues: true },
    });

    if (!meeting) {
      return c.json({ error: "Meeting not found" }, 404);
    }

    return c.json({ meeting });
  })
  .delete("/:meetingId", async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const meetingId = c.req.param("meetingId");

    const existing = await db.meeting.findFirst({
      where: {
        id: meetingId,
        project: { userToProjects: { some: { userId } } },
      },
      select: { id: true },
    });
    if (!existing) return c.json({ error: "Meeting not found" }, 404);

    await db.meeting.delete({
      where: { id: meetingId },
    });

    return c.json({ success: true });
  });
