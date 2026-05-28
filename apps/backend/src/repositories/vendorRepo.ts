import { and, eq, sql } from "drizzle-orm";
import type { CreateVendorInput, PaginationQuery, Vendor } from "@payables/shared";
import type { DB } from "../db/client.js";
import { vendors } from "../db/schema/index.js";
import { NotFoundError } from "../types/errors.js";

/** Consumer-side interface: the slice of vendor persistence services depend on. */
export type VendorRepo = {
  create(input: CreateVendorInput, organizationId: string): Promise<Vendor>;
  getById(id: string, organizationId: string): Promise<Vendor>;
  /** Soft-delete: flips `isActive` to false. Throws if the vendor is unknown. */
  deactivate(id: string, organizationId: string): Promise<Vendor>;
  /** Lists active vendors only (deactivated ones are hidden). */
  list(
    organizationId: string,
    params: PaginationQuery,
  ): Promise<{ items: Vendor[]; total: number }>;
};

function toVendor(row: typeof vendors.$inferSelect): Vendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    paymentMethod: row.paymentMethod,
    bankLast4: row.bankLast4,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createVendorRepo(db: DB): VendorRepo {
  return {
    async create(input, organizationId) {
      const [row] = await db
        .insert(vendors)
        .values({
          organizationId,
          name: input.name,
          email: input.email,
          paymentMethod: input.paymentMethod,
          bankLast4: input.bankLast4 ?? null,
        })
        .returning();
      return toVendor(row!);
    },

    async getById(id, organizationId) {
      const [row] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, id), eq(vendors.organizationId, organizationId)))
        .limit(1);
      if (!row) throw new NotFoundError("Vendor", id);
      return toVendor(row);
    },

    async deactivate(id, organizationId) {
      const [row] = await db
        .update(vendors)
        .set({ isActive: false })
        .where(and(eq(vendors.id, id), eq(vendors.organizationId, organizationId)))
        .returning();
      if (!row) throw new NotFoundError("Vendor", id);
      return toVendor(row);
    },

    async list(organizationId, { page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const where = and(
        eq(vendors.organizationId, organizationId),
        eq(vendors.isActive, true),
      );
      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db
          .select()
          .from(vendors)
          .where(where)
          .orderBy(vendors.name)
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(vendors).where(where),
      ]);
      return { items: rows.map(toVendor), total: count };
    },
  };
}
