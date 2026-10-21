import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

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
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
  })
  .patch(
    "/defaults",
    zValidator(
      "json",
      z.object({
        defaultChatProvider: z.enum(PROVIDERS).optional(),
        defaultChatModel: z.string().optional(),
        defaultEmbeddingProvider: z.enum(["GEMINI", "OPENAI"]).optional(),
        preferences: z.any().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const data = c.req.valid("json");

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          ...(data.defaultChatProvider !== undefined && {
            defaultChatProvider: data.defaultChatProvider,
          }),
          ...(data.defaultChatModel !== undefined && {
            defaultChatModel: data.defaultChatModel,
          }),
          ...(data.defaultEmbeddingProvider !== undefined && {
            defaultEmbeddingProvider: data.defaultEmbeddingProvider,
          }),
          ...(data.preferences !== undefined && { preferences: data.preferences }),
        },
        select: {
          id: true,
          defaultChatProvider: true,
          defaultChatModel: true,
          defaultEmbeddingProvider: true,
          preferences: true,
        },
      });

      return c.json({ user: updated });
    }
  );
