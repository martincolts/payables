import { z } from "zod";

/**
 * An organization is the tenant boundary: users, vendors, and bills all belong
 * to exactly one. `requiredApprovals` is the quorum — how many distinct
 * approvers must approve a bill before it can move to `approved`.
 */
export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  requiredApprovals: z.number().int().min(1),
  createdAt: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;

/** Admin-editable organization settings. */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  requiredApprovals: z.number().int().min(1).max(10).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
