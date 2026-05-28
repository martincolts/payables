import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLogEntry,
  ListActivityLogQuery,
} from "@payables/shared";
import type { DbExecutor } from "../db/client.js";
import { activityLog, users } from "../db/schema/index.js";

/** Internal — the shape services use to record an activity. */
export type NewActivityLog = {
  organizationId: string;
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  /** Free-form context (vendor name, bill amount, decision comment, …). */
  metadata?: Record<string, unknown> | null;
};

export type ListActivityLogParams = ListActivityLogQuery & {
  organizationId: string;
};

/** Consumer-side interface: the slice of activity-log persistence services depend on. */
export type ActivityLogRepo = {
  /**
   * Appends a single log entry. Designed to be called from inside the same
   * transaction as the underlying action it describes — pass the `tx` from
   * `db.transaction` to the repo factory.
   */
  log(input: NewActivityLog): Promise<void>;
  /** Lists entries newest-first, with optional user/action filters. */
  list(
    params: ListActivityLogParams,
  ): Promise<{ items: ActivityLogEntry[]; total: number }>;
};

type Row = typeof activityLog.$inferSelect;

function toEntry(row: Row, userName: string): ActivityLogEntry {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    userId: row.userId,
    userName,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createActivityLogRepo(db: DbExecutor): ActivityLogRepo {
  return {
    async log(input) {
      await db.insert(activityLog).values({
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? null,
      });
    },

    async list({ organizationId, page, pageSize, userId, action, from, to }) {
      const offset = (page - 1) * pageSize;

      const conditions: SQL[] = [eq(activityLog.organizationId, organizationId)];
      if (userId) conditions.push(eq(activityLog.userId, userId));
      if (action) conditions.push(eq(activityLog.action, action));
      if (from) conditions.push(gte(activityLog.createdAt, new Date(`${from}T00:00:00Z`)));
      if (to) {
        // `to` is inclusive — extend to the start of the next UTC day.
        const end = new Date(`${to}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        conditions.push(lt(activityLog.createdAt, end));
      }
      const where = and(...conditions);

      const [rows, [{ count } = { count: 0 }]] = await Promise.all([
        db
          .select({ entry: activityLog, userName: users.name })
          .from(activityLog)
          .innerJoin(users, eq(activityLog.userId, users.id))
          .where(where)
          .orderBy(desc(activityLog.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(activityLog)
          .where(where),
      ]);

      return {
        items: rows.map((r) => toEntry(r.entry, r.userName)),
        total: count,
      };
    },
  };
}
