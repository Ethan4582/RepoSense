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
      const { projectId, meetingUrl, name } = c.req.valid("json");

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
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId query parameter required" }, 400);
    }

    const meetings = await db.meeting.findMany({
      where: { projectId },
      include: { issues: true },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ meetings });
  })
  .get("/:meetingId", async (c) => {
    const db = c.get("db");
    const meetingId = c.req.param("meetingId");

    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: { issues: true },
    });

    if (!meeting) {
      return c.json({ error: "Meeting not found" }, 404);
    }

    return c.json({ meeting });
  })
  .delete("/:meetingId", async (c) => {
    const db = c.get("db");
    const meetingId = c.req.param("meetingId");

    await db.meeting.delete({
      where: { id: meetingId },
    });

    return c.json({ success: true });
  });
