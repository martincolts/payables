import type { Theme } from "@mui/material";
import type { BillStatus } from "@payables/shared";

export const STATUS_LABELS: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  paid: "Paid",
  payment_failed: "Payment failed",
};

export function statusColor(theme: Theme, status: BillStatus): string {
  switch (status) {
    case "draft":
      return theme.palette.grey[500];
    case "pending_approval":
      return theme.palette.warning.main;
    case "approved":
      return theme.palette.info.main;
    case "rejected":
      return theme.palette.error.main;
    case "scheduled":
      return theme.palette.secondary.main;
    case "paid":
      return theme.palette.success.main;
    case "payment_failed":
      return theme.palette.error.main;
  }
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function compactMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

export const CHART_PRIMARY = "#3b82f6";

export const VENDOR_PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];
