import { randomBytes } from "node:crypto";
import type {
  AcceptInvitationInput,
  AuthResponse,
  CreateInvitationInput,
  Invitation,
  InvitationPreview,
  Paginated,
  PaginationQuery,
} from "@payables/shared";
import type { InvitationRepo } from "../repositories/invitationRepo.js";
import type { UserRepo } from "../repositories/userRepo.js";
import { hashPassword } from "../lib/password.js";
import { signAuthToken } from "../lib/jwt.js";
import { ConflictError, NotFoundError } from "../types/errors.js";

export type InvitationService = ReturnType<typeof createInvitationService>;

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createInvitationService(
  repo: InvitationRepo,
  userRepo: UserRepo,
  jwtSecret: string,
) {
  return {
    /**
     * Invites a new member: creates a pending (password-less) user and an
     * invitation carrying the token they'll use to accept. The token is
     * returned so the admin can surface it in the UI — a real app would email
     * it as a link instead (see README).
     */
    async invite(
      input: CreateInvitationInput,
      organizationId: string,
      invitedBy: string,
    ): Promise<Invitation> {
      const pending = await userRepo.createPending({
        organizationId,
        name: input.name,
        email: input.email,
        role: input.role,
      });
      return repo.create({
        organizationId,
        userId: pending.id,
        email: input.email,
        role: input.role,
        token: generateToken(),
        invitedBy,
      });
    },

    async list(
      organizationId: string,
      params: PaginationQuery,
    ): Promise<Paginated<Invitation>> {
      const { items, total } = await repo.list(organizationId, params);
      return {
        items,
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      };
    },

    /** Public: what the invitee sees on the accept screen. */
    async preview(token: string): Promise<InvitationPreview> {
      const found = await repo.getByToken(token);
      if (!found) throw new NotFoundError("Invitation");
      return {
        email: found.email,
        name: found.userName,
        role: found.role,
        organizationName: found.organizationName,
        status: found.status,
      };
    },

    /**
     * Public: the invitee sets their password, which activates their account
     * and consumes the invitation. Returns a fresh session so the frontend can
     * log them straight in.
     */
    async accept(input: AcceptInvitationInput): Promise<AuthResponse> {
      const found = await repo.getByToken(input.token);
      if (!found) throw new NotFoundError("Invitation");
      if (found.status === "accepted") {
        throw new ConflictError("This invitation has already been accepted");
      }
      const passwordHash = await hashPassword(input.password);
      const user = await userRepo.activate(found.userId, passwordHash);
      await repo.markAccepted(found.id);
      return { token: await signAuthToken(user, jwtSecret), user };
    },
  };
}
