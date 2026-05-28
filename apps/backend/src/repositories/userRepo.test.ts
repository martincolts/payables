import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../types/errors.js";
import { createUserRepo, type UserRepo } from "./userRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("userRepo", () => {
  let testDb: TestDb;
  let repo: UserRepo;
  let orgId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createUserRepo(testDb.db);
    ({ organizationId: orgId } = await seedOrg(testDb.db));
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("createPending", () => {
    it("inserts a password-less pending member", async () => {
      const member = await repo.createPending({
        organizationId: orgId,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "approver",
      });

      expect(member.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(member.email).toBe("ada@example.com");
      expect(member.role).toBe("approver");
      expect(member.status).toBe("pending");
      expect(member.organizationId).toBe(orgId);
      expect(member).not.toHaveProperty("passwordHash");
    });

    it("throws ConflictError on a duplicate email", async () => {
      await repo.createPending({
        organizationId: orgId,
        name: "First",
        email: "dup@example.com",
        role: "approver",
      });

      await expect(
        repo.createPending({
          organizationId: orgId,
          name: "Second",
          email: "dup@example.com",
          role: "approver",
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("activate", () => {
    it("sets the password hash and flips status to active", async () => {
      const pending = await repo.createPending({
        organizationId: orgId,
        name: "Grace Hopper",
        email: "grace@example.com",
        role: "approver",
      });

      const active = await repo.activate(pending.id, "scrypt$ab$cd");
      expect(active.id).toBe(pending.id);

      const found = await repo.getByEmail("grace@example.com");
      expect(found!.status).toBe("active");
      expect(found!.passwordHash).toBe("scrypt$ab$cd");
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.activate("00000000-0000-0000-0000-000000000000", "x"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getByEmail", () => {
    it("returns the user with its (possibly null) password hash", async () => {
      const pending = await repo.createPending({
        organizationId: orgId,
        name: "Alan Turing",
        email: "alan@example.com",
        role: "approver",
      });

      const found = await repo.getByEmail("alan@example.com");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(pending.id);
      expect(found!.passwordHash).toBeNull(); // still pending
      expect(found!.status).toBe("pending");
    });

    it("returns null when no user matches", async () => {
      expect(await repo.getByEmail("missing@example.com")).toBeNull();
    });
  });

  describe("list", () => {
    it("lists only members of the given org", async () => {
      const { organizationId: org } = await seedOrg(testDb.db);
      await repo.createPending({ organizationId: org, name: "M1", email: "m1@o.com", role: "approver" });
      await repo.createPending({ organizationId: org, name: "M2", email: "m2@o.com", role: "approver" });

      const { items, total } = await repo.list(org, { page: 1, pageSize: 100 });
      // The two above plus the org owner seeded by seedOrg.
      expect(total).toBe(3);
      expect(items.every((m) => m.organizationId === org)).toBe(true);
    });
  });
});
