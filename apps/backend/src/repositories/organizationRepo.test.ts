import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../types/errors.js";
import { createOrganizationRepo, type OrganizationRepo } from "./organizationRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";

describe("organizationRepo", () => {
  let testDb: TestDb;
  let repo: OrganizationRepo;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createOrganizationRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("createWithOwner", () => {
    it("creates an org and its admin owner atomically", async () => {
      const { organization, owner } = await repo.createWithOwner("Acme Inc", {
        name: "Owner",
        email: "owner@acme.com",
        passwordHash: "scrypt$00$11",
      });

      expect(organization.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(organization.name).toBe("Acme Inc");
      expect(organization.requiredApprovals).toBe(1); // default
      expect(owner.organizationId).toBe(organization.id);
      expect(owner.role).toBe("admin");
      expect(owner.email).toBe("owner@acme.com");
    });

    it("throws ConflictError when the owner email is taken", async () => {
      await repo.createWithOwner("Org A", {
        name: "A",
        email: "taken@example.com",
        passwordHash: "x",
      });

      await expect(
        repo.createWithOwner("Org B", {
          name: "B",
          email: "taken@example.com",
          passwordHash: "y",
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("getById / update", () => {
    it("reads back an organization", async () => {
      const { organization } = await repo.createWithOwner("Readable", {
        name: "O",
        email: "readable@example.com",
        passwordHash: "x",
      });
      const found = await repo.getById(organization.id);
      expect(found.name).toBe("Readable");
    });

    it("updates name and requiredApprovals", async () => {
      const { organization } = await repo.createWithOwner("Editable", {
        name: "O",
        email: "editable@example.com",
        passwordHash: "x",
      });

      const updated = await repo.update(organization.id, {
        name: "Edited",
        requiredApprovals: 3,
      });
      expect(updated.name).toBe("Edited");
      expect(updated.requiredApprovals).toBe(3);
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
