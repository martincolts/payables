import { z } from "zod";
import { userRoleSchema } from "./auth.js";
import { invitationStatusSchema } from "./enums.js";

/** An invitation an admin extends to bring a new member into the org. */
export const invitationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  email: z.email(),
  role: userRoleSchema,
  status: invitationStatusSchema,
  token: z.string(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
});
export type Invitation = z.infer<typeof invitationSchema>;

/** Admin request body to invite a new member. */
export const createInvitationSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  role: userRoleSchema.default("approver"),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/**
 * Public preview of an invitation, shown on the accept screen so the invitee
 * knows which org and email the invite is for. Never exposes the token holder's
 * org internals beyond the name.
 */
export const invitationPreviewSchema = z.object({
  email: z.email(),
  name: z.string(),
  role: userRoleSchema,
  organizationName: z.string(),
  status: invitationStatusSchema,
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

/** Body the invitee submits to accept and activate their account. */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
