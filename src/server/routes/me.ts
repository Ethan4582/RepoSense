import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import { alignChatModel } from "~/lib/providers/guard";

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
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const data = c.req.valid("json");

      const current =
        data.defaultChatProvider === undefined && data.defaultChatModel !== undefined
          ? await db.user.findUnique({
              where: { id: userId },
              select: { defaultChatProvider: true },
            })
          : null;
      const chatProvider = (data.defaultChatProvider ??
        current?.defaultChatProvider);
      const chatModel =
        data.defaultChatProvider !== undefined || data.defaultChatModel !== undefined
          ? alignChatModel(chatProvider ?? "OPENAI", data.defaultChatModel)
          : undefined;

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          ...(data.defaultChatProvider !== undefined && {
            defaultChatProvider: data.defaultChatProvider,
          }),
          ...(chatModel !== undefined && {
            defaultChatModel: chatModel,
          }),
          ...(data.defaultEmbeddingProvider !== undefined && {
            defaultEmbeddingProvider: data.defaultEmbeddingProvider,
          }),
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
