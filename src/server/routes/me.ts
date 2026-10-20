import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";

export const meRoutes = new Hono<AuthContext>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailAddress: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        defaultChatProvider: true,
        defaultChatModel: true,
        defaultEmbeddingProvider: true,
        createdAt: true,
      },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  })
  .patch(
    "/defaults",
    zValidator(
      "json",
      z.object({
        defaultChatProvider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).nullable().optional(),
        defaultChatModel: z.string().nullable().optional(),
        defaultEmbeddingProvider: z.enum(["GEMINI", "OPENAI"]).nullable().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const data = c.req.valid("json");

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          ...(data.defaultChatProvider !== undefined && { defaultChatProvider: data.defaultChatProvider }),
          ...(data.defaultChatModel !== undefined && { defaultChatModel: data.defaultChatModel }),
          ...(data.defaultEmbeddingProvider !== undefined && { defaultEmbeddingProvider: data.defaultEmbeddingProvider }),
        },
        select: {
          id: true,
          defaultChatProvider: true,
          defaultChatModel: true,
          defaultEmbeddingProvider: true,
        },
      });

      return c.json({ user: updated });
    }
  );
