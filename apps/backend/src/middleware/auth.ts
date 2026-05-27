import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export type AuthEnv = { Variables: { user: AuthUser } };

/**
 * Verifies a Bearer JWT and stashes the decoded user on the context.
 * Uses an HS256 shared secret for the MVP; swap to RS256/JWKS if the
 * system grows to multiple services.
 */
export function authMiddleware(jwtSecret: string) {
  const key = new TextEncoder().encode(jwtSecret);
  return createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new HTTPException(401, { message: "Missing bearer token" });

    try {
      const { payload } = await jwtVerify(token, key);
      c.set("user", {
        id: String(payload.sub),
        email: String(payload.email ?? ""),
        role: String(payload.role ?? "admin"),
      });
    } catch {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }
    await next();
  });
}

/**
 * Gate that allows only `admin` users through. Must run after
 * {@link authMiddleware}, which populates the user on the context.
 */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") {
    throw new HTTPException(403, { message: "Admin role required" });
  }
  await next();
});
