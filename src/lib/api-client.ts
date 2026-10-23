import { hc } from "hono/client";
import type { AppType } from "~/server/app";

export const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
};

const honoApp = hc<AppType>(getApiBaseUrl());
export const client = honoApp.api;
