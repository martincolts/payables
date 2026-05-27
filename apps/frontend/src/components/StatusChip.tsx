import { Chip, type ChipProps } from "@mui/material";
import type { BillStatus } from "@payables/shared";

/** Spanish label + MUI color for each bill lifecycle state. */
const STATUS_META: Record<BillStatus, { label: string; color: ChipProps["color"] }> = {
  draft: { label: "Borrador", color: "default" },
  pending_approval: { label: "Pendiente de aprobación", color: "warning" },
  approved: { label: "Aprobada", color: "info" },
  rejected: { label: "Rechazada", color: "error" },
  scheduled: { label: "Programada", color: "primary" },
  paid: { label: "Pagada", color: "success" },
};

export function StatusChip({ status }: { status: BillStatus }) {
  const { label, color } = STATUS_META[status];
  return <Chip label={label} color={color} size="small" variant="outlined" />;
}
