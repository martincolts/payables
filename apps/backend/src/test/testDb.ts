import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../db/schema/index.js";

/** Migrations live in apps/backend/drizzle — two levels up from src/test. */
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Base connection used to derive the admin URL and the per-test DB URL. */
function baseUrl(): URL {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set to run repository tests");
  }
  return new URL(url);
}

/** Swap the database name in a connection URL, returning the new URL string. */
function withDatabase(url: URL, dbName: string): string {
  const next = new URL(url);
  next.pathname = `/${dbName}`;
  return next.toString();
}

export type TestDb = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  pool: Pool;
  /** Closes the pool and drops the throwaway database. */
  cleanup: () => Promise<void>;
};

/**
 * Spins up an isolated Postgres database for a test suite: creates a
 * randomly-named database on the configured server, runs all migrations
 * against it, and hands back a Drizzle client plus a `cleanup` that drops it.
 *
 * Intended for use in `beforeAll`/`afterAll` so each test file gets its own
 * schema and suites never contend over shared data.
 */
export async function createTestDb(): Promise<TestDb> {
  const base = baseUrl();
  const dbName = `test_${randomUUID().replace(/-/g, "")}`;

  // Create the throwaway database via an admin connection to the base DB.
  const adminPool = new Pool({ connectionString: base.toString() });
  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminPool.end();
  }

  const pool = new Pool({ connectionString: withDatabase(base, dbName) });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });

  const cleanup = async () => {
    await pool.end();
    const dropPool = new Pool({ connectionString: base.toString() });
    try {
      await dropPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      await dropPool.end();
    }
  };

  return { db, pool, cleanup };
}
