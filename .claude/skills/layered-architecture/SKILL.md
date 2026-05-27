---
name: layered-architecture
description: How to add a feature across routes → services → repositories in the prode backend (Node + Hono + Drizzle). Apply when creating a new endpoint, entity, or business operation.
---

# Layered Architecture

Strict one-way dependency: **routes → services → repositories**. A shared `types` module (DTOs + domain types + sentinel errors) depends on nothing internal.

In the Nx monorepo this lives in `apps/backend/src/` with the layers as folders; cross-cutting domain types that the frontend also needs go in the `libs/shared-types` library (see the README structure). Follow [[typescript-best-practices]] throughout and [[drizzle-orm]] in the repo layer.

## Layer responsibilities

### `types` (shared, no internal imports)

Domain types, request/response DTOs (validated with Zod), and sentinel error classes. No logic, no Drizzle, no Hono.

```ts
// types/user.ts
import { z } from 'zod';

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export const createUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof createUserInput>;
```

```ts
// types/errors.ts
export class NotFoundError extends Error {}
export class ConflictError extends Error {}
export class ValidationError extends Error {}
```

### `repositories`

Owns all DB access via Drizzle. One file per entity (`userRepo.ts`, `billRepo.ts`). Takes the `db` executor (pool or transaction) so services can compose calls in a transaction. Maps Postgres errors → sentinel errors at this boundary.

```ts
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { NotFoundError } from '../types/errors';
import type { DB } from '../db/client';
import type { User, CreateUserInput } from '../types/user';

export function createUserRepo(db: DB) {
  return {
    async getById(id: string): Promise<User> {
      const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!u) throw new NotFoundError(`user ${id}`);
      return u;
    },

    async create(input: CreateUserInput): Promise<User> {
      const [u] = await db.insert(users).values(input).returning();
      return u;
    },
  };
}

export type UserRepo = ReturnType<typeof createUserRepo>;
```

### `services`

Business logic. Declares the **repo interface it needs** (consumer-side type), so it can be tested with a fake. Never imports `hono` or `drizzle-orm`.

```ts
import { ValidationError } from '../types/errors';
import type { User, CreateUserInput } from '../types/user';

type UserRepo = {
  getById(id: string): Promise<User>;
  create(input: CreateUserInput): Promise<User>;
};

export function createUserService(repo: UserRepo) {
  return {
    async register(input: CreateUserInput): Promise<User> {
      if (!input.email) throw new ValidationError('email required');
      return repo.create(input);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
```

### `routes`

HTTP only (Hono). Validate request → call service → return JSON. Error → status mapping lives in **one** place: a Hono `onError` handler.

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createUserInput } from '../types/user';
import type { UserService } from '../services/userService';

export function userRoutes(svc: UserService) {
  return new Hono()
    .post('/', zValidator('json', createUserInput), async (c) => {
      const user = await svc.register(c.req.valid('json'));
      return c.json(user, 201);
    })
    .get('/:id', async (c) => {
      const user = await svc.getById(c.req.param('id'));
      return c.json(user);
    });
}
```

A single `app.onError` maps `NotFoundError → 404`, `ValidationError → 400`, `ConflictError → 409`, default → 500 — so handlers just throw and stay dumb.

```ts
app.onError((err, c) => {
  if (err instanceof NotFoundError) return c.json({ message: err.message }, 404);
  if (err instanceof ValidationError) return c.json({ message: err.message }, 400);
  if (err instanceof ConflictError) return c.json({ message: err.message }, 409);
  console.error(err);
  return c.json({ message: 'internal error' }, 500);
});
```

## Wiring (`src/index.ts`)

```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createDb } from './db/client';
import { createUserRepo } from './repositories/userRepo';
import { createUserService } from './services/userService';
import { userRoutes } from './routes/userRoutes';
import { loadConfig } from './config';

const cfg = loadConfig();
const { db } = createDb(cfg.databaseUrl);

const userRepo = createUserRepo(db);
const userSvc = createUserService(userRepo);

const app = new Hono();
app.route('/api/v1/users', userRoutes(userSvc));
app.onError(/* ...mapping above... */);

serve({ fetch: app.fetch, port: cfg.port });
```

## Checklist for adding a feature

1. **Type** — add the domain type + Zod DTO to `types/`.
2. **Schema + migration** — add/extend the Drizzle table, then `pnpm drizzle-kit generate` (see [[drizzle-orm]]).
3. **Repo** — method on an existing repo factory or a new `xxxRepo.ts`. Drizzle query, map errors.
4. **Service** — declare the consumer-side repo type you need, write the business logic, throw `types/errors` sentinels.
5. **Route** — Hono handler with `zValidator`, calls the service, returns JSON. Mount with `app.route(...)` in `src/index.ts`.
6. **Test** — repo test against a real Postgres, service test with a hand-written fake repo (Vitest).

## Anti-patterns to refuse

- Calling a repo directly from a route (skipping the service).
- Importing `drizzle-orm` or `hono` in `services/`.
- Returning a Drizzle query builder or a Hono `Context` from a service.
- Defining repo interfaces inside `repositories/` — define them where they're consumed (the service).
- A "models" file mixing DB schema, validation, and serialization — keep Drizzle schema in `db/schema`, DTOs/validation in `types/`.
