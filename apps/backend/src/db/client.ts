import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export type DB = ReturnType<typeof createDb>["db"];

/**
 * Either the root drizzle client or a transaction handle. Repo factories accept
 * this so the same repo code runs both standalone and inside a `db.transaction`
 * — the service layer composes multiple repo writes atomically by passing `tx`
 * instead of `db`.
 */
export type DbExecutor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
