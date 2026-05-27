import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1).default("dev-only-insecure-secret"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = z.prettifyError(parsed.error);
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
