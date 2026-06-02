import { hc } from "hono/client";
import { createApp, type AppType } from "../app.js";
import type { Config } from "../config.js";
import { createTestDb, type TestDb } from "./testDb.js";

/**
 * Config used to boot the app under test. Mirrors `loadConfig` defaults but is
 * fully self-contained: no real network port (the client talks to the app
 * in-process via `app.request`, never a listening socket) and a fixed secret so
 * tokens minted by `signup`/`login` verify against the same auth middleware.
 */
const testConfig: Config = {
  NODE_ENV: "test",
  PORT: 0,
  DATABASE_URL: "in-process", // unused: createApp receives the Drizzle client directly
  JWT_SECRET: "integration-test-secret",
  CORS_ORIGIN: "http://localhost",
};

/** The typed Hono RPC client, identical to the one the frontend consumes. */
export type TestClient = ReturnType<typeof hc<AppType>>;

export type TestApp = {
  /** Typed RPC client (`client.api.auth.signup.$post(...)`, etc.). */
  client: TestClient;
  /**
   * Raw in-process request, for endpoints the typed client can't express (e.g.
   * `multipart/form-data` uploads). Same app, same routing — no network hop.
   */
  request: (input: Request | string | URL, init?: RequestInit) => Promise<Response>;
  /** The isolated test database, exposed for direct assertions when needed. */
  testDb: TestDb;
  /** Ends the pool and drops the throwaway database. Call in `afterAll`. */
  cleanup: () => Promise<void>;
};

/**
 * Boots the real Hono app against an isolated, freshly-migrated Postgres
 * database and returns a typed RPC client wired straight to `app.request` — no
 * HTTP listener, no port. This exercises the full stack (routing, validation,
 * middleware, services, repos, SQL) exactly as production does, just without
 * the network hop.
 *
 * Use in `beforeAll`/`afterAll` so each test file gets its own app + database:
 *
 * ```ts
 * let app: TestApp;
 * beforeAll(async () => { app = await createTestApp(); });
 * afterAll(async () => { await app.cleanup(); });
 * ```
 */
export async function createTestApp(): Promise<TestApp> {
  const testDb = await createTestDb();
  const { app } = createApp(testConfig, testDb.db);

  const client = hc<AppType>("http://localhost", {
    // Route every RPC call into the in-process app instead of the network.
    fetch: (input: Request | string | URL, init?: RequestInit) =>
      app.request(input, init),
  });

  return {
    client,
    request: async (input, init) => app.request(input, init),
    testDb,
    cleanup: testDb.cleanup,
  };
}

/** Bearer-auth options to pass as the second argument of any RPC call. */
export function authHeaders(token: string): { headers: { Authorization: string } } {
  return { headers: { Authorization: `Bearer ${token}` } };
}
