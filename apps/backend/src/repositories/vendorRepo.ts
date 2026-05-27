import { eq, sql } from "drizzle-orm";
import type { CreateVendorInput, PaginationQuery, Vendor } from "@payables/shared";
import type { DB } from "../db/client.js";
import { vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";

/** Consumer-side interface: the slice of vendor persistence services depend on. */
export type VendorRepo = {
  create(input: CreateVendorInput): Promise<Vendor>;
  getById(id: string): Promise<Vendor>;
  list(params: PaginationQuery): Promise<{ items: Vendor[]; total: number }>;
};

function toVendor(row: typeof vendors.$inferSelect): Vendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    paymentMethod: row.paymentMethod,
    bankLast4: row.bankLast4,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createVendorRepo(db: DB): VendorRepo {
  return {
    async create(input) {
      const [row] = await db
        .insert(vendors)
        .values({
          name: input.name,
          email: input.email,
          paymentMethod: input.paymentMethod,
          bankLast4: input.bankLast4 ?? null,
        })
        .returning();
      return toVendor(row!);
    },

    async getById(id) {
      const [row] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
      if (!row) throw new NotFoundError("Vendor", id);
      return toVendor(row);
    },

    async list({ page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db.select().from(vendors).orderBy(vendors.name).limit(pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(vendors),
      ]);
      return { items: rows.map(toVendor), total: count };
    },
  };
}
