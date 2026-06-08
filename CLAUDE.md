# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Payables — an Accounts-Payable MVP (inspired by Ramp Bill Pay). A finance team onboards vendors, captures bills, routes them through a multi-approval workflow, schedules/simulates payment, and tracks AP aging. Everything is **multi-tenant**: every user, vendor, and bill belongs to an `organization`, and every query is scoped by `organizationId` (taken from the JWT, never from the request body).

Nx + pnpm monorepo: `apps/backend` (Hono API), `apps/frontend` (React SPA), `libs/shared` (Zod schemas + types shared by both).

## Commands

Use **pnpm** (not npm/yarn) and run Nx targets. Node 24 (`.nvmrc`); `corepack enable pnpm` first.

```bash
# First-time setup
pnpm install
docker compose up -d postgres        # local Postgres on :5432
pnpm nx run backend:migrate          # apply drizzle migrations
pnpm nx run backend:seed             # seed "Payables Demo Co" demo org

# Dev servers — backend :8080, frontend :5173 (Vite proxies /api → :8080)
pnpm nx run-many -t serve            # both
pnpm nx run backend:serve            # backend only (tsx watch)
pnpm nx run frontend:serve           # frontend only

# Typecheck / lint / build (all projects)
pnpm typecheck      # == nx run-many -t typecheck  (tsc --noEmit)
pnpm lint
pnpm build

# Schema changes: edit src/db/schema/*, then
pnpm nx run backend:generate         # generate SQL migration from schema
pnpm nx run backend:migrate          # apply it
```

### Tests (backend, Vitest)

```bash
pnpm nx run backend:test                              # all backend tests
# Single file / pattern — run vitest from apps/backend:
cd apps/backend && pnpm exec vitest run src/integration/bills.integration.test.ts
cd apps/backend && pnpm exec vitest run -t "rejects a bill"   # by test name
```

Tests hit a **real Postgres** (no mocks for the DB): each test file creates and drops its own database, so `DATABASE_URL` must point at a running server. `fileParallelism: false` — files run serially on purpose; don't re-enable it. Helpers live in `apps/backend/src/test/` (`testDb.ts`, `testApp.ts`, `factories.ts`, `repoHelpers.ts`).

## Architecture

### Layered backend: routes → services → repositories

Strict one-way dependency. Each layer is a `createX(deps)` factory (manual DI), wired together in `apps/backend/src/app.ts` (`createApp(config, db)`). When adding a feature, thread it through all three layers:

- **Repositories** (`repositories/*Repo.ts`) — the only place that touches Drizzle/SQL. Return plain rows; map Postgres errors via `lib/pgErrors.ts`.
- **Services** (`services/*Service.ts`) — business logic, authorization checks, orchestration, transactions. Throw `DomainError` subclasses from `types/errors.ts` (each carries an HTTP status).
- **Routes** (`routes/*Routes.ts`) — Hono routers; validate input with `zValidator` against schemas from `@payables/shared`, pull `user`/`organizationId` from context, call the service. No business logic here.

`app.onError` maps `DomainError` → its status and `HTTPException` → its status; anything else → 500. So throwing the right error subclass in a service is how you return a non-200.

### The type contract is inferred end-to-end (don't hand-duplicate it)

`createApp` returns `api`, and `AppType = ReturnType<typeof createApp>["api"]` is exported from the backend. The frontend builds a typed Hono RPC client with `hc<AppType>` (`apps/frontend/src/api/client.ts`). **Request params and response shapes flow from the backend route definitions to the frontend automatically** — there are no hand-written endpoint types. Changing a route's shape changes the frontend's types; keep routes well-typed.

`libs/shared` holds the Zod schemas (and inferred TS types) used by both sides — validation on the backend, form/typing on the frontend. Add new request/response schemas there.

### Auth & multi-tenancy

JWT bearer tokens. In `app.ts`, `/api/auth` and `/api/invite` are public; everything after `authMiddleware` requires a valid token. The middleware puts an `AuthUser` (`id`, `organizationId`, `role`) on the Hono context. Routes get the org from `c.get("user").organizationId` — **services must scope every query by it**. Role gates: `requireAdmin` and `requireApprover` middleware (`middleware/auth.ts`); roles are `admin` and `approver`.

### Bill lifecycle is a server-side state machine

`services/billStateMachine.ts` is the source of truth for legal status transitions:

```
draft → pending_approval → approved → scheduled → paid
                       ↘ rejected → draft
approved/scheduled → payment_failed → (paid | approved)
```

`assertTransition(from, to)` throws `InvalidTransitionError` (→ 422) on an illegal edge. The frontend only surfaces actions that map to a legal edge — but the backend enforces it. Approvals require *N distinct* approvals (org-configured quorum); any single rejection sends the bill back to `draft`. Every transition is recorded in the activity log with actor + timestamp.

### Mocked seams (where real integrations would slot in)

Two integrations are deliberately faked behind a service so they can be swapped without touching routes/schema/frontend:

- **Invoice extraction** — `POST /api/bills/extract` → `extractionService.extract(file)` returns canned structured fields + confidence scores; the uploaded file is **not persisted**. Real version → AWS Textract / Google Document AI / an LLM, mapping into the same `ExtractedInvoice` shape.
- **Payments** — "simulate payment" transitions the bill; no money moves. Real version → Modern Treasury / Stripe Treasury behind `paymentService`, driven by idempotent webhooks `processing → paid|failed`.

## Conventions (enforced by `.claude/skills/` — read the relevant SKILL.md before editing)

There are project skills for `drizzle-orm`, `layered-architecture`, `typescript-best-practices`, `react-best-practices`, `react-toastify`, `pnpm`, plus testing skills. Non-obvious hard rules:

- **Every list endpoint MUST be paginated** (`list-pagination` skill): page/pageSize (1-based), offset computed server-side and never exposed. Use `paginationQuerySchema` from `@payables/shared`.
- **Tests ship with the change, same commit.** Add/change a route, middleware, or request/response contract → create/update the matching `src/integration/*.integration.test.ts`. Add/change a `*Repo.ts` method → update the matching `*Repo.test.ts`.
- **Frontend user feedback goes through react-toastify**, never MUI `<Alert>`, `window.alert`, or inline error state.
- Frontend data fetching is **TanStack Query** over the typed `api` client; tables use TanStack Table; UI is MUI; routing is react-router.
- ESM throughout: backend imports use `.js` extensions on relative paths (e.g. `./services/billService.js`) even though sources are `.ts`.
