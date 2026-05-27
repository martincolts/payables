import { defineConfig } from "drizzle-kit";

// Load the shared root .env (drizzle-kit has no --env-file flag of its own).
// cwd is apps/backend when nx runs the migrate/generate targets.
try {
  process.loadEnvFile("../../.env");
} catch {
  // .env is optional; fall back to whatever is already in the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
