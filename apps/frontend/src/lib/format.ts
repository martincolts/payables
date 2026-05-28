const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

/** Formats a NUMERIC string (e.g. "1250.00") as currency. */
export function formatMoney(amount: string): string {
  return moneyFmt.format(Number(amount));
}

/** Formats an ISO date ("YYYY-MM-DD") for display. */
export function formatDate(iso: string): string {
  // Parse as local date to avoid timezone shifting a date-only value.
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(y!, m! - 1, d!));
}

/** Formats a full ISO timestamp (e.g. "2026-05-27T12:00:00Z") as a date. */
export function formatTimestamp(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** A bill is overdue when its due date has passed and it isn't paid yet. */
export function isOverdue(dueDate: string, status: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today && status !== "paid";
}
