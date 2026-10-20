import { Hono } from "hono";
import type { AuthContext } from "../auth";
import { pollCommits } from "~/lib/github";

export const commitsRoutes = new Hono<AuthContext>().get(
  "/:id/commits",
  async (c) => {
    const projectId = c.req.param("id");
    const db = c.get("db");

    // Asynchronously poll latest commits in the background
    pollCommits(projectId).catch(console.error);

    const commits = await db.commit.findMany({
      where: { projectId },
      orderBy: { commmitDate: "desc" },
    });

    return c.json({ commits });
  }
);
