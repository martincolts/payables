---
name: list-pagination
description: Every list endpoint in the prode backend MUST be paginated. Apply when adding or reviewing any handler/service/repo method that returns a collection (e.g. `list*`, `get*s`, `search*`). Default style is page/pageSize (1-based page number); offset is computed server-side and is never exposed to clients.
---

# List Pagination

**Rule:** No list endpoint may return an unbounded array. Every `list*` / `search*` / collection-returning operation — across [[layered-architecture]] (route, service, repo) — must accept paging params and return a page envelope. Reject any PR that adds `listAll(): Promise<Foo[]>` without pagination.

## Canonical pattern: page/pageSize

Clients pass `?page=N&pageSize=M` (1-based page number). The server caps `pageSize`, computes `offset = (page-1) * pageSize` internally, and returns the slice plus the total row count so the client can render `Page N of M`. Clients never send `offset` directly.

### Types (`types/pagination.ts`)

Define once, reuse everywhere. A Zod schema normalizes and caps the query params; the envelope is a generic type.

```ts
import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const pageParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PageParams = z.infer<typeof pageParams>;

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const offsetOf = (p: PageParams): number => (p.page - 1) * p.pageSize;
```

Coercion + `.max()` means a malformed or oversized `pageSize` is clamped/rejected at the edge — the service and repo always receive sane values.

### Route layer

Validate the query string with the shared schema; never trust the client's raw `pageSize`.

```ts
import { zValidator } from '@hono/zod-validator';
import { pageParams } from '../types/pagination';

userRoutes.get('/', zValidator('query', pageParams), async (c) => {
  const page = await svc.list(c.req.valid('query'));
  return c.json(page); // { items: [...], total: 123, page: 1, pageSize: 20 }
});
```

### Service layer

Assembles the response envelope. The repo returns `{ items, total }`.

```ts
import type { Page, PageParams } from '../types/pagination';
import type { User } from '../types/user';

async function list(params: PageParams): Promise<Page<User>> {
  const { items, total } = await repo.list(params);
  return { items, total, page: params.page, pageSize: params.pageSize };
}
```

### Repo layer

Stable composite ordering. Always `ORDER BY created_at DESC, id DESC` (or whatever sort the endpoint exposes) **with `id` as the tiebreaker** — otherwise rows with equal timestamps swap between pages. Get the page and the count in **one** round trip with `count(*) over ()`.

```ts
import { desc, sql } from 'drizzle-orm';
import { users } from '../db/schema';
import { offsetOf } from '../types/pagination';
import type { PageParams } from '../types/pagination';
import type { User } from '../types/user';

async function list(p: PageParams): Promise<{ items: User[]; total: number }> {
  const rows = await db
    .select({ row: users, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(p.pageSize)
    .offset(offsetOf(p));

  return { items: rows.map((r) => r.row), total: rows[0]?.total ?? 0 };
}
```

Apply [[drizzle-orm]] rules: builder/`sql` tag only, map errors, no string-concatenated SQL.

## Filters + pagination

Filters go in a sibling input schema that extends the page params, not buried inside `PageParams` itself:

```ts
export const listUsersInput = pageParams.extend({
  search: z.string().optional(),
  role: z.string().optional(),
});
export type ListUsersInput = z.infer<typeof listUsersInput>;
```

The repo applies filters in the `where` clause; the `count(*) over ()` then reflects the **filtered** total.

## Anti-patterns to refuse

- `list(): Promise<T[]>` with no paging params — even "it's only ~50 rows today" doesn't survive a year.
- Letting the client send `pageSize=10000` — always cap at `MAX_PAGE_SIZE` (the Zod `.max()` enforces this).
- `ORDER BY created_at` without an `id` tiebreaker (silent page swaps on duplicate timestamps).
- Building the response envelope in the route handler — keep it in the service so transport stays dumb.
- Two separate round trips for the page and the count when one `count(*) over ()` query returns both.

## Checklist when adding a list endpoint

1. Repo method takes `PageParams`, returns `{ items, total }`, orders by `(sortKey, id) DESC`.
2. Service builds the `Page<T>` envelope from the repo result.
3. Handler validates `?page=&pageSize=` with the shared `pageParams` Zod schema — never trusts raw values.
4. Response shape is `Page<T>` — `{ items, total, page, pageSize }`.
5. Test: empty result → `total === 0`, `items === []`; past last page → empty items but correct total.
