import { and, eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { bills, organizations, users, vendors } from "./schema/index.js";
import { hashPassword } from "../lib/password.js";

/**
 * Seeds demo data: an organization, a demo admin + a few approvers, vendors, and
 * a spread of bills across all statuses spanning the last 24 months (including
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
  const vendorByName = new Map(vendorRows.map((v) => [v.name, v.id] as const));

  // Deterministic PRNG so reseeds produce identical data.
  const mulberry32 = (seed: number) => {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rand = mulberry32(42);
  const jitter = (base: number, pct: number) => base * (1 + (rand() * 2 - 1) * pct);

  type Status = "draft" | "pending_approval" | "approved" | "rejected" | "scheduled" | "paid";

  // Status by month-age. Recent months are still live; older months have settled.
  // `monthsAgo === 0` is the current month — bills here are mid-lifecycle.
  const pickStatus = (monthsAgo: number, dayOfMonth: number): Status => {
    if (monthsAgo === 0) {
      // Live month: spread across early lifecycle, skewed by how far into the month.
      const r = rand();
      if (dayOfMonth <= 5) return r < 0.5 ? "draft" : "pending_approval";
      if (dayOfMonth <= 15) return r < 0.4 ? "pending_approval" : r < 0.8 ? "approved" : "scheduled";
      return r < 0.4 ? "approved" : r < 0.85 ? "scheduled" : "paid";
    }
    if (monthsAgo === 1) {
      const r = rand();
      return r < 0.7 ? "paid" : r < 0.85 ? "scheduled" : r < 0.95 ? "approved" : "rejected";
    }
    // Older months: nearly all paid, an occasional rejected.
    return rand() < 0.04 ? "rejected" : "paid";
  };

  // Per-vendor recurring-bill profile. Each profile encodes realistic patterns:
  //   - amountFor(monthsAgo): price curve (flat with bumps, or usage-driven jitter)
  //   - skip(monthsAgo): months where no invoice was issued (vendor not used / on hold)
  //   - dayOfMonth: when the invoice typically lands
  type Profile = {
    vendorName: string;
    dayOfMonth: number;
    netDays: number;
    amountFor: (monthsAgo: number) => number;
    skip: (monthsAgo: number) => boolean;
  };

  const profiles: Profile[] = [
    {
      // AWS: usage-based, trending up as the product grows, with monthly noise.
      vendorName: "Amazon Web Services",
      dayOfMonth: 3,
      netDays: 15,
      amountFor: (m) => {
        const baseline = 1800 - m * 35; // older months were cheaper
        return Math.max(600, jitter(baseline, 0.18));
      },
      skip: () => false,
    },
    {
      // Stripe: processing fees, scales with revenue. Mild upward trend, noisy.
      vendorName: "Stripe",
      dayOfMonth: 5,
      netDays: 7,
      amountFor: (m) => Math.max(150, jitter(520 - m * 9, 0.22)),
      skip: () => false,
    },
    {
      // Figma: seat-based SaaS. Two price tiers over 24 months (seat expansion).
      vendorName: "Figma",
      dayOfMonth: 10,
      netDays: 30,
      amountFor: (m) => {
        if (m >= 14) return 180; // 14+ months ago: smaller team
        if (m >= 5) return 225;  // mid-period: tier bump
        return 270;              // recent: another seat bump
      },
      // Briefly cancelled for 2 months mid-period before re-subscribing.
      skip: (m) => m === 12 || m === 13,
    },
    {
      // WeWork: office rent. Flat for long stretches, two annual rent hikes.
      // Skipped while moving offices.
      vendorName: "WeWork",
      dayOfMonth: 1,
      netDays: 30,
      amountFor: (m) => {
        if (m >= 16) return 3200;
        if (m >= 4) return 3500;
        return 3850;
      },
      skip: (m) => m === 15, // 1-month gap during office move
    },
    {
      // Notion: started using it 18 months ago, occasional flat months with bumps.
      vendorName: "Notion",
      dayOfMonth: 18,
      netDays: 30,
      amountFor: (m) => {
        if (m >= 18) return 0; // not a customer yet
        if (m >= 9) return 80;
        if (m >= 3) return 96;
        return 120;
      },
      skip: (m) => m >= 18,
    },
  ];

  // Generate per-vendor monthly bills across the last 24 months.
  const today = new Date();
  const billValues: (typeof bills.$inferInsert)[] = [];
  let invoiceCounter = 1;

  for (let monthsAgo = 23; monthsAgo >= 0; monthsAgo--) {
    const issueBase = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    const year = issueBase.getFullYear();

    for (const profile of profiles) {
      if (profile.skip(monthsAgo)) continue;
      const vendorId = vendorByName.get(profile.vendorName);
      if (!vendorId) continue;

      const issueDate = new Date(year, issueBase.getMonth(), profile.dayOfMonth);
      // Skip future-dated invoices for the current month.
      if (issueDate > today) continue;

      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + profile.netDays);

      const amount = profile.amountFor(monthsAgo).toFixed(2);
      const status = pickStatus(monthsAgo, issueDate.getDate());

      billValues.push({
        organizationId: orgId,
        vendorId,
        invoiceNumber: `INV-${year}-${String(invoiceCounter).padStart(5, "0")}`,
        amount,
        issueDate: iso(issueDate),
        dueDate: iso(dueDate),
        status,
        createdBy: admin.id,
      });
      invoiceCounter++;
    }

    // A few ad-hoc one-off bills sprinkled in (consultants, hardware, travel),
    // not every month — keeps the data lumpy and realistic.
    if (rand() < 0.45) {
      const vendorId = vendorRows[Math.floor(rand() * vendorRows.length)]!.id;
      const day = 6 + Math.floor(rand() * 20);
      const issueDate = new Date(year, issueBase.getMonth(), day);
      if (issueDate <= today) {
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 30);
        const amount = (300 + rand() * 4200).toFixed(2);
        billValues.push({
          organizationId: orgId,
          vendorId,
          invoiceNumber: `INV-${year}-${String(invoiceCounter).padStart(5, "0")}`,
          amount,
          issueDate: iso(issueDate),
          dueDate: iso(dueDate),
          status: pickStatus(monthsAgo, day),
          createdBy: admin.id,
          memo: "One-off expense",
        });
        invoiceCounter++;
      }
    }
  }

  await db.insert(bills).values(billValues);

  console.log(`Seed complete: inserted ${billValues.length} bills across 24 months.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
