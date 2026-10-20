import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import {
  encryptKeyWithIv,
  decryptKey,
  getKeyLast4,
  validateProviderKey,
} from "~/lib/providers";

const getEncryptionSecret = (): string => {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    // Development fallback to prevent crashes if not set
    return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  }
  return secret;
};

export const keysRoutes = new Hono<AuthContext>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const keys = await db.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        keyLast4: true,
        label: true,
        status: true,
        lastVerifiedAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ keys });
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]),
        apiKey: z.string().min(5, "API key is too short"),
        label: z.string().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const { provider, apiKey, label } = c.req.valid("json");

      // Verify the key live with the provider
      const verifyResult = await validateProviderKey(provider as ProviderId, apiKey);
      const status = verifyResult.valid ? "VALID" : verifyResult.error?.code === "QUOTA_EXHAUSTED" ? "QUOTA_EXHAUSTED" : "INVALID";

      // Encrypt the key
      const secret = getEncryptionSecret();
      const { encryptedKey, iv } = await encryptKeyWithIv(apiKey, secret);
      const keyLast4 = getKeyLast4(apiKey);

      const saved = await db.apiKey.upsert({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
        create: {
          userId,
          provider,
          encryptedKey,
          iv,
          keyLast4,
          label: label ?? null,
          status,
          lastVerifiedAt: new Date(),
        },
        update: {
          encryptedKey,
          iv,
          keyLast4,
          label: label ?? null,
          status,
          lastVerifiedAt: new Date(),
        },
        select: {
          id: true,
          provider: true,
          keyLast4: true,
          label: true,
          status: true,
          lastVerifiedAt: true,
          createdAt: true,
        },
      });

      return c.json({
        key: saved,
        verification: verifyResult,
      });
    }
  )
  .post(
    "/:provider/test",
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const providerParam = c.req.param("provider").toUpperCase() as ProviderId;

      const record = await db.apiKey.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: providerParam as any,
          },
        },
      });

      if (!record) {
        return c.json({ error: "Key not found for this provider" }, 404);
      }

      const secret = getEncryptionSecret();
      const plainKey = await decryptKey({ encryptedKey: record.encryptedKey, iv: record.iv }, secret);

      const verifyResult = await validateProviderKey(providerParam, plainKey);
      const newStatus = verifyResult.valid ? "VALID" : verifyResult.error?.code === "QUOTA_EXHAUSTED" ? "QUOTA_EXHAUSTED" : "INVALID";

      const updated = await db.apiKey.update({
        where: { id: record.id },
        data: {
          status: newStatus,
          lastVerifiedAt: new Date(),
        },
        select: {
          id: true,
          provider: true,
          keyLast4: true,
          status: true,
          lastVerifiedAt: true,
        },
      });

      return c.json({
        key: updated,
        verification: verifyResult,
      });
    }
  )
  .delete(
    "/:provider",
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const providerParam = c.req.param("provider").toUpperCase();

      await db.apiKey.deleteMany({
        where: {
          userId,
          provider: providerParam as any,
        },
      });

      return c.json({ success: true, message: `Key for ${providerParam} removed` });
    }
  );
