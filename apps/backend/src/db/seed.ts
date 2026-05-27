import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { bills, users, vendors } from "./schema/index.js";
import { hashPassword } from "../lib/password.js";

/**
 * Seeds demo data: vendors, a demo admin user, and a spread of bills across
 * statuses (including one overdue) so the Bills table and Dashboard metrics
 * are populated. Run with: pnpm nx run backend:seed
 */
async function seed() {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);

  await db
    .insert(vendors)
    .values([
      { name: "Amazon Web Services", email: "ar@aws.com", paymentMethod: "ach", bankLast4: "1234" },
      { name: "Stripe", email: "billing@stripe.com", paymentMethod: "wire", bankLast4: "5678" },
      { name: "Figma", email: "ap@figma.com", paymentMethod: "ach", bankLast4: null },
      { name: "WeWork", email: "billing@wework.com", paymentMethod: "check", bankLast4: null },
      { name: "Notion", email: "ap@notion.so", paymentMethod: "ach", bankLast4: "4321" },
    ])
    .onConflictDoNothing();

  // Demo user — log in with admin@payables.com / password123.
  await db
    .insert(users)
    .values({
      name: "Admin Demo",
      email: "admin@payables.com",
      passwordHash: await hashPassword("password123"),
      role: "admin",
    })
    .onConflictDoNothing();

  const [admin] = await db.select().from(users).limit(1);
  const vendorRows = await db.select().from(vendors);
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
        vendorId: vendorByName.get("Amazon Web Services")!,
        invoiceNumber: "AWS-2024-001",
        amount: "1250.00",
        issueDate: daysFromNow(-40),
        dueDate: daysFromNow(-5), // overdue
        status: "pending_approval",
        createdBy: admin.id,
      },
      {
        vendorId: vendorByName.get("Stripe")!,
        invoiceNumber: "STR-9981",
        amount: "499.99",
        issueDate: daysFromNow(-10),
        dueDate: daysFromNow(4),
        status: "approved",
        createdBy: admin.id,
      },
      {
        vendorId: vendorByName.get("Figma")!,
        invoiceNumber: "FIG-2024-07",
        amount: "144.00",
        issueDate: daysFromNow(-3),
        dueDate: daysFromNow(20),
        status: "draft",
        createdBy: admin.id,
      },
      {
        vendorId: vendorByName.get("WeWork")!,
        invoiceNumber: "WW-Q3",
        amount: "8200.00",
        issueDate: daysFromNow(-15),
        dueDate: daysFromNow(10),
        status: "scheduled",
        createdBy: admin.id,
      },
      {
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
