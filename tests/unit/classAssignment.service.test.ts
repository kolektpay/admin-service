jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import prismaClient from "../../src/config/database";
import { AppError } from "../../src/middleware/error.middleware";
import {
  assignStudentToSubclass,
  bulkTransferStudents,
  getStudentAssignment,
  listSubclassStudents,
} from "../../src/services/classAssignment.service";
import { prismaError } from "../helpers/fixtures";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;

const BUSINESS_ID = BigInt(1);
const STUDENT_ID = BigInt(501);
const JSS1A = BigInt(12);
const JSS2A = BigInt(15);
const actor = { userId: "staff-1", businessId: BUSINESS_ID, ip: "127.0.0.1" };

const summary = (id: bigint, name: string) => ({ id, name, class: { id: BigInt(10), name: "JSS" } });

const assignmentRow = (subclassId = JSS2A) => ({
  id: STUDENT_ID,
  firstName: "Ada",
  middleName: null,
  lastName: "Obi",
  registrationNumber: "KOL/001",
  status: "active",
  subclass: {
    id: subclassId,
    name: "JSS 2A",
    class: { id: BigInt(11), name: "JSS 2", category: "normal" },
  },
  updatedAt: new Date(),
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

describe("getStudentAssignment", () => {
  it("returns the student's class and subclass separately", async () => {
    prisma.students.findFirst.mockResolvedValue(assignmentRow());

    const result = await getStudentAssignment(STUDENT_ID, BUSINESS_ID);

    expect(prisma.students.findFirst.mock.calls[0][0].where).toEqual({
      id: STUDENT_ID,
      businessId: BUSINESS_ID,
      deletedAt: null,
    });
    expect(result.class).toEqual({ id: BigInt(11), name: "JSS 2", category: "normal" });
    expect(result.subclass).toEqual({ id: JSS2A, name: "JSS 2A" });
    expect(result.student).not.toHaveProperty("subclass");
  });

  it("throws 404 for a student outside the business or removed", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    await expectAppError(getStudentAssignment(STUDENT_ID, BUSINESS_ID), 404, "STUDENT_NOT_FOUND");
  });
});

describe("listSubclassStudents", () => {
  it("lists active students of a subclass in the business", async () => {
    prisma.subclasses.findFirst.mockResolvedValue(summary(JSS1A, "JSS 1A"));
    prisma.students.findMany.mockResolvedValue([]);
    prisma.students.count.mockResolvedValue(0);

    await listSubclassStudents(JSS1A, BUSINESS_ID, { page: 1, limit: 50, status: "active" });

    expect(prisma.subclasses.findFirst.mock.calls[0][0].where).toEqual({
      id: JSS1A,
      class: { businessId: BUSINESS_ID },
    });
    expect(prisma.students.findMany.mock.calls[0][0].where).toEqual({
      businessId: BUSINESS_ID,
      deletedAt: null,
      subclassId: JSS1A,
      status: "active",
    });
  });

  it("throws 404 for a subclass outside the business", async () => {
    prisma.subclasses.findFirst.mockResolvedValue(null);
    await expectAppError(
      listSubclassStudents(JSS1A, BUSINESS_ID, { page: 1, limit: 50 }),
      404,
      "SUBCLASS_NOT_FOUND",
    );
    expect(prisma.students.findMany).not.toHaveBeenCalled();
  });
});

describe("assignStudentToSubclass", () => {
  beforeEach(() => {
    prisma.students.findFirst.mockResolvedValue({ id: STUDENT_ID, subclassId: JSS1A });
    prisma.subclasses.findFirst.mockResolvedValue(summary(JSS2A, "JSS 2A"));
  });

  it("moves the student only if they are still in the subclass that was read", async () => {
    prisma.students.updateMany.mockResolvedValue({ count: 1 });
    prisma.students.findUniqueOrThrow.mockResolvedValue(assignmentRow());

    const result = await assignStudentToSubclass(STUDENT_ID, { subclassId: JSS2A }, actor);

    expect(prisma.students.updateMany).toHaveBeenCalledWith({
      where: { id: STUDENT_ID, businessId: BUSINESS_ID, deletedAt: null, subclassId: JSS1A },
      data: { subclassId: JSS2A },
    });
    expect(prisma.auditLogs.create.mock.calls[0][0].data.status).toBe(
      "student_subclass_assigned: student 501 from subclass 12 to 15",
    );
    expect(result.subclass.id).toBe(JSS2A);
  });

  it("rejects assigning a student to the subclass they are already in", async () => {
    prisma.subclasses.findFirst.mockResolvedValue(summary(JSS1A, "JSS 1A"));
    await expectAppError(
      assignStudentToSubclass(STUDENT_ID, { subclassId: JSS1A }, actor),
      409,
      "STUDENT_ALREADY_ASSIGNED",
    );
    expect(prisma.students.updateMany).not.toHaveBeenCalled();
  });

  it("reports a conflict when another request moved the student first", async () => {
    prisma.students.updateMany.mockResolvedValue({ count: 0 });
    await expectAppError(
      assignStudentToSubclass(STUDENT_ID, { subclassId: JSS2A }, actor),
      409,
      "ASSIGNMENT_CONFLICT",
    );
    expect(prisma.auditLogs.create).not.toHaveBeenCalled();
  });

  it("rejects a subclass outside the business", async () => {
    prisma.subclasses.findFirst.mockResolvedValue(null);
    await expectAppError(
      assignStudentToSubclass(STUDENT_ID, { subclassId: JSS2A }, actor),
      404,
      "SUBCLASS_NOT_FOUND",
    );
  });

  it("rejects a missing student", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    await expectAppError(
      assignStudentToSubclass(STUDENT_ID, { subclassId: JSS2A }, actor),
      404,
      "STUDENT_NOT_FOUND",
    );
  });

  it("maps a subclass deleted mid-request to 404", async () => {
    prisma.students.updateMany.mockRejectedValue(prismaError("P2003"));
    await expectAppError(
      assignStudentToSubclass(STUDENT_ID, { subclassId: JSS2A }, actor),
      404,
      "SUBCLASS_NOT_FOUND",
    );
  });
});

describe("bulkTransferStudents", () => {
  beforeEach(() => {
    prisma.subclasses.findFirst.mockImplementation(({ where }: { where: { id: bigint } }) =>
      Promise.resolve(where.id === JSS1A ? summary(JSS1A, "JSS 1A") : summary(JSS2A, "JSS 2A")),
    );
  });

  it("moves every eligible student in the source in one conditional update", async () => {
    prisma.students.findMany.mockResolvedValue([{ id: BigInt(9) }]);
    prisma.students.updateManyAndReturn.mockResolvedValue([{ id: BigInt(1) }, { id: BigInt(2) }]);

    const result = await bulkTransferStudents(
      { sourceSubclassId: JSS1A, destinationSubclassId: JSS2A },
      actor,
    );

    expect(prisma.students.updateManyAndReturn.mock.calls[0][0]).toEqual({
      where: {
        businessId: BUSINESS_ID,
        deletedAt: null,
        subclassId: JSS1A,
        status: { notIn: ["graduated", "withdrawn"] },
      },
      data: { subclassId: JSS2A },
      select: { id: true },
    });
    expect(result).toMatchObject({
      movedCount: 2,
      movedStudentIds: [BigInt(1), BigInt(2)],
      skippedCount: 1,
      skipped: [{ studentId: BigInt(9), reason: "ineligible_status" }],
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledTimes(1);
  });

  it("moves only listed students and explains each one skipped", async () => {
    prisma.students.findMany.mockResolvedValue([
      { id: BigInt(1), subclassId: JSS1A, status: "active" },
      { id: BigInt(2), subclassId: JSS1A, status: "active" },
      { id: BigInt(3), subclassId: BigInt(77), status: "active" },
      { id: BigInt(4), subclassId: JSS1A, status: "graduated" },
    ]);
    // Student 2 left the source between the read and the update
    prisma.students.updateManyAndReturn.mockResolvedValue([{ id: BigInt(1) }]);

    const result = await bulkTransferStudents(
      {
        sourceSubclassId: JSS1A,
        destinationSubclassId: JSS2A,
        studentIds: [BigInt(1), BigInt(2), BigInt(3), BigInt(4), BigInt(5)],
      },
      actor,
    );

    expect(prisma.students.updateManyAndReturn.mock.calls[0][0].where.id).toEqual({
      in: [BigInt(1), BigInt(2)],
    });
    expect(result.movedStudentIds).toEqual([BigInt(1)]);
    expect(result.skipped).toEqual([
      { studentId: BigInt(3), reason: "not_in_source_subclass" },
      { studentId: BigInt(4), reason: "ineligible_status" },
      { studentId: BigInt(5), reason: "not_found" },
      { studentId: BigInt(2), reason: "not_in_source_subclass" },
    ]);
  });

  it("writes nothing when none of the listed students can move", async () => {
    prisma.students.findMany.mockResolvedValue([]);

    const result = await bulkTransferStudents(
      { sourceSubclassId: JSS1A, destinationSubclassId: JSS2A, studentIds: [BigInt(5)] },
      actor,
    );

    expect(prisma.students.updateManyAndReturn).not.toHaveBeenCalled();
    expect(prisma.auditLogs.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ movedCount: 0, skippedCount: 1 });
  });

  it("rejects a destination outside the business before reading students", async () => {
    prisma.subclasses.findFirst.mockImplementation(({ where }: { where: { id: bigint } }) =>
      Promise.resolve(where.id === JSS1A ? summary(JSS1A, "JSS 1A") : null),
    );
    const promise = bulkTransferStudents(
      { sourceSubclassId: JSS1A, destinationSubclassId: JSS2A },
      actor,
    );
    await expectAppError(promise, 404, "SUBCLASS_NOT_FOUND");
    await expect(promise).rejects.toMatchObject({
      details: [{ field: "destinationSubclassId", message: "Subclass does not exist" }],
    });
    expect(prisma.students.findMany).not.toHaveBeenCalled();
  });
});
