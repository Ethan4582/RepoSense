import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthContext } from "../auth";
import type { ProviderId } from "~/lib/providers";
import {
  encryptKeyWithIv,
  decryptKey,
  getEncryptionSecret,
  getKeyLast4,
  validateProviderKey,
} from "~/lib/providers";

const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"] as const;

function parseProvider(value: string): ProviderId | null {
  const provider = value.toUpperCase();
  return (PROVIDERS as readonly string[]).includes(provider) ? (provider as ProviderId) : null;
}

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
        provider: z.enum(PROVIDERS),
        apiKey: z.string().min(5, "API key is too short").max(500),
      })
    ),
    async (c) => {
      const userId = c.get("userId");
      const db = c.get("db");
      const { provider, apiKey } = c.req.valid("json");

      // Verify the key live with the provider
      const verifyResult = await validateProviderKey(provider, apiKey);
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
          status,
          lastVerifiedAt: new Date(),
        },
        update: {
          encryptedKey,
          iv,
          keyLast4,
          status,
          lastVerifiedAt: new Date(),
        },
        select: {
          id: true,
          provider: true,
          keyLast4: true,
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
      const providerParam = parseProvider(c.req.param("provider"));
      if (!providerParam) {
        return c.json({ error: "Unsupported provider" }, 400);
      }

      const record = await db.apiKey.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: providerParam,
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
      const providerParam = parseProvider(c.req.param("provider"));
      if (!providerParam) {
        return c.json({ error: "Unsupported provider" }, 400);
      }

      await db.apiKey.deleteMany({
        where: {
          userId,
          provider: providerParam,
        },
      });

      return c.json({ success: true, message: `Key for ${providerParam} removed` });
    }
  );
