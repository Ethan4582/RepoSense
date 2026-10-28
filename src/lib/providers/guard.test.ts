import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    apiKey: { findUnique },
  },
}));

vi.mock("~/lib/providers", () => ({
  decryptKey: vi.fn(),
  getDefaultChatModel: vi.fn(() => "chat-model"),
  getDefaultEmbeddingModel: vi.fn(() => "embedding-model"),
  getEncryptionSecret: vi.fn(() => "test-secret"),
  getModelInfo: vi.fn(() => null),
}));

import {
  ProviderAccessError,
  getDecryptedProviderKey,
  resolveProjectKeys,
} from "./guard";

describe("BYOK provider guard", () => {
  beforeEach(() => findUnique.mockReset());

  it("looks up a key only for the acting user and requested provider", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      getDecryptedProviderKey("public-wiki-viewer", "OPENAI"),
    ).resolves.toBeNull();

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        userId_provider: {
          userId: "public-wiki-viewer",
          provider: "OPENAI",
        },
      },
    });
  });

  it("rejects QA when the acting user has no valid personal key", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      resolveProjectKeys("public-wiki-viewer", {
        chatProvider: "OPENAI",
        chatModel: "chat-model",
        embeddingProvider: "OPENAI",
        embeddingModel: "embedding-model",
      }),
    ).rejects.toMatchObject<Partial<ProviderAccessError>>({
      code: "MISSING_CHAT_KEY",
    });
  });
});
