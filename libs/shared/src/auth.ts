import { z } from "zod";
import { userStatusSchema } from "./enums.js";

/** Application roles. `admin` can do everything; `approver` reviews bills. */
export const userRoles = ["admin", "approver"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

/** The authenticated user shape returned to the client (never includes the hash). */
export const authUserSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** A team member as shown to admins — the auth user plus account status. */
export const memberSchema = authUserSchema.extend({
  status: userStatusSchema,
  createdAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Signup creates a brand-new organization and its first admin (the owner) in
 * one step. There is no public path to join an existing org — that happens via
 * an invitation (see invitation.ts).
 */
export const signupSchema = z.object({
  name: z.string().min(1).max(120),
  organizationName: z.string().min(1).max(200),
  email: z.email(),
  password: z.string().min(8),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Response body for both login and signup: a bearer token + the user. */
export const authResponseSchema = z.object({
  token: z.string(),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
