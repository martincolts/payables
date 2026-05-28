import type { AuthResponse, LoginInput, SignupInput } from "@payables/shared";
import type { UserRepo } from "../repositories/userRepo.js";
import type { OrganizationRepo } from "../repositories/organizationRepo.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAuthToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../types/errors.js";

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(
  repo: UserRepo,
  orgRepo: OrganizationRepo,
  jwtSecret: string,
) {
  const signToken = (user: Parameters<typeof signAuthToken>[0]) =>
    signAuthToken(user, jwtSecret);

  return {
    /** Creates a new organization with the signer as its first admin. */
    async signup(input: SignupInput): Promise<AuthResponse> {
      const passwordHash = await hashPassword(input.password);
      const { owner } = await orgRepo.createWithOwner(input.organizationName, {
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return { token: await signToken(owner), user: owner };
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      const found = await repo.getByEmail(input.email);
      // Pending invitees have no password hash yet — reject until they accept.
      if (
        !found ||
        found.status !== "active" ||
        !found.passwordHash ||
        !(await verifyPassword(input.password, found.passwordHash))
      ) {
        throw new UnauthorizedError();
      }
      const { passwordHash: _hash, status: _status, ...user } = found;
      return { token: await signToken(user), user };
    },
  };
}
