import { defineConfig } from "vitest/config";

// Load the shared root .env so DATABASE_URL is available to the test-DB helper
// (vitest has no --env-file flag; mirrors drizzle.config.ts). cwd is apps/backend.
try {
  process.loadEnvFile("../../.env");
} catch {
  // .env is optional; fall back to whatever is already in the environment.
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Each file creates and drops its own database; run files serially to avoid
    // overwhelming the Postgres server with concurrent CREATE/DROP DATABASE.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
