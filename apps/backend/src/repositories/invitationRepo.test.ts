import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "../types/errors.js";
import { createInvitationRepo, type InvitationRepo } from "./invitationRepo.js";
import { createUserRepo, type UserRepo } from "./userRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";
import { seedOrg } from "../test/repoHelpers.js";

describe("invitationRepo", () => {
  let testDb: TestDb;
  let repo: InvitationRepo;
  let userRepo: UserRepo;
  let orgId: string;
  let inviterId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createInvitationRepo(testDb.db);
    userRepo = createUserRepo(testDb.db);
    ({ organizationId: orgId, ownerId: inviterId } = await seedOrg(testDb.db, {
      name: "Inviting Org",
    }));
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  async function invite(email: string, token: string) {
    const pending = await userRepo.createPending({
      organizationId: orgId,
      name: "Invitee",
      email,
      role: "approver",
    });
    return repo.create({
      organizationId: orgId,
      userId: pending.id,
      email,
      role: "approver",
      token,
      invitedBy: inviterId,
    });
  }

  describe("create / getByToken", () => {
    it("creates an invitation and reads it back by token with joined names", async () => {
      const created = await invite("invitee@example.com", "tok-123");
      expect(created.status).toBe("pending");

      const found = await repo.getByToken("tok-123");
      expect(found).not.toBeNull();
      expect(found!.email).toBe("invitee@example.com");
      expect(found!.userName).toBe("Invitee");
      expect(found!.organizationName).toBe("Inviting Org");
    });

    it("returns null for an unknown token", async () => {
      expect(await repo.getByToken("nope")).toBeNull();
    });

    it("throws ConflictError when re-inviting the same email", async () => {
      // The pending-user insert collides first on the unique email.
      await invite("dupe@example.com", "tok-dupe-1");
      await expect(invite("dupe@example.com", "tok-dupe-2")).rejects.toBeInstanceOf(
        ConflictError,
      );
    });
  });

  describe("markAccepted", () => {
    it("flips status to accepted and stamps acceptedAt", async () => {
      const created = await invite("accept@example.com", "tok-accept");
      await repo.markAccepted(created.id);

      const found = await repo.getByToken("tok-accept");
      expect(found!.status).toBe("accepted");
      expect(found!.acceptedAt).not.toBeNull();
    });
  });

  describe("list", () => {
    it("lists invitations for the org, newest first", async () => {
      const { organizationId: org, ownerId } = await seedOrg(testDb.db);
      for (const [email, tok] of [
        ["a@l.com", "lt-a"],
        ["b@l.com", "lt-b"],
      ] as const) {
        const pending = await userRepo.createPending({
          organizationId: org,
          name: "X",
          email,
          role: "approver",
        });
        await repo.create({
          organizationId: org,
          userId: pending.id,
          email,
          role: "approver",
          token: tok,
          invitedBy: ownerId,
        });
      }

      const { items, total } = await repo.list(org, { page: 1, pageSize: 100 });
      expect(total).toBe(2);
      expect(items.every((i) => i.organizationId === org)).toBe(true);
    });
  });
});
