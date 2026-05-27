---
name: drizzle-orm
description: Patterns and pitfalls for Drizzle ORM + node-postgres in the prode backend — schema, pool/client setup, queries, transactions, pagination, error mapping. Apply when writing or reviewing repository code or anything touching the database.
---

# Drizzle ORM

The backend uses **Drizzle ORM** over `node-postgres` (`pg`) against Postgres. Drizzle gives us a type-safe, SQL-shaped query builder — no ORM "magic", the generated SQL is predictable — plus `drizzle-kit` for migrations. Repos own all DB access; nothing above the repo layer imports `drizzle-orm` (see [[layered-architecture]]).

> If the project ever switches to Prisma, the same layering rules apply — only this skill's query syntax changes.

## Client setup

Create the pool and the Drizzle client once at startup (in `src/db/client.ts`) and pass `db` down. Never open a connection per request.

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type DB = ReturnType<typeof createDb>['db'];
```

`await pool.end()` on graceful shutdown. The `{ schema }` argument enables the typed relational query API (`db.query.bills.findMany(...)`).

## Schema

One file per table group in `src/db/schema/`, re-exported from `schema/index.ts`. Use Postgres-native types; `numeric` for money (maps to `string`, never `number` — see [[typescript-best-practices]]).

```ts
import { pgTable, uuid, text, numeric, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const billStatus = pgEnum('bill_status', [
  'draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'paid',
]);

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  invoiceNumber: text('invoice_number'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: billStatus('status').notNull().default('draft'),
  memo: text('memo'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
```

Derive row types with `$inferSelect` / `$inferInsert` — don't hand-write a parallel interface.

## Migrations (drizzle-kit)

Schema is the source of truth. Generate versioned SQL from it; never edit applied migrations.

```sh
pnpm drizzle-kit generate   # diff schema -> new SQL migration in ./drizzle
pnpm drizzle-kit migrate    # apply pending migrations
```

`drizzle.config.ts` points at the schema glob and `DATABASE_URL`. Commit the generated `./drizzle/*.sql` files — they're the auditable history.

## Queries

Import column helpers from `drizzle-orm`; build queries on `db`.

```ts
import { eq, and, desc, sql } from 'drizzle-orm';

// single row
const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
if (!bill) throw new NotFoundError(`bill ${id}`);

// filtered list
const rows = await db
  .select()
  .from(bills)
  .where(and(eq(bills.vendorId, vendorId), eq(bills.status, 'approved')))
  .orderBy(desc(bills.createdAt), desc(bills.id));
```

- Select only the columns you need with a projection object when you don't want the whole row; full-row `db.select().from(t)` is fine for small tables.
- Joins/relations: prefer the relational query API (`db.query.bills.findMany({ with: { vendor: true } })`) for read models; use the core builder for writes and aggregates.
- Parameterization is automatic — Drizzle never string-interpolates your values. For raw fragments use the `sql` template tag (`sql\`count(*) over ()\``), which is still parameterized.

## Transactions

```ts
await db.transaction(async (tx) => {
  await tx.update(bills).set({ status: 'scheduled' }).where(eq(bills.id, id));
  await tx.insert(activityLog).values({ billId: id, userId, action: 'scheduled' });
});
```

- Throw inside the callback to roll back; the helper commits when it resolves.
- `tx` has the same type as `db`, so repo methods can accept either. Have repo methods take the executor as a parameter (`db: DB | Transaction`) so a service can compose multiple repo calls in one transaction — the state-machine + activity-log write must be atomic.

## Error mapping

Map DB-specific failures to domain errors **at the repo boundary** so services stay driver-agnostic.

```ts
import { DatabaseError } from 'pg';

try {
  const [row] = await db.insert(vendors).values(input).returning();
  return row;
} catch (err) {
  if (err instanceof DatabaseError && err.code === '23505') {
    throw new ConflictError('vendor already exists');   // unique_violation
  }
  throw err;
}
```

- Empty result → throw `NotFoundError` (see the `if (!bill)` pattern above); Drizzle returns `[]`, not an error.
- Common Postgres codes: `23505` unique, `23503` FK violation, `23514` check constraint. Translate the ones the service cares about; let the rest bubble to the top-level handler.
- Never leak a `pg`/`drizzle` error past the repo.

## Pagination

List repo methods return `(items, total)` and order by a stable `(sortKey, id)` composite. Get the count in the same round trip with a window function. Full pattern in [[list-pagination]].

```ts
const rows = await db
  .select({ row: bills, total: sql<number>`count(*) over ()`.mapWith(Number) })
  .from(bills)
  .orderBy(desc(bills.createdAt), desc(bills.id))
  .limit(pageSize)
  .offset(offset);

const total = rows[0]?.total ?? 0;
const items = rows.map((r) => r.row);
```

## Naming conventions in this project

- Repo object: `billRepo` (or class `BillRepo`); methods `get` / `getById` / `list` / `create` / `update` / `delete` (+ qualifier: `getByEmail`, `listByVendor`).
- Schema column keys are `camelCase`; the actual DB column name (`snake_case`) is the string argument (`vendorId: uuid('vendor_id')`).
- Reusable query fragments (`count(*) over ()`, shared `where` builders) live near the repo, not duplicated across methods.

## Don'ts

- No raw string SQL concatenation. Use the builder or the `sql` tag with placeholders.
- No `db` access outside `src/.../repo` files — services and routes never import `drizzle-orm`.
- No `number` for `numeric`/money columns — keep them as strings end to end.
- Don't run the page query and the count query as two separate round trips when `count(*) over ()` gives both.
- Don't edit a migration that's already been applied — generate a new one.
