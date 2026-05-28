import { eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { bills, organizations, users, vendors } from "./schema/index.js";
import { hashPassword } from "../lib/password.js";

/**
 * Seeds demo data: an organization, a demo admin + approver, vendors, and a
 * spread of bills across statuses (including one overdue) so the Bills table
 * and Dashboard metrics are populated. The org requires 2 approvals so the
 * quorum flow is exercisable. Run with: pnpm nx run backend:seed
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
    // Demo admin — log in with admin@payables.com / password123.
    // Demo approver — log in with approver@payables.com / password123.
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
        name: "Approver Demo",
        email: "approver@payables.com",
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

  const [admin] = await db.select().from(users).where(eq(users.organizationId, orgId)).limit(1);
  const vendorRows = await db.select().from(vendors).where(eq(vendors.organizationId, orgId));
  if (!admin || vendorRows.length === 0) {
    console.warn("Skipping bill seed: missing user or vendors.");
    await pool.end();
    return;
  }

  const vendorByName = new Map(vendorRows.map((v) => [v.name, v.id]));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86_400_000));

  await db
    .insert(bills)
    .values([
      {
        organizationId: orgId,
        vendorId: vendorByName.get("Amazon Web Services")!,
        invoiceNumber: "AWS-2024-001",
        amount: "1250.00",
        issueDate: daysFromNow(-40),
        dueDate: daysFromNow(-5), // overdue
        status: "pending_approval",
        createdBy: admin.id,
      },
      {
        organizationId: orgId,
        vendorId: vendorByName.get("Stripe")!,
        invoiceNumber: "STR-9981",
        amount: "499.99",
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(4),
        status: "approved",
        createdBy: admin.id,
      },
      {
        organizationId: orgId,
        vendorId: vendorByName.get("Figma")!,
        invoiceNumber: "FIG-2024-07",
        amount: "144.00",
        issueDate: daysFromNow(-3),
        dueDate: daysFromNow(20),
        status: "draft",
        createdBy: admin.id,
      },
      {
        organizationId: orgId,
        vendorId: vendorByName.get("WeWork")!,
        invoiceNumber: "WW-Q3",
        amount: "8200.00",
        issueDate: daysFromNow(-15),
        dueDate: daysFromNow(10),
        status: "scheduled",
        createdBy: admin.id,
      },
      {
        organizationId: orgId,
        vendorId: vendorByName.get("Notion")!,
        invoiceNumber: "NOT-555",
        amount: "96.00",
        issueDate: daysFromNow(-60),
        dueDate: daysFromNow(-30),
        status: "paid",
        createdBy: admin.id,
      },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
