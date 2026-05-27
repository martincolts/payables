import { Chip, type ChipProps } from "@mui/material";
import type { BillStatus } from "@payables/shared";

/** Label + MUI color for each bill lifecycle state. */
const STATUS_META: Record<BillStatus, { label: string; color: ChipProps["color"] }> = {
  draft: { label: "Draft", color: "default" },
  pending_approval: { label: "Pending approval", color: "warning" },
  approved: { label: "Approved", color: "info" },
  rejected: { label: "Rejected", color: "error" },
  scheduled: { label: "Scheduled", color: "primary" },
  paid: { label: "Paid", color: "success" },
};

export function StatusChip({ status }: { status: BillStatus }) {
  const { label, color } = STATUS_META[status];
  return <Chip label={label} color={color} size="small" variant="outlined" />;
}
