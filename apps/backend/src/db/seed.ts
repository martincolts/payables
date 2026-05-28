import { and, eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { bills, organizations, users, vendors } from "./schema/index.js";
import { hashPassword } from "../lib/password.js";

/**
 * Seeds demo data: an organization, a demo admin + a few approvers, vendors, and
 * a spread of bills across all statuses spanning the last 8 months (including
 * overdue ones) so the Bills table and Dashboard metrics are well populated. The
 * org requires 2 approvals so the quorum flow is exercisable.
 * Run with: pnpm nx run backend:seed
 */
async function seed() {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);

  // Reuse the demo org if it already exists (idempotent reseed).
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@payables.com"))
    .limit(1);

  let orgId = existing[0]?.organizationId;
  if (!orgId) {
    const [org] = await db
      .insert(organizations)
      .values({ name: "Payables Demo Co", requiredApprovals: 2 })
      .returning();
    orgId = org!.id;

    const passwordHash = await hashPassword("password123");
    // Demo logins (all use password123):
    //   admin@payables.com       (admin)
    //   approver@payables.com    (approver)
    //   approver2@payables.com   (approver)
    //   approver3@payables.com   (approver)
    await db.insert(users).values([
      {
        organizationId: orgId,
        name: "Admin Demo",
        email: "admin@payables.com",
        passwordHash,
        role: "admin",
        status: "active",
      },
      {
        organizationId: orgId,
        name: "Alice Approver",
        email: "approver@payables.com",
        passwordHash,
        role: "approver",
        status: "active",
      },
      {
        organizationId: orgId,
        name: "Bob Approver",
        email: "approver2@payables.com",
        passwordHash,
        role: "approver",
        status: "active",
      },
      {
        organizationId: orgId,
        name: "Carol Approver",
        email: "approver3@payables.com",
        passwordHash,
        role: "approver",
        status: "active",
      },
    ]);
  }

  await db
    .insert(vendors)
    .values([
      { organizationId: orgId, name: "Amazon Web Services", email: "ar@aws.com", paymentMethod: "ach", bankLast4: "1234" },
      { organizationId: orgId, name: "Stripe", email: "billing@stripe.com", paymentMethod: "wire", bankLast4: "5678" },
      { organizationId: orgId, name: "Figma", email: "ap@figma.com", paymentMethod: "ach", bankLast4: null },
      { organizationId: orgId, name: "WeWork", email: "billing@wework.com", paymentMethod: "check", bankLast4: null },
      { organizationId: orgId, name: "Notion", email: "ap@notion.so", paymentMethod: "ach", bankLast4: "4321" },
    ])
    .onConflictDoNothing();

  const [admin] = await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, orgId), eq(users.role, "admin")))
    .limit(1);
  const vendorRows = await db.select().from(vendors).where(eq(vendors.organizationId, orgId));
  if (!admin || vendorRows.length === 0) {
    console.warn("Skipping bill seed: missing admin user or vendors.");
    await pool.end();
    return;
  }

  // Avoid piling up duplicate bills on reseed (bills have no natural unique key,
  // so onConflictDoNothing can't dedupe them).
  const existingBills = await db
    .select({ id: bills.id })
    .from(bills)
    .where(eq(bills.organizationId, orgId))
    .limit(1);
  if (existingBills.length > 0) {
    console.log("Bills already seeded for this org — skipping bill seed.");
    await pool.end();
    return;
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86_400_000));

  const vendorIds = vendorRows.map((v) => v.id);
  const statuses = ["draft", "pending_approval", "approved", "rejected", "scheduled", "paid"] as const;

  // Generate ~5 bills per month for the last 8 months so the Bills table and
  // Dashboard charts have meaningful history. Statuses skew with age: recent
  // months stay in earlier lifecycle states, older months are mostly paid.
  const billValues: (typeof bills.$inferInsert)[] = [];
  for (let monthsAgo = 0; monthsAgo < 8; monthsAgo++) {
    const billsThisMonth = 5;
    for (let i = 0; i < billsThisMonth; i++) {
      const vendorId = vendorIds[(monthsAgo * billsThisMonth + i) % vendorIds.length]!;
      // Spread issue dates across the month, then derive a 30-day due date.
      const issueOffset = -(monthsAgo * 30 + i * 5 + 2);
      const dueOffset = issueOffset + 30;

      let status: (typeof statuses)[number];
      if (monthsAgo >= 3) {
        // Older bills are settled (paid) or were rejected.
        status = i % 4 === 0 ? "rejected" : "paid";
      } else if (monthsAgo === 0) {
        // This month: a live mix across the early lifecycle.
        status = statuses[i % statuses.length]!;
      } else {
        // Recent months: mostly approved/scheduled, some paid.
        status = ["approved", "scheduled", "paid", "scheduled", "approved"][i]! as (typeof statuses)[number];
      }

      const amount = (50 + ((monthsAgo * 137 + i * 311) % 9950)).toFixed(2);
      billValues.push({
        organizationId: orgId,
        vendorId,
        invoiceNumber: `INV-${iso(new Date()).slice(0, 4)}-${monthsAgo}${i}`,
        amount,
        issueDate: daysFromNow(issueOffset),
        dueDate: daysFromNow(dueOffset),
        status,
        createdBy: admin.id,
      });
    }
  }

  await db.insert(bills).values(billValues);

  console.log(`Seed complete: inserted ${billValues.length} bills.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
