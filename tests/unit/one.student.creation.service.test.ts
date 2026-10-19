jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/models/audit.model", () => ({
  AuditModel: {
    logStudentUpdated: jest.fn(),
    logStudentStatusChanged: jest.fn(),
    logStudentDeleted: jest.fn(),
  },
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import prismaClient from "../../src/config/database";
import { AuditModel } from "../../src/models/audit.model";
import { AppError } from "../../src/middleware/error.middleware";
import {
  assertSubclassesExist,
  blockStudent,
  deleteStudentById,
  findStudentUniquenessConflicts,
  listStudents,
  mapStudentUniqueViolation,
  unblockStudent,
  updateStudentById,
} from "../../src/services/student.service";
import { listStudentsQuerySchema } from "../../src/validations/studentManagement.schema";
import { PrismaMock } from "../helpers/prismaMock";
import { prismaError } from "../helpers/fixtures";

const prisma = prismaClient as unknown as PrismaMock;
const businessId = BigInt(1);
const studentId = BigInt(42);
const actor = { userId: "user-1", ip: "127.0.0.1" };

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ statusCode, code });
  return error as AppError;
};

// ==========================================
// Listing
// ==========================================

describe("listStudents", () => {
  const list = (query: Record<string, string> = {}) =>
    listStudents(businessId, listStudentsQuerySchema.parse(query));
  const whereArg = () => prisma.students.findMany.mock.calls[0][0].where;

  beforeEach(() => {
    prisma.students.findMany.mockResolvedValue([{ id: BigInt(1) }]);
    prisma.students.count.mockResolvedValue(101);
  });

  it("scopes to the business, excludes soft-deleted students and paginates", async () => {
    const result = await list({ page: "3", limit: "20" });

    const args = prisma.students.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ businessId, deletedAt: null });
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(prisma.students.count).toHaveBeenCalledWith({ where: args.where });
    expect(result.pagination).toEqual({ page: 3, limit: 20, total: 101, totalPages: 6 });
  });

  it("never selects the password or other sensitive fields", async () => {
    await list();
    const select = prisma.students.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("password");
    expect(select).not.toHaveProperty("blockReason");
    expect(select).not.toHaveProperty("failedLoginCount");
    expect(select).not.toHaveProperty("isWalletCreated");
  });

  it("returns zero pages for an empty result", async () => {
    prisma.students.count.mockResolvedValue(0);
    expect((await list()).pagination.totalPages).toBe(0);
  });

  it("sorts by the requested field with id as tie-breaker", async () => {
    await list({ sortBy: "lastName", sortOrder: "asc" });
    expect(prisma.students.findMany.mock.calls[0][0].orderBy).toEqual([
      { lastName: "asc" },
      { id: "asc" },
    ]);
  });

  it("requires every word of name to match some name field", async () => {
    await list({ name: "  John   Doe " });
    expect(whereArg().AND).toHaveLength(2);
    expect(whereArg().AND[0].OR).toEqual([
      { firstName: { contains: "John", mode: "insensitive" } },
      { middleName: { contains: "John", mode: "insensitive" } },
      { lastName: { contains: "John", mode: "insensitive" } },
    ]);
    expect(whereArg().AND[1].OR[0].firstName.contains).toBe("Doe");
  });

  it("searches names and registration number", async () => {
    await list({ search: "stu" });
    expect(whereArg().AND).toEqual([
      {
        OR: [
          { firstName: { contains: "stu", mode: "insensitive" } },
          { lastName: { contains: "stu", mode: "insensitive" } },
          { registrationNumber: { contains: "stu", mode: "insensitive" } },
        ],
      },
    ]);
  });

  it("filters by exact registration number, status and subclass", async () => {
    await list({ regNo: "STU001", status: "blocked", subclassId: "5" });
    expect(whereArg()).toMatchObject({
      registrationNumber: "STU001",
      status: "blocked",
      subclassId: BigInt(5),
    });
  });

  it("filters by class name (case-insensitive) and class id", async () => {
    await list({ class: "JSS1", classId: "2" });
    expect(whereArg().subclass).toEqual({
      classId: BigInt(2),
      class: { name: { equals: "JSS1", mode: "insensitive" } },
    });
  });

  it("filters by exact age", async () => {
    await list({ age: "12" });
    expect(whereArg().age).toBe(12);
  });

  it("filters by age range, including one-sided ranges", async () => {
    await list({ minAge: "8", maxAge: "12" });
    expect(whereArg().age).toEqual({ gte: 8, lte: 12 });

    prisma.students.findMany.mockClear();
    await list({ minAge: "8" });
    expect(whereArg().age).toEqual({ gte: 8, lte: undefined });
  });

  it("treats endDate as inclusive of the whole UTC day", async () => {
    await list({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(whereArg().createdAt).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lt: new Date("2026-02-01T00:00:00.000Z"),
    });
  });

  it("supports an open-ended start date", async () => {
    await list({ startDate: "2026-01-01" });
    expect(whereArg().createdAt).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lt: undefined,
    });
  });
});

// ==========================================
// Uniqueness helpers
// ==========================================

describe("findStudentUniquenessConflicts", () => {
  const path = (i: number, f: string) => `students[${i}].${f}`;

  it("skips the query when there is nothing to check", async () => {
    expect(await findStudentUniquenessConflicts([{ registrationNumber: null }], path)).toEqual([]);
    expect(prisma.students.findMany).not.toHaveBeenCalled();
  });

  it("reports each conflicting field with its path", async () => {
    prisma.students.findMany.mockResolvedValue([
      { email: "Taken@Example.com", phoneNumber: "+111111111", registrationNumber: null },
      { email: "other@example.com", phoneNumber: "+222222222", registrationNumber: "REG1" },
    ]);

    const conflicts = await findStudentUniquenessConflicts(
      [
        { email: "free@example.com", phoneNumber: "+999999999", registrationNumber: "REG9" },
        { email: "taken@example.com", phoneNumber: "+222222222", registrationNumber: "REG1" },
      ],
      path,
    );

    expect(conflicts).toEqual([
      { field: "students[1].email", message: "Email address is already in use" },
      { field: "students[1].phoneNumber", message: "Phone number is already in use" },
      { field: "students[1].registrationNumber", message: "Registration number is already in use" },
    ]);
  });

  it("matches emails case-insensitively and excludes the student being updated", async () => {
    prisma.students.findMany.mockResolvedValue([]);
    await findStudentUniquenessConflicts([{ email: "a@b.com" }], path, studentId);

    expect(prisma.students.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ email: { in: ["a@b.com"], mode: "insensitive" } }],
      id: { not: studentId },
    });
  });

  it("includes soft-deleted students (they still hold unique keys)", async () => {
    prisma.students.findMany.mockResolvedValue([]);
    await findStudentUniquenessConflicts([{ phoneNumber: "+111111111" }], path);
    expect(prisma.students.findMany.mock.calls[0][0].where).not.toHaveProperty("deletedAt");
  });
});

describe("mapStudentUniqueViolation", () => {
  it("maps P2002 to a 409 naming the field", () => {
    const mapped = mapStudentUniqueViolation(prismaError("P2002", { target: ["phone_number"] }));
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({
      statusCode: 409,
      code: "DUPLICATE_STUDENT_FIELD",
      details: [{ field: "phoneNumber", message: "Phone number is already in use" }],
    });
  });

  it("uses a generic detail when the field is unknown", () => {
    const mapped = mapStudentUniqueViolation(prismaError("P2002", { target: ["something"] }));
    expect((mapped as AppError).details).toEqual([
      { field: "student", message: "A unique student field is already in use" },
    ]);
  });

  it("returns other errors unchanged", () => {
    const other = prismaError("P2003");
    expect(mapStudentUniqueViolation(other)).toBe(other);
    const plain = new Error("x");
    expect(mapStudentUniqueViolation(plain)).toBe(plain);
  });
});

describe("assertSubclassesExist", () => {
  it("passes when every subclass exists, querying each id once", async () => {
    prisma.subclasses.findMany.mockResolvedValue([{ id: BigInt(1) }, { id: BigInt(2) }]);
    await assertSubclassesExist([BigInt(1), BigInt(2), BigInt(1)], () => ["subclassId"]);
    expect(prisma.subclasses.findMany.mock.calls[0][0].where.id.in).toEqual([BigInt(1), BigInt(2)]);
  });

  it("throws 400 listing every field that references a missing subclass", async () => {
    prisma.subclasses.findMany.mockResolvedValue([{ id: BigInt(1) }]);
    const error = await expectAppError(
      assertSubclassesExist([BigInt(1), BigInt(9)], (id) => [`a.${id}`, `b.${id}`]),
      400,
      "INVALID_SUBCLASS",
    );
    expect(error.details).toEqual([
      { field: "a.9", message: "Subclass does not exist" },
      { field: "b.9", message: "Subclass does not exist" },
    ]);
  });
});

// ==========================================
// Update
// ==========================================

describe("updateStudentById", () => {
  beforeEach(() => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status: "active" });
    prisma.students.findMany.mockResolvedValue([]);
    prisma.subclasses.findMany.mockResolvedValue([{ id: BigInt(3) }]);
    prisma.students.update.mockResolvedValue({ id: studentId, firstName: "Ada" });
  });

  it("updates the student and writes an audit log in one transaction", async () => {
    const result = await updateStudentById(
      studentId,
      businessId,
      { firstName: "Ada", subclassId: BigInt(3) },
      actor,
    );

    expect(result).toEqual({ id: studentId, firstName: "Ada" });
    expect(prisma.students.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: studentId, businessId, deletedAt: null },
        data: { firstName: "Ada", subclassId: BigInt(3) },
      }),
    );
    expect(AuditModel.logStudentUpdated).toHaveBeenCalledWith(
      "user-1",
      studentId,
      ["firstName", "subclassId"],
      "127.0.0.1",
      prisma,
    );
  });

  it("only looks up students in the caller's business that are not deleted", async () => {
    await updateStudentById(studentId, businessId, { firstName: "Ada" }, actor);
    expect(prisma.students.findFirst.mock.calls[0][0].where).toEqual({
      id: studentId,
      businessId,
      deletedAt: null,
    });
  });

  it("throws 404 when the student is not found", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    await expectAppError(
      updateStudentById(studentId, businessId, { firstName: "Ada" }, actor),
      404,
      "STUDENT_NOT_FOUND",
    );
    expect(prisma.students.update).not.toHaveBeenCalled();
  });

  it("throws 409 when the new email belongs to another student", async () => {
    prisma.students.findMany.mockResolvedValue([
      { email: "taken@example.com", phoneNumber: "+1", registrationNumber: null },
    ]);
    const error = await expectAppError(
      updateStudentById(studentId, businessId, { email: "taken@example.com" }, actor),
      409,
      "DUPLICATE_STUDENT_FIELD",
    );
    expect(error.details).toEqual([{ field: "email", message: "Email address is already in use" }]);
    expect(prisma.students.update).not.toHaveBeenCalled();
  });

  it("throws 400 when the new subclass does not exist", async () => {
    prisma.subclasses.findMany.mockResolvedValue([]);
    await expectAppError(
      updateStudentById(studentId, businessId, { subclassId: BigInt(99) }, actor),
      400,
      "INVALID_SUBCLASS",
    );
  });

  it("does not check subclasses when subclassId is not being changed", async () => {
    await updateStudentById(studentId, businessId, { firstName: "Ada" }, actor);
    expect(prisma.subclasses.findMany).not.toHaveBeenCalled();
  });

  it("maps a concurrent deletion (P2025) to 404", async () => {
    prisma.students.update.mockRejectedValue(prismaError("P2025"));
    await expectAppError(
      updateStudentById(studentId, businessId, { firstName: "Ada" }, actor),
      404,
      "STUDENT_NOT_FOUND",
    );
  });

  it("maps a lost uniqueness race (P2002) to 409", async () => {
    prisma.students.update.mockRejectedValue(prismaError("P2002", { target: ["email"] }));
    await expectAppError(
      updateStudentById(studentId, businessId, { email: "x@example.com" }, actor),
      409,
      "DUPLICATE_STUDENT_FIELD",
    );
  });

  it("rethrows unexpected errors", async () => {
    const failure = new Error("connection lost");
    prisma.students.update.mockRejectedValue(failure);
    await expect(
      updateStudentById(studentId, businessId, { firstName: "Ada" }, actor),
    ).rejects.toBe(failure);
  });
});

// ==========================================
// Block / unblock
// ==========================================

describe("blockStudent", () => {
  beforeEach(() => {
    prisma.students.updateMany.mockResolvedValue({ count: 1 });
  });

  it.each(["active", "pending", "inactive"])("blocks a %s student", async (status) => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status });

    const result = await blockStudent(studentId, businessId, "Fraud", actor);

    expect(result).toEqual({ studentId, status: "blocked", changed: true });
    expect(prisma.students.updateMany).toHaveBeenCalledWith({
      where: { id: studentId, status, deletedAt: null },
      data: { status: "blocked", blockReason: "Fraud" },
    });
    expect(AuditModel.logStudentStatusChanged).toHaveBeenCalledWith(
      "user-1",
      studentId,
      "blocked",
      "Fraud",
      "127.0.0.1",
      prisma,
    );
  });

  it("is a no-op for an already-blocked student", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status: "blocked" });
    expect(await blockStudent(studentId, businessId, "Fraud", actor)).toEqual({
      studentId,
      status: "blocked",
      changed: false,
    });
    expect(prisma.students.updateMany).not.toHaveBeenCalled();
    expect(AuditModel.logStudentStatusChanged).not.toHaveBeenCalled();
  });

  it.each(["graduated", "withdrawn", "suspended"])(
    "refuses to block a %s student",
    async (status) => {
      prisma.students.findFirst.mockResolvedValue({ id: studentId, status });
      await expectAppError(
        blockStudent(studentId, businessId, "Fraud", actor),
        409,
        "INVALID_STATUS_TRANSITION",
      );
      expect(prisma.students.updateMany).not.toHaveBeenCalled();
    },
  );

  it("throws 404 for a missing student", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    await expectAppError(
      blockStudent(studentId, businessId, "Fraud", actor),
      404,
      "STUDENT_NOT_FOUND",
    );
  });

  it("throws 409 and skips the audit log when the status changed concurrently", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status: "active" });
    prisma.students.updateMany.mockResolvedValue({ count: 0 });
    await expectAppError(
      blockStudent(studentId, businessId, "Fraud", actor),
      409,
      "STATUS_CHANGED_CONCURRENTLY",
    );
    expect(AuditModel.logStudentStatusChanged).not.toHaveBeenCalled();
  });
});

describe("unblockStudent", () => {
  beforeEach(() => {
    prisma.students.updateMany.mockResolvedValue({ count: 1 });
  });

  it("restores active status, clears the reason and resets failed logins", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status: "blocked" });

    const result = await unblockStudent(studentId, businessId, "Resolved", actor);

    expect(result).toEqual({ studentId, status: "active", changed: true });
    expect(prisma.students.updateMany).toHaveBeenCalledWith({
      where: { id: studentId, status: "blocked", deletedAt: null },
      data: { status: "active", blockReason: null, failedLoginCount: 0 },
    });
    expect(AuditModel.logStudentStatusChanged).toHaveBeenCalledWith(
      "user-1",
      studentId,
      "unblocked",
      "Resolved",
      "127.0.0.1",
      prisma,
    );
  });

  it.each(["active", "graduated", "suspended"])(
    "is a no-op for a %s student",
    async (status) => {
      prisma.students.findFirst.mockResolvedValue({ id: studentId, status });
      expect(await unblockStudent(studentId, businessId, undefined, actor)).toEqual({
        studentId,
        status,
        changed: false,
      });
      expect(prisma.students.updateMany).not.toHaveBeenCalled();
    },
  );

  it("throws 404 for a missing student", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    await expectAppError(
      unblockStudent(studentId, businessId, undefined, actor),
      404,
      "STUDENT_NOT_FOUND",
    );
  });

  it("throws 409 when the status changed concurrently", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: studentId, status: "blocked" });
    prisma.students.updateMany.mockResolvedValue({ count: 0 });
    await expectAppError(
      unblockStudent(studentId, businessId, undefined, actor),
      409,
      "STATUS_CHANGED_CONCURRENTLY",
    );
  });
});

// ==========================================
// Delete
// ==========================================

describe("deleteStudentById", () => {
  it("soft deletes within the business and audits it", async () => {
    prisma.students.update.mockResolvedValue({});
    await deleteStudentById(studentId, businessId, actor);

    const args = prisma.students.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: studentId, businessId, deletedAt: null });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(AuditModel.logStudentDeleted).toHaveBeenCalledWith(
      "user-1",
      studentId,
      "127.0.0.1",
      prisma,
    );
  });

  it("throws 404 for a missing or already deleted student", async () => {
    prisma.students.update.mockRejectedValue(prismaError("P2025"));
    await expectAppError(deleteStudentById(studentId, businessId, actor), 404, "STUDENT_NOT_FOUND");
    expect(AuditModel.logStudentDeleted).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors", async () => {
    const failure = new Error("db down");
    prisma.students.update.mockRejectedValue(failure);
    await expect(deleteStudentById(studentId, businessId, actor)).rejects.toBe(failure);
  });
});
