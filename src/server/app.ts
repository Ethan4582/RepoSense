import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AuthContext } from "./auth";
import { clerkAuthMiddleware } from "./auth";
import { projectsRoutes } from "./routes/projects";
import { keysRoutes } from "./routes/keys";
import { meRoutes } from "./routes/me";
import { meetingsRoutes } from "./routes/meetings";
import { publicRoutes } from "./routes/public";
import { maintenanceActive } from "~/lib/emergency";

const app = new Hono<AuthContext>().basePath("/api");

app.use("*", async (c, next) => {
  const path = c.req.path;
  if (maintenanceActive() && path !== "/api/health" && path !== "/health") {
    return c.json(
      {
        error: "RepoSense is currently under maintenance. Please check back shortly.",
        code: "MAINTENANCE",
      },
      503
    );
  }
  return next();
});

// Global Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return undefined;

      // Always allow public routes from any origin
      if (c.req.path.startsWith("/api/public")) return origin;

      try {
        const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
        const allowed = configured ? new URL(configured).origin : new URL(c.req.url).origin;
        if (origin === allowed) return origin;
        // Also allow *.pages.dev and configured custom domains
        if (origin.endsWith(".pages.dev") || origin.includes("aash7.xyz") || origin.endsWith(".workers.dev")) return origin;
        if (
          process.env.NODE_ENV !== "production" &&
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return origin;
        }
      } catch {
        // Invalid origin or configured URL.
      }

      return undefined;
    },
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Unauthenticated health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "reposense-api",
    timestamp: new Date().toISOString(),
  });
});

// Public wiki and explore endpoints (no Clerk, no user context)
app.route("/public", publicRoutes);

// Protect all remaining routes with Clerk authentication
app.use("*", clerkAuthMiddleware);

// Route Groups
const routes = app
  .route("/projects", projectsRoutes)
  .route("/keys", keysRoutes)
  .route("/me", meRoutes)
  .route("/meetings", meetingsRoutes);

export { app };
export type AppType = typeof routes;
