import type { ApAgingReport } from "@payables/shared";

const HEADER = ["Vendor", "Current", "1-30", "31-60", "61-90", "90+", "Total"];

function escape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function renderApAgingCsv(report: ApAgingReport): string {
  const lines: string[] = [HEADER.join(",")];
  for (const row of report.rows) {
    lines.push(
      [
        escape(row.vendorName),
        row.buckets.current,
        row.buckets.d1_30,
        row.buckets.d31_60,
        row.buckets.d61_90,
        row.buckets.d90_plus,
        row.total,
      ].join(","),
    );
  }
  lines.push(
    [
      "Total",
      report.totals.buckets.current,
      report.totals.buckets.d1_30,
      report.totals.buckets.d31_60,
      report.totals.buckets.d61_90,
      report.totals.buckets.d90_plus,
      report.totals.total,
    ].join(","),
  );
  return lines.join("\n") + "\n";
}
