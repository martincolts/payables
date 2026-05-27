import { hc } from "hono/client";
import type { AppType } from "@payables/backend";

/**
 * Typed Hono RPC client. `AppType` is inferred from the backend's route
 * definitions, so request params and response shapes stay in sync with the
 * server automatically — no hand-written endpoint types.
 *
 * In dev, Vite proxies `/api` → http://localhost:8080 (see vite.config.ts).
 */
const baseUrl = import.meta.env.VITE_API_URL ?? "";

export const api = hc<AppType>(baseUrl, {
  init: { credentials: "include" },
  headers(): Record<string, string> {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
