import { SignJWT } from "jose";
import type { AuthResponse, AuthUser, LoginInput, SignupInput } from "@payables/shared";
import type { UserRepo } from "../repositories/userRepo.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { UnauthorizedError } from "../types/errors.js";

export type AuthService = ReturnType<typeof createAuthService>;

const TOKEN_TTL = "7d";

export function createAuthService(repo: UserRepo, jwtSecret: string) {
  const key = new TextEncoder().encode(jwtSecret);

  async function signToken(user: AuthUser): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(TOKEN_TTL)
      .sign(key);
  }

  return {
    async signup(input: SignupInput): Promise<AuthResponse> {
      const passwordHash = await hashPassword(input.password);
      const user = await repo.create({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return { token: await signToken(user), user };
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      const found = await repo.getByEmail(input.email);
      if (!found || !(await verifyPassword(input.password, found.passwordHash))) {
        throw new UnauthorizedError();
      }
      const { passwordHash: _hash, ...user } = found;
      return { token: await signToken(user), user };
    },
  };
}
