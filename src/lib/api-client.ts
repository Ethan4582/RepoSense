import { hc } from "hono/client";
import type { AppType } from "~/server/app";

// In browser, window.location.origin is used; in SSR, NEXT_PUBLIC_API_URL or localhost
const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3000";
};

const honoApp = hc<AppType>(getBaseUrl());
export const client = honoApp.api;
