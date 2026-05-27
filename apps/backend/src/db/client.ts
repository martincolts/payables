import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export type DB = ReturnType<typeof createDb>["db"];

export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
