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
  if (maintenanceActive() && c.req.path !== "/api/health") {
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
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization", "x-clerk-user-id"],
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
