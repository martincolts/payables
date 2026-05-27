import type { BillStatus } from "@payables/shared";
import { InvalidTransitionError } from "../types/errors.js";

/**
 * Allowed bill status transitions. The backend is the source of truth;
 * the frontend only surfaces actions that map to a legal edge here.
 *
 *   draft → pending_approval → approved → scheduled → paid
 *                          ↘ rejected → draft
 */
const TRANSITIONS: Record<BillStatus, readonly BillStatus[]> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  approved: ["scheduled"],
  rejected: ["draft"],
  scheduled: ["paid"],
  paid: [],
};

export function canTransition(from: BillStatus, to: BillStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throws InvalidTransitionError (→ HTTP 422) when the edge is illegal. */
export function assertTransition(from: BillStatus, to: BillStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
