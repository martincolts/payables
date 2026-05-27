import { z } from "zod";

/** Application roles. `admin` can do everything; `approver` reviews bills. */
export const userRoles = ["admin", "approver"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

/** The authenticated user shape returned to the client (never includes the hash). */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1).max(120),
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
