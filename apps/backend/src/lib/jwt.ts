import { SignJWT } from "jose";
import type { AuthUser } from "@payables/shared";

const TOKEN_TTL = "7d";

/**
 * Mints the bearer token the frontend stores and replays on every request.
 * The claims here are exactly what {@link authMiddleware} reads back out.
 */
export function signAuthToken(user: AuthUser, jwtSecret: string): Promise<string> {
  const key = new TextEncoder().encode(jwtSecret);
  return new SignJWT({
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(key);
}
