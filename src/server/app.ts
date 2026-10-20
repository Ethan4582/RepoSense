import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AuthContext } from "./auth";
import { clerkAuthMiddleware } from "./auth";
import { projectsRoutes } from "./routes/projects";
import { keysRoutes } from "./routes/keys";
import { meRoutes } from "./routes/me";
import { meetingsRoutes } from "./routes/meetings";

const app = new Hono<AuthContext>().basePath("/api");

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
