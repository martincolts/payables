import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../types/errors.js";
import { createUserRepo, type UserRepo } from "./userRepo.js";
import { createTestDb, type TestDb } from "../test/testDb.js";

describe("userRepo", () => {
  let testDb: TestDb;
  let repo: UserRepo;

  beforeAll(async () => {
    testDb = await createTestDb();
    repo = createUserRepo(testDb.db);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe("create", () => {
    it("inserts a user and returns it without the password hash", async () => {
      const user = await repo.create({
        name: "Ada Lovelace",
        email: "ada@example.com",
        passwordHash: "scrypt$deadbeef$cafe",
      });

      expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(user.email).toBe("ada@example.com");
      expect(user.name).toBe("Ada Lovelace");
      expect(user.role).toBe("admin"); // default
      expect(user).not.toHaveProperty("passwordHash");
    });

    it("honors an explicit role", async () => {
      const user = await repo.create({
        name: "Grace Hopper",
        email: "grace@example.com",
        passwordHash: "scrypt$00$11",
        role: "approver",
      });
      expect(user.role).toBe("approver");
    });

    it("throws ConflictError on a duplicate email", async () => {
      await repo.create({
        name: "First",
        email: "dup@example.com",
        passwordHash: "scrypt$00$11",
      });

      await expect(
        repo.create({
          name: "Second",
          email: "dup@example.com",
          passwordHash: "scrypt$22$33",
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("getByEmail", () => {
    it("returns the user with its password hash", async () => {
      await repo.create({
        name: "Alan Turing",
        email: "alan@example.com",
        passwordHash: "scrypt$abc$def",
      });

      const found = await repo.getByEmail("alan@example.com");
      expect(found).not.toBeNull();
      expect(found!.email).toBe("alan@example.com");
      expect(found!.passwordHash).toBe("scrypt$abc$def");
    });

    it("returns null when no user matches", async () => {
      expect(await repo.getByEmail("missing@example.com")).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns the user when it exists", async () => {
      const created = await repo.create({
        name: "Edsger Dijkstra",
        email: "edsger@example.com",
        passwordHash: "scrypt$11$22",
      });

      const found = await repo.getById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.email).toBe("edsger@example.com");
    });

    it("throws NotFoundError for an unknown id", async () => {
      await expect(
        repo.getById("00000000-0000-0000-0000-000000000000"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
