---
name: repository-testing
description: How to write and maintain integration tests for repositories in the prode backend (Vitest + real Postgres). Apply whenever you create a new `*Repo.ts` or add/change/remove a method on an existing one — the matching `*Repo.test.ts` MUST be created or updated in the same change.
---

# Repository Testing

Every repository in `apps/backend/src/repositories/` has a sibling `*Repo.test.ts` that exercises it against a **real Postgres database**, not a mock. Repos are the DB boundary ([[layered-architecture]], [[drizzle-orm]]); their behavior — joins, filters, ordering, error mapping — only means anything against actual SQL.

## The rule

Treat the test as part of the repo. When you:

- **create a new repo** → create `*Repo.test.ts` beside it with coverage for every method.
- **add a method** → add a `describe` block for it.
- **change a method's behavior** (new filter, different ordering, new error case) → update or add the assertions that cover it.
- **remove a method** → remove its tests.

A repo change without the corresponding test change is incomplete. Run `pnpm nx run backend:test` before considering the work done.

## Isolation model: one throwaway database per test file

Each test file gets its **own** Postgres database so suites are fully independent and never see each other's rows. The helper [src/test/testDb.ts](apps/backend/src/test/testDb.ts) does this:

1. derives an admin connection from `DATABASE_URL`,
2. `CREATE DATABASE "test_<randomUUID>"`,
3. opens a pool against it and runs the committed Drizzle migrations (`drizzle-orm/node-postgres/migrator`, pointed at `apps/backend/drizzle`) — same migrations prod uses, so tests track the real schema,
4. returns `{ db, pool, cleanup }`; `cleanup()` ends the pool and `DROP DATABASE`s it.

Wire it up once per file with `beforeAll`/`afterAll`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUserRepo, type UserRepo } from "./userRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";

describe("userRepo", () => {
  let testDb: TestDb;
  let repo: UserRepo;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createUserRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  // ...describe blocks per method
});
```

Tests need a running Postgres (the docker-compose one) and a reachable `DATABASE_URL`. `vitest.config.ts` loads the root `.env` and sets `fileParallelism: false` so many files don't hammer the server with concurrent `CREATE`/`DROP DATABASE`. Use `pnpm` and Node 22+ ([[pnpm]]).

## Practices these tests follow

- **One `describe` per method**, named after it (`describe("create", ...)`, `describe("getById", ...)`), with an `it` per behavior. Keep assertion bodies specific — assert exact values, not just truthiness.
- **Seed inside the suite, not via the app seed script.** Because the DB is empty and yours alone, insert exactly the rows a test needs. For data the repo can create, use the repo itself; for FK prerequisites (e.g. bills need a user + vendors), insert with `db.insert(table).values(...).returning()` using the `schema` tables — mirror [seed.ts](apps/backend/src/db/seed.ts).
- **Cover the contract, not just the happy path.** For each method test: the success shape, edge inputs (e.g. optional `bankLast4` omitted → `null`, explicit non-default `role`), and every failure the repo maps — `getById` of a missing row → `NotFoundError`, duplicate unique key → `ConflictError`. Assert sentinel errors with `rejects.toBeInstanceOf(NotFoundError)`.
- **Assert the count contract on list methods.** `list` returns `{ items, total }` where `total` is the unpaged count ([[list-pagination]]). Test that a small `pageSize` truncates `items` while `total` stays the full count, and that `page: 2` continues where `page: 1` left off.
- **Test ordering explicitly** by comparing against a sorted copy: `expect(names).toEqual([...names].sort())` (vendors by name, bills by due date asc).
- **Exercise every filter branch** independently — for `billRepo.list` that means `status`, `vendorId`, `dueBefore`/`dueAfter` range, and `search` (which spans both invoice number *and* joined vendor name, so test both).
- **Verify joins surface their data** — e.g. a bill carries the joined `vendorName`.
- **Use a fixed nonexistent UUID** (`"00000000-0000-0000-0000-000000000000"`) for not-found cases.

## Verification

```sh
pnpm nx run backend:test
```

All suites should pass and leave **no** `test_*` databases behind (each `cleanup()` drops its own). Spot-check with:

```sh
docker exec payables-postgres psql -U postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'test_%'"
```

## Anti-patterns to refuse

- Mocking Drizzle or the `db` client — these are integration tests; use a real database via `createTestDb()`.
- Sharing one database across files, or relying on row counts/IDs created by another suite.
- Skipping `afterAll`'s `cleanup()` (leaks a database per run).
- Asserting only `total` while ignoring `items` (or vice versa) on list methods.
- Merging a repo change without touching its `*Repo.test.ts`.
