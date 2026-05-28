import { z } from "zod";
import { approvalStatusSchema } from "./enums.js";

/** A single approver's decision on a bill. */
export const approvalSchema = z.object({
  id: z.uuid(),
  billId: z.uuid(),
  approverId: z.uuid(),
  approverName: z.string(),
  status: approvalStatusSchema,
  comment: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;

/**
 * The approval picture for a bill: every decision plus the quorum progress
 * (`approved` of `required`). The frontend renders "N of M approvals".
 */
export const approvalSummarySchema = z.object({
  billId: z.uuid(),
  required: z.number().int().min(1),
  approved: z.number().int().min(0),
  decisions: z.array(approvalSchema),
});
export type ApprovalSummary = z.infer<typeof approvalSummarySchema>;

/** An approver's decision submission. A comment is required when rejecting. */
export const submitApprovalSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    comment: z.string().max(1000).nullish(),
  })
  .refine((v) => v.decision !== "reject" || (v.comment && v.comment.trim().length > 0), {
    message: "A comment is required when rejecting",
    path: ["comment"],
  });
export type SubmitApprovalInput = z.infer<typeof submitApprovalSchema>;
