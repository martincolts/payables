---
name: integration-testing
description: How to write and maintain end-to-end integration tests for the prode backend (Vitest + real Postgres + the real Hono app driven through the typed Hono RPC client). Apply whenever you add/change/remove an API endpoint, route, middleware, or the request/response contract of a service it exposes — the matching `*.integration.test.ts` MUST be created or updated in the same change.
---

# Integration Testing

Integration tests in `apps/backend/src/integration/` exercise the **whole backend stack at once** — routing, zod validation, auth middleware, services, repositories, and real SQL — by booting the actual Hono app against a throwaway Postgres database and calling it through the **same typed Hono RPC client (`hc<AppType>`) the frontend uses**. No mocks, no hand-written request types: if the wire contract breaks, these tests break.

This is the layer above [[repository-testing]] (which tests one repo in isolation). Repo tests prove the DB boundary; integration tests prove the HTTP contract and the wiring between [[layered-architecture]] layers.

## The rule

Treat the integration test as part of the endpoint. When you:

- **add an endpoint** (new route, new method on a router) → add a `describe` block covering its success shape, its validation/`400` cases, its auth gate (`401` if it's behind `authMiddleware`), and every domain error it maps (`404`/`409`/`401`).
- **change a contract** (new field, new query filter, changed status code, changed validation) → update the assertions that cover it.
- **remove an endpoint** → remove its tests.
- **add a way to create an entity via the API** → add a factory for it in [factories.ts](apps/backend/src/test/factories.ts) and use it (see the `createBill` note below).

An API change without the corresponding integration-test change is incomplete. Run `pnpm nx run backend:test` before considering the work done. This complements — does not replace — the repo-level rule in [[repository-testing]]: a change that touches both a repo and its endpoint updates **both** test layers.

## Isolation model: real app + one throwaway database per file

Each test file boots its own app instance against its own freshly-migrated database, so suites are fully independent. The harness is [src/test/testApp.ts](apps/backend/src/test/testApp.ts):

1. `createTestApp()` calls [`createTestDb()`](apps/backend/src/test/testDb.ts) (the same `CREATE DATABASE test_<uuid>` + migrate helper repo tests use),
2. builds the real app via `createApp(testConfig, testDb.db)` — same `createApp` production uses, just handed the test DB and a fixed `JWT_SECRET` so tokens it mints verify against its own auth middleware,
3. returns a `hc<AppType>` **client whose `fetch` is wired to `app.request`** — calls run in-process, no listening socket, no port, no network flake,
4. returns `{ client, testDb, cleanup }`; `cleanup()` ends the pool and `DROP DATABASE`s it.

Wire it up once per file with `beforeAll`/`afterAll`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeaders, createTestApp, type TestApp } from "../test/testApp.js";
import { authToken } from "../test/factories.js";

describe("vendors (integration)", () => {
  let app: TestApp;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await authToken(app.client); // an authenticated caller
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ...describe blocks per endpoint
});
```

Tests need a running Postgres (the docker-compose one) and a reachable `DATABASE_URL`; `vitest.config.ts` loads the root `.env` and runs files serially (`fileParallelism: false`). Use `pnpm` and Node 22+ ([[pnpm]]). Files are matched by the existing `src/**/*.test.ts` glob, so name them `*.integration.test.ts` and put them in `src/integration/`.

## Build state through the API, never the DB

This is the defining discipline of this layer: **set up data by calling the API the same way a client would.** To have a user, register one (`POST /api/auth/signup`); to have a vendor, POST it as an authenticated caller. The factories in [factories.ts](apps/backend/src/test/factories.ts) do exactly this and generate unique values so suites don't collide on unique constraints:

- `registerUser(client, overrides?)` → `{ token, user }` via signup (signup always creates an `admin`).
- `authToken(client, overrides?)` → just the bearer token, the common case.
- `createVendor(client, token, overrides?)` → a vendor via `POST /api/vendors`.

Pass auth on protected calls with `authHeaders(token)` as the **second** RPC argument: `client.api.vendors.$post({ json: {...} }, authHeaders(token))`. RPC call shapes mirror the routes: `client.api.auth.login.$post({ json })`, `client.api.me.$get(undefined, authHeaders(token))`, `client.api.vendors[":id"].$get({ param: { id } }, authHeaders(token))`, `client.api.bills.$get({ query: { page: "1", pageSize: "2" } }, authHeaders(token))`.

Do **not** reach into `testDb.db` to insert rows that an endpoint could create — that bypasses the contract you're trying to test. The one principled exception is FK prerequisites for which **no creation endpoint exists yet** (see below); prefer adding the endpoint + factory over a raw insert.

## Practices these tests follow

- **One `describe` per endpoint**, named for it (`describe("POST /api/auth/signup", ...)`), with an `it` per behavior.
- **Assert the HTTP status explicitly** (`expect(res.status).toBe(201)`) *and* the parsed body shape — exact values, not just truthiness. Use `toMatchObject` for partial body checks.
- **Cover the contract, not just the happy path.** For each endpoint: success shape; validation failures (`400` — e.g. malformed email, too-short password, bad enum); the auth gate (`401` for missing/garbage token on protected routes); and every domain error mapped by `app.onError` (`409` duplicate, `404` not-found via the `00000000-0000-0000-0000-000000000000` sentinel id).
- **Never leak secrets in responses** — assert `expect(body.user).not.toHaveProperty("passwordHash")`.
- **Pagination count contract** ([[list-pagination]]): give the suite its **own** `createTestApp()` so other tests don't perturb counts, seed N entities via factories, then assert a small `pageSize` truncates `items` while `total` stays N, `totalPages` is right, and `page: 2` continues without overlap.
- **Verify joins/enrichment surface over the wire** — e.g. a bill list item carries `vendorName`.

## Verification

```sh
pnpm nx run backend:test
```

All suites pass and leave **no** `test_*` databases behind (each `cleanup()` drops its own). Spot-check:

```sh
docker exec payables-postgres psql -U postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'test_%'"
```

## Known gap: bills are read-only

The bills API currently exposes only `GET /api/bills` and `GET /api/bills/:id` — there is **no** endpoint to create a bill, so [bills.integration.test.ts](apps/backend/src/integration/bills.integration.test.ts) covers only the auth gate, the empty-list shape, and `404`. When a bill-creation endpoint is added (route → service → repo, per [[layered-architecture]]), add a `createBill` factory to [factories.ts](apps/backend/src/test/factories.ts) and extend the bills suite with populated-list, filter (`status`/`vendorId`/`dueBefore`/`dueAfter`/`search`), ordering, and `vendorName`-join coverage. This is the concrete instance of the rule above: new endpoint ⇒ new tests in the same change.

## Anti-patterns to refuse

- Mocking the app, services, repos, or the DB client — these are full-stack integration tests; use the real app via `createTestApp()`.
- Seeding via raw `db.insert(...)` for data an endpoint could create — go through the API.
- Sharing one app/database across files, or relying on rows/IDs created by another suite.
- Starting a real HTTP listener / picking a port — the client talks to `app.request` in-process.
- Skipping `afterAll`'s `cleanup()` (leaks a database per run).
- Asserting only the status code while ignoring the body (or vice versa).
- Merging an API change without touching its `*.integration.test.ts`.
