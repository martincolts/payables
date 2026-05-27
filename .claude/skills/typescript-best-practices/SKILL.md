---
name: typescript-best-practices
description: Idiomatic TypeScript style for the prode backend (Node + Hono) — typing, errors, async, naming, module design, concurrency. Apply when writing or reviewing any .ts file in the backend project.
---

# TypeScript Best Practices (prode backend)

The backend is **Node + Hono + Drizzle**, written in strict TypeScript and run with `pnpm` (see [[pnpm]]). ESM modules only.

## Types

- `"strict": true` in `tsconfig.json`. No `any` — use `unknown` and narrow, or define the type.
- Let inference do the work for locals; annotate function **parameters and return types** at module boundaries (exported functions, service/repo methods).
- Model state machines and variants with discriminated unions, not boolean flags or optional grab-bags.
- Derive types from a single source of truth: infer DTOs from Zod schemas (`z.infer<typeof schema>`) and row types from Drizzle (`typeof bills.$inferSelect`) — don't hand-maintain a parallel `interface`.
- `as` casts only at trust boundaries (parsed JSON, env vars); never to silence the compiler. No `// @ts-ignore`/`// @ts-expect-error` without a comment explaining why.
- `readonly` on fields and `ReadonlyArray<T>` where mutation isn't intended. Prefer `type` aliases; use `interface` only when you need declaration merging.

## Errors

- Throw `Error` (or a subclass), never strings or plain objects. Define typed domain errors in `src/types` (e.g. `NotFoundError`, `ConflictError`, `ValidationError`) so layers map them without importing Drizzle or Hono.
- Add context when rethrowing: `throw new Error(\`fetch bill \${id}\`, { cause: err })`. Use the `cause` option, don't string-concatenate the original.
- Never swallow errors. No empty `catch {}` unless you genuinely don't care and a comment says why.
- Don't log AND rethrow — pick one. Let the top of the stack (an `onError` handler in Hono) log and translate to an HTTP status.
- Validate all external input (request bodies, query params, env) with **Zod** at the edge; downstream code receives already-typed, already-validated data.

## Async

- `async`/`await` everywhere; never mix in raw `.then()` chains. No floating promises — `await` it, `return` it, or explicitly `void` it.
- Run independent awaits concurrently with `Promise.all`; don't serialize calls that don't depend on each other.
- Propagate `AbortSignal` for cancellable work (`c.req.raw.signal` in Hono) into fetch / long operations.
- Top-level `await` is available in ESM — use it for startup wiring in the entrypoint rather than an IIFE.

## Naming

- `camelCase` for variables/functions, `PascalCase` for types/classes/enums, `UPPER_SNAKE_CASE` for true constants.
- Files: `camelCase.ts` for modules (`billService.ts`, `billRepo.ts`), `PascalCase.ts` only if the file's primary export is a class/type of that name.
- Avoid stutter: `bill.Status`, not `bill.BillStatus`. A factory is `createBillService`, not `createBillServiceFactory`.
- Boolean names read as predicates: `isPaid`, `hasApprover`, `canTransition`.

## Module design

- One responsibility per file. Split when a file grows past ~300–400 lines.
- Named exports only — no `export default` in the backend. No barrel `index.ts` re-export files unless they define an intentional public API.
- Define interfaces where they're **consumed**, not where they're implemented: a service declares the repo shape it needs; the repo module just exports the concrete object/class (see [[layered-architecture]]).
- Wire dependencies explicitly at the entrypoint (`src/index.ts`). No module-level singletons holding the DB pool or config — pass them in.

## Functions & classes

- Prefer plain functions and factory functions returning typed objects over classes; reach for a `class` only when you need instances with shared mutable state or want `instanceof` (e.g. error subclasses).
- Keep parameter lists short; use a single typed options object once you pass more than ~3 arguments.
- Pure functions where possible — easier to unit-test without a DB.

## Concurrency

- Node is single-threaded for your code; "concurrency" here means overlapping I/O via promises, not threads.
- Bound fan-out — don't fire 10 000 `Promise.all` queries at once; batch (e.g. `p-map` with a concurrency limit) or push it into one SQL statement.
- Reach for `worker_threads` only for genuinely CPU-bound work; almost nothing in this CRUD/finance backend qualifies.

## Tests

- **Vitest.** Co-locate as `*.test.ts` or under `__tests__/`.
- Table-driven style for pure functions: `it.each([...])`.
- Repo tests hit a real Postgres (Testcontainers or a disposable test DB); service tests use a hand-written fake repo object that satisfies the consumer interface — don't mock Drizzle.
- Assert on behavior and error type (`await expect(fn()).rejects.toBeInstanceOf(NotFoundError)`), not on log output.

## Formatting & lint

- **Prettier** for formatting, **ESLint** (`typescript-eslint`) for correctness — CI fails on diff or lint error.
- Enable at least: `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `no-explicit-any`, `consistent-type-imports`, `eqeqeq`.
- Use `import type { ... }` for type-only imports.

## Misc

- `const` by default; `let` only when reassigned; never `var`.
- `===` / `!==` only. Use `??` for nullish defaults and `?.` for optional chaining — don't conflate `null`/`undefined` with `0`/`''`.
- Read config from env once at startup, validate with Zod, and pass the typed config object down. No scattered `process.env.X` reads.
- Money/amounts: never `number` floats for currency — use string/decimal columns and a decimal library at the edges (Postgres `numeric` ↔ string), consistent with the data model.
