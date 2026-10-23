import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";

export const createPrismaClient = (databaseUrl?: string) => {
  const connectionString = databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const isCloudflareOrEdge =
    typeof (globalThis as any).WebSocketPair !== "undefined" ||
    (typeof navigator !== "undefined" && navigator.userAgent?.includes("Cloudflare")) ||
    (typeof process !== "undefined" && (process as any).release?.name === "workerd") ||
    (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge");

  const isPureNode =
    !isCloudflareOrEdge &&
    typeof process !== "undefined" &&
    process.release?.name === "node" &&
    process.env.NEXT_RUNTIME !== "edge";

  if (isPureNode) {
    return new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  if (typeof WebSocket !== "undefined") {
    neonConfig.webSocketConstructor = WebSocket;
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
  prismaConfigVersion?: string;
};

const CURRENT_CONFIG_VERSION = "2026-10-23-edge-compat-v1";
if (globalForPrisma.prismaConfigVersion !== CURRENT_CONFIG_VERSION) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaConfigVersion = CURRENT_CONFIG_VERSION;
}

export function getDb(databaseUrl?: string): PrismaClient {
  if (databaseUrl) {
    return createPrismaClient(databaseUrl);
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = globalForPrisma.prisma ?? undefined;
}