import { type Context } from "hono";
import type { Next } from "hono";
import { verifyToken } from "@clerk/nextjs/server";
import { db } from "~/server/db";

export type AuthContext = {
  Variables: {
    userId: string;
    db: typeof db;
  };
};

export async function clerkAuthMiddleware(c: Context<AuthContext>, next: Next) {
  // Allow health check without auth
  if (c.req.path === "/api/health" || c.req.path === "/health") {
    return next();
  }

  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // 2. Check Clerk session cookie if no Bearer header
  if (!token) {
    const cookieHeader = c.req.header("cookie");
    if (cookieHeader) {
      const match = /__session=([^;]+)/.exec(cookieHeader);
      if (match?.[1]) {
        token = match[1];
      }
    }
  }

  const secretKey = process.env.CLERK_SECRET_KEY;

  if (token && secretKey) {
    try {
      const verified = await verifyToken(token, {
        secretKey,
      });

      if (verified && verified.sub) {
        c.set("userId", verified.sub);
        c.set("db", db);
        return next();
      }
    } catch {
      // Token verification failed, fallback to Next.js headers if available
    }
  }

  // In Next.js local environment, Clerk middleware sets headers on the request
  const clerkUserId = c.req.header("x-clerk-user-id");
  if (clerkUserId) {
    c.set("userId", clerkUserId);
    c.set("db", db);
    return next();
  }

  return c.json({ error: "Unauthorized", message: "Valid authentication credentials are required." }, 401);
}
