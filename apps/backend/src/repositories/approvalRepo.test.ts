import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bills, vendors } from "../db/schema/index.js";
import { ConflictError } from "../types/errors.js";
import { createApprovalRepo, type ApprovalRepo } from "./approvalRepo.js";
import { createUserRepo, type UserRepo } from "./userRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("approvalRepo", () => {
  let testDb: TestDb;
  let repo: ApprovalRepo;
  let userRepo: UserRepo;
  let orgId: string;
  let ownerId: string;
  let billId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createApprovalRepo(testDb.db);
    userRepo = createUserRepo(testDb.db);
    const { db } = testDb;

    ({ organizationId: orgId, ownerId } = await seedOrg(db));

    const [vendor] = await db
      .insert(vendors)
      .values({ organizationId: orgId, name: "V", email: "v@v.com", paymentMethod: "ach" })
      .returning();
    const [bill] = await db
      .insert(bills)
      .values({
        organizationId: orgId,
        vendorId: vendor!.id,
        amount: "100.00",
        issueDate: "2026-01-01",
        dueDate: "2026-02-01",
        status: "pending_approval",
        createdBy: ownerId,
      })
      .returning();
    billId = bill!.id;
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  async function approver(email: string): Promise<string> {
    const m = await userRepo.createPending({
      organizationId: orgId,
      name: `Approver ${email}`,
      email,
      role: "approver",
    });
    return m.id;
  }

  it("records a decision with the approver's name", async () => {
    const approverId = await approver("a1@example.com");
    const approval = await repo.create({
      billId,
      approverId,
      status: "approved",
      comment: null,
    });

    expect(approval.status).toBe("approved");
    expect(approval.approverName).toBe("Approver a1@example.com");
    expect(approval.resolvedAt).not.toBeNull();
  });

  it("rejects a second decision from the same approver", async () => {
    const approverId = await approver("a2@example.com");
    await repo.create({ billId, approverId, status: "approved", comment: null });

    await expect(
      repo.create({ billId, approverId, status: "rejected", comment: "changed mind" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("counts only approved decisions and lists all of them", async () => {
    // Fresh bill so counts are isolated from other tests.
    const { db } = testDb;
    const [vendor] = await db
      .insert(vendors)
      .values({ organizationId: orgId, name: "V2", email: "v2@v.com", paymentMethod: "ach" })
      .returning();
    const [bill] = await db
      .insert(bills)
      .values({
        organizationId: orgId,
        vendorId: vendor!.id,
        amount: "10.00",
        issueDate: "2026-01-01",
        dueDate: "2026-02-01",
        status: "pending_approval",
        createdBy: ownerId,
      })
      .returning();

    const yes = await approver("yes@example.com");
    const no = await approver("no@example.com");
    await repo.create({ billId: bill!.id, approverId: yes, status: "approved", comment: null });
    await repo.create({ billId: bill!.id, approverId: no, status: "rejected", comment: "no" });

    expect(await repo.countApproved(bill!.id)).toBe(1);
    const decisions = await repo.listByBill(bill!.id);
    expect(decisions).toHaveLength(2);
  });
});
