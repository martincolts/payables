# Payables — Accounts Payable MVP

A modern accounts payable product inspired by Ramp Bill Pay. Built end-to-end with a focus on the core bill lifecycle, approval workflows, and payment tracking.

---

## What the product does

Payables is an internal finance tool that helps companies manage their vendor invoices from receipt to payment. The core loop is:

**Receive invoice → Create bill → Route for approval → Schedule payment → Mark as paid**

It gives finance teams visibility into what they owe, to whom, and when — with a lightweight approval layer to enforce controls before money goes out the door.

---

## Workflows prioritized

### 1. Bill lifecycle management (core)
Bills move through a clear state machine:

```
draft → pending_approval → approved → scheduled → paid
                        ↘ rejected → draft (with comment)
```

- Create bills manually with vendor, amount, due date, line items, and memo
- Visual status badges with overdue highlighting when `due_date < today && status != paid`
- Filter and search by status, vendor, and date range

### 2. Vendor management
- CRUD for vendors (name, email, payment method, bank account info)
- Vendor-level payment method defaults (ACH, wire, check)

### 3. Approval workflow
- Admins submit a draft bill for approval (`draft → pending_approval`)
- Approvers approve or reject, with a required comment on rejection
- **Configurable quorum:** each organization sets how many *distinct* approvers
  must approve a bill before it moves to `approved` (Settings → "Approvals
  required per bill"). Any single rejection moves it to `rejected`.
- Activity log per bill showing every state transition

### 3a. Organizations, team & invitations
- **Multi-tenant:** every user, vendor, and bill belongs to an organization.
  Signup creates a new organization with the signer as its first **admin**.
- Admins invite teammates as **admin** or **approver** from the Team page.
- Accepting an invitation activates the account (the invitee sets a password)
  and logs them straight in.
- **Note on invitations:** to keep the MVP self-contained, accepting an invite
  is an in-app flow — creating an invitation surfaces a link the admin shares
  manually. In a real application this link would be **emailed** to the invitee
  (e.g. via SendGrid/SES) rather than shown in the UI. The acceptance endpoint
  and token model are already exactly what an emailed link would use.

### 4. Payments
- Schedule a payment with a target date and method
- Mark bills as paid with a reference number (simulated — no real banking integration)
- Payment history per vendor

### 5. Dashboard
- Total AP outstanding
- Bills overdue / due this week / pending approval
- Quick-action shortcuts for the most common tasks

---

## What was left out and why

| Feature | Reason excluded |
|---|---|
| OCR / PDF invoice upload | High complexity, low MVP value — manually entering bills covers the workflow |
| Real payment execution | Requires banking integrations (Stripe Treasury, Modern Treasury, etc.). Payments are simulated: the user enters a reference number and marks the bill as paid manually |
| Multi-currency | Adds complexity to every amount calculation; USD-only is a valid MVP constraint |
| Recurring bills | Useful but a layer on top of the core flow |
| ERP sync (QuickBooks, NetSuite) | Integration work, not product work |
| AP Aging report | Valuable but derivable from bill data; dashboard metrics cover the essentials |
| Multi-entity / subsidiaries | Enterprise feature, premature for MVP |

---

## Current status

The Nx + pnpm monorepo is wired end-to-end through every layer (repository →
service → Hono route → typed RPC client → React page with pagination). Auth,
vendors, bills, **multi-tenant organizations**, **invitations**, and the
**configurable approval quorum** are implemented and covered by repository +
end-to-end integration tests (real Postgres, real Hono app). The bill state
machine is enforced server-side (`apps/backend/src/services/billStateMachine.ts`).
`nx run-many -t typecheck` and the backend test suite pass.

**Multi-tenancy note:** `users.email` is globally unique so login-by-email is
unambiguous (a person belongs to one org). A multi-org-membership model would
scope email per-org and resolve the org at login — deliberately out of scope.

## Setup instructions

### Prerequisites
- Node.js 24 (an `.nvmrc` pins it — run `nvm use`)
- pnpm 11 (`corepack enable pnpm`)
- PostgreSQL 14+ (only needed to actually serve the API / run migrations)

Nx and all build tooling are installed as workspace dependencies — no global installs needed.

### Clone & install

```bash
git clone
cd payables
nvm use          # selects Node 24 from .nvmrc
corepack enable pnpm
pnpm install     # installs every workspace package from the root
```

> On first install pnpm asks to approve native build scripts (esbuild, nx). They are pre-approved in `pnpm-workspace.yaml` under `allowBuilds`.

### Configure

```bash
cp apps/backend/.env.example apps/backend/.env
# Set DATABASE_URL and JWT_SECRET
cp apps/frontend/.env.example apps/frontend/.env
# Leave VITE_API_URL empty in dev — Vite proxies /api → http://localhost:8080
```

The backend validates its environment at startup with Zod (`apps/backend/src/config.ts`); it fails fast with a readable error if a required variable is missing.

### Database & migrations

```bash
createdb payables
pnpm nx run backend:generate   # drizzle-kit generate — diffs the schema into SQL under apps/backend/drizzle
pnpm nx run backend:migrate    # drizzle-kit migrate — applies those migrations
```

The schema is the source of truth in `apps/backend/src/db/schema`. After editing a table, re-run `generate` then `migrate`.

### Seed demo data

```bash
pnpm nx run backend:seed
```

Seeds a demo organization ("Payables Demo Co", configured to require **2
approvals** per bill), demo vendors (AWS, Stripe, Figma, WeWork, Notion), and a
spread of bills across statuses. Two demo accounts (password `password123`):

| Email | Role |
|---|---|
| `admin@payables.com` | admin — create/submit bills, manage the team & settings |
| `approver@payables.com` | approver — approve/reject bills pending approval |

The seed is idempotent: re-running reuses the existing demo org.

### Run

```bash
pnpm nx serve backend    # tsx watch — API at http://localhost:8080 (GET /health)
pnpm nx serve frontend   # Vite dev server — app at http://localhost:5173
```

Or start everything in parallel: `pnpm nx run-many -t serve`.

### Verify the workspace

```bash
pnpm nx run-many -t typecheck   # type-checks shared, backend, frontend (cached)
pnpm nx build frontend          # production Vite build
pnpm nx show projects           # → frontend, backend, shared
```

---

## Key architecture decisions

### Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Nx + pnpm workspaces | One repo, one lockfile; task graph + caching + `nx affected`; clean app/lib boundaries |
| Backend | Node + Hono (TypeScript) | Tiny, fast, type-first router; same language as the frontend, shared types across the repo |
| Data layer | Drizzle ORM + node-postgres | Type-safe, SQL-shaped queries — predictable generated SQL, no ORM "magic" hiding what runs |
| Migrations | drizzle-kit (schema-derived SQL) | Versioned, auditable migrations generated from the schema as the source of truth |
| Validation | Zod | One schema validates request DTOs and infers their TypeScript types at the edge |
| Frontend | React + TypeScript + MUI | Fast iteration, strong typing on API contracts, mobile-first PWA |
| Auth | JWT (HS256, via `jose`) | Stateless bearer tokens; a shared secret keeps the MVP simple. Swap to RS256/JWKS if it grows to multiple services |
| Database | PostgreSQL | Relational integrity and ACID transactions for payment state changes |

### Project structure

Nx workspace: deployable apps under `apps/`, shared code under `libs/`.

```
/apps
  /backend                  ← Node + Hono API
    /src
      index.ts              ← entrypoint: load config, wire deps, start server
      config.ts             ← env parsing/validation (Zod)
      /db
        client.ts           ← pg Pool + Drizzle client
        /schema             ← Drizzle tables (source of truth for migrations)
          index.ts
          users.ts
          vendors.ts
          bills.ts
          payments.ts
          approvals.ts
          activityLog.ts
        seed.ts             ← demo data seeder
      /types                ← domain types, Zod DTOs, sentinel errors
      /repositories         ← all DB access (Drizzle); maps PG errors → domain errors
          vendorRepo.ts
          billRepo.ts
          paymentRepo.ts
          approvalRepo.ts
          activityLogRepo.ts
      /services             ← business logic, state machine, validations
          billService.ts
      /routes               ← Hono handlers, request/response DTOs
          billRoutes.ts
          vendorRoutes.ts
          paymentRoutes.ts
      /middleware
          auth.ts
    drizzle.config.ts       ← drizzle-kit config (schema glob + DATABASE_URL)
    /drizzle                ← generated, versioned SQL migrations
  /frontend                 ← React + TypeScript PWA
    /src
      /api                  ← typed API client (fetch wrappers)
      /components
        /bills
        /vendors
        /dashboard
      /pages
        Dashboard.tsx
        Bills.tsx
        BillDetail.tsx
        Vendors.tsx
      /queries              ← TanStack Query hooks
      /types                ← frontend-only view types
/libs
  /shared                   ← @payables/shared: Zod schemas + domain enums shared by frontend + backend
nx.json                     ← Nx task/target config
pnpm-workspace.yaml         ← workspace package globs (apps/*, libs/*) + allowBuilds
tsconfig.base.json          ← shared compiler options + @payables/shared path alias
.nvmrc                      ← pins Node 24
README.md
```

### Sharing the contract: shared lib + Hono RPC

Two complementary mechanisms keep the frontend and backend in sync, with no hand-duplicated types:

- **`libs/shared` owns the models** — the domain enums and Zod schemas/DTOs (`bill.ts`, `vendor.ts`, `pagination.ts`). The backend imports them to validate requests *and* to build the Drizzle `pgEnum`s; the frontend imports the same types for forms. One source of truth for shapes.
- **[Hono RPC](https://hono.dev/docs/guides/rpc) owns the wire contract** — the backend exports `AppType` (`apps/backend/src/app.ts`) and the frontend's `apps/frontend/src/api/client.ts` builds a typed client with `hc<AppType>(...)`. Endpoint paths, query params, and response shapes are *inferred from the routes*, so the frontend won't compile against an endpoint that doesn't exist.

### Data model

The schema is defined in TypeScript with Drizzle (`apps/backend/src/db/schema`); `drizzle-kit generate` diffs it into the versioned SQL migrations under `apps/backend/drizzle`. The effective Postgres schema is:

```sql
CREATE TYPE bill_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'paid'
);

CREATE TYPE payment_method AS ENUM ('ach', 'wire', 'check');

CREATE TABLE vendors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  payment_method payment_method NOT NULL,
  bank_last4     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bills (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES vendors(id),
  invoice_number TEXT,
  amount         NUMERIC(12, 2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  status         bill_status NOT NULL DEFAULT 'draft',
  memo           TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bill_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  category    TEXT,
  gl_account  TEXT
);

CREATE TABLE approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID NOT NULL REFERENCES bills(id),
  approver_id UUID NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id          UUID NOT NULL UNIQUE REFERENCES bills(id),
  amount           NUMERIC(12, 2) NOT NULL,
  method           payment_method NOT NULL,
  reference_number TEXT,
  scheduled_date   DATE,
  paid_at          TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'scheduled' -- scheduled | paid | failed
);

CREATE TABLE activity_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID NOT NULL REFERENCES bills(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Repository pattern

Each domain entity has a repository that owns its Drizzle queries. Services declare the slice of the repo they need as a TypeScript type (consumer-side interface), so business logic stays independent of the database and is easy to test with a hand-written fake.

```ts
// the shape the service depends on
type BillRepo = {
  create(input: NewBill): Promise<Bill>;
  getById(id: string): Promise<Bill>;
  list(params: ListBillsInput): Promise<{ items: Bill[]; total: number }>;
  updateStatus(id: string, status: BillStatus): Promise<void>;
};

// concrete implementation (apps/backend/src/repositories/billRepo.ts)
export function createBillRepo(db: DB): BillRepo {
  /* Drizzle queries; maps Postgres errors → domain errors at this boundary */
}
```

### State machine is enforced server-side

Bill status transitions are validated in `billService.ts` before any DB write. The API returns a 422 on illegal transitions (e.g. `paid → draft`). The frontend reflects valid actions only, but the backend is the source of truth.

### Activity log is append-only

Every state transition writes an immutable row to `activity_log`. This gives a full audit trail per bill — important in financial workflows where you need to know who approved what and when.

### Payments are simulated

There is no real banking integration. When a user marks a bill as paid, they provide a reference number (e.g. a wire confirmation or ACH trace ID) and the system records the payment and transitions the bill to `paid`. Integrating a real payment rail (Modern Treasury, Stripe Treasury) would slot in at the service layer without touching the rest of the stack.