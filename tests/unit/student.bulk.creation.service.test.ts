jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/models/audit.model", () => ({
  AuditModel: { logStudentsBulkCreated: jest.fn() },
}));
jest.mock("../../src/thirdPartyService/wallet.services", () => ({
  createStudentWallet: jest.fn(),
}));
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: { hash: jest.fn(async (value: string) => `hashed:${value}`) },
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import prismaClient from "../../src/config/database";
import { AuditModel } from "../../src/models/audit.model";
import { createStudentWallet } from "../../src/thirdPartyService/wallet.services";
import { AppError } from "../../src/middleware/error.middleware";
import { bulkCreateStudents } from "../../src/services/studentservice.service";
import {
  BulkStudentRecord,
  bulkStudentRecordSchema,
} from "../../src/validations/studentManagement.schema";
import { PrismaMock } from "../helpers/prismaMock";
import { prismaError, validStudentRecord } from "../helpers/fixtures";

const prisma = prismaClient as unknown as PrismaMock;
const walletMock = createStudentWallet as jest.Mock;
const businessId = BigInt(1);
const actor = { userId: "user-1", ip: "127.0.0.1" };

const record = (n: number, overrides: Record<string, unknown> = {}): BulkStudentRecord =>
  bulkStudentRecordSchema.parse(
    validStudentRecord({
      email: `student${n}@example.com`,
      phoneNumber: `+23480000000${n}`,
      registrationNumber: `STU00${n}`,
      ...overrides,
    }),
  );

const rejection = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
};

/** Simulate the DB returning rows (deliberately in reverse order) with sequential ids. */
const returnInsertedRows = () =>
  prisma.students.createManyAndReturn.mockImplementation(async ({ data }) =>
    data
      .map((row: Record<string, unknown>, i: number) => ({
        ...row,
        id: BigInt(100 + i),
        status: "pending",
        createdAt: new Date(),
      }))
      .reverse(),
  );

beforeEach(() => {
  prisma.students.findMany.mockResolvedValue([]);
  prisma.guardians.findMany.mockResolvedValue([{ id: BigInt(12) }]);
  prisma.subclasses.findMany.mockResolvedValue([{ id: BigInt(3) }]);
  returnInsertedRows();
  prisma.students.updateMany.mockResolvedValue({ count: 0 });
  walletMock.mockResolvedValue({ success: true });
});

describe("bulkCreateStudents — happy path", () => {
  it("creates students, guardian links, password history, notifications and audit atomically", async () => {
    const records = [record(1), record(2)];
    const { students, walletProvisioning } = await bulkCreateStudents(records, businessId, actor);

    expect(students).toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });

    const inserted = prisma.students.createManyAndReturn.mock.calls[0][0].data;
    expect(inserted[0]).toMatchObject({
      businessId,
      subclassId: BigInt(3),
      email: "student1@example.com",
      mustChangePassword: true,
    });
    expect(inserted[0].password).toMatch(/^hashed:[A-Za-z0-9]{8}$/);
    expect(inserted[0]).not.toHaveProperty("city");
    expect(inserted[0]).not.toHaveProperty("guardianId");

    expect(prisma.notifications.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(prisma.passwordHistory.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(AuditModel.logStudentsBulkCreated).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([BigInt(100), BigInt(101)]),
      "127.0.0.1",
      prisma,
    );
    expect(walletProvisioning).toEqual({ created: 2, pending: [] });
  });

  it("links rows by email even when the database returns them out of order", async () => {
    await bulkCreateStudents([record(1), record(2)], businessId, actor);

    // Inserted ids: student1 -> 100, student2 -> 101 (returned reversed)
    expect(prisma.guardianHasStudents.createMany.mock.calls[0][0].data).toEqual([
      { studentId: BigInt(100), guardianId: BigInt(12) },
      { studentId: BigInt(101), guardianId: BigInt(12) },
    ]);
    expect(
      prisma.passwordHistory.createMany.mock.calls[0][0].data.map(
        (r: { studentId: bigint }) => r.studentId,
      ),
    ).toEqual([BigInt(100), BigInt(101)]);
  });

  it("stores only the hash, while the notification carries the plain temporary password", async () => {
    await bulkCreateStudents([record(1)], businessId, actor);

    const hashed: string = prisma.students.createManyAndReturn.mock.calls[0][0].data[0].password;
    const plain = hashed.replace("hashed:", "");
    const notification = prisma.notifications.createMany.mock.calls[0][0].data[0];

    expect(notification.toRecipientAddress).toBe("student1@example.com");
    expect(notification.content).toContain(plain);
    expect(prisma.passwordHistory.createMany.mock.calls[0][0].data[0].password).toBe(hashed);
  });

  it("gives every student a different temporary password", async () => {
    const records = Array.from({ length: 20 }, (_, i) => record(i + 1, { phoneNumber: `+2348000${1000 + i}` }));
    await bulkCreateStudents(records, businessId, actor);
    const passwords = prisma.students.createManyAndReturn.mock.calls[0][0].data.map(
      (r: { password: string }) => r.password,
    );
    expect(new Set(passwords).size).toBe(20);
  });
});

describe("bulkCreateStudents — validation before writing", () => {
  it("rejects duplicates within the request, pointing at the later record", async () => {
    const error = await rejection(
      bulkCreateStudents(
        [record(1), record(2, { email: "student1@example.com" }), record(3, { registrationNumber: "STU001" })],
        businessId,
        actor,
      ),
    );

    expect(error).toMatchObject({ statusCode: 409, code: "DUPLICATE_IN_REQUEST" });
    expect(error.details).toEqual([
      { field: "students[1].email", message: "Duplicates students[0].email in this request" },
      {
        field: "students[2].registrationNumber",
        message: "Duplicates students[0].registrationNumber in this request",
      },
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("treats missing registration numbers as non-duplicates", async () => {
    await bulkCreateStudents(
      [record(1, { registrationNumber: null }), record(2, { registrationNumber: null })],
      businessId,
      actor,
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejects values already used by existing students", async () => {
    prisma.students.findMany.mockResolvedValue([
      { email: "student2@example.com", phoneNumber: "+999", registrationNumber: null },
    ]);
    const error = await rejection(bulkCreateStudents([record(1), record(2)], businessId, actor));
    expect(error).toMatchObject({ statusCode: 409, code: "DUPLICATE_STUDENT_FIELD" });
    expect(error.details).toEqual([
      { field: "students[1].email", message: "Email address is already in use" },
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects guardians that are missing, deleted, ineligible or from another business", async () => {
    prisma.guardians.findMany.mockResolvedValue([{ id: BigInt(12) }]);
    const error = await rejection(
      bulkCreateStudents([record(1), record(2, { guardianId: 77 })], businessId, actor),
    );

    expect(error).toMatchObject({ statusCode: 400, code: "GUARDIAN_NOT_ASSIGNABLE" });
    expect(error.details).toEqual([
      { field: "students[1].guardianId", message: "Guardian not found or not eligible for assignment" },
    ]);
    expect(prisma.guardians.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [BigInt(12), BigInt(77)] },
      businessId,
      deletedAt: null,
      status: { in: ["active", "pending"] },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unknown subclasses, listing every record that uses them", async () => {
    const error = await rejection(
      bulkCreateStudents(
        [record(1, { subclassId: 9 }), record(2), record(3, { subclassId: 9 })],
        businessId,
        actor,
      ),
    );
    expect(error).toMatchObject({ statusCode: 400, code: "INVALID_SUBCLASS" });
    expect(error.details?.map((d) => d.field)).toEqual([
      "students[0].subclassId",
      "students[2].subclassId",
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("bulkCreateStudents — transaction failures", () => {
  it("maps a unique-constraint race to 409 and requests no wallets", async () => {
    prisma.students.createManyAndReturn.mockRejectedValue(
      prismaError("P2002", { target: ["registration_number"] }),
    );
    const error = await rejection(bulkCreateStudents([record(1)], businessId, actor));
    expect(error).toMatchObject({
      statusCode: 409,
      details: [{ field: "registrationNumber", message: "Registration number is already in use" }],
    });
    expect(walletMock).not.toHaveBeenCalled();
  });

  it("propagates other failures (e.g. audit write) and requests no wallets", async () => {
    const failure = new Error("audit failed");
    (AuditModel.logStudentsBulkCreated as jest.Mock).mockRejectedValueOnce(failure);
    await expect(bulkCreateStudents([record(1)], businessId, actor)).rejects.toBe(failure);
    expect(walletMock).not.toHaveBeenCalled();
  });
});

describe("bulkCreateStudents — wallet provisioning", () => {
  it("sends the wallet-only fields (city, alias) to the payment service", async () => {
    await bulkCreateStudents([record(1, { middleName: null })], businessId, actor);
    expect(walletMock).toHaveBeenCalledWith({
      businessId: 1,
      student: expect.objectContaining({
        emailAddress: "student1@example.com",
        mobileNumber: "+234800000001",
        city: "Lagos",
        alias: "ngozi",
        middleName: undefined,
        studentId: 100,
      }),
    });
  });

  it("marks only successful wallets as created and reports the rest as pending", async () => {
    walletMock.mockImplementation(async ({ student }) => {
      if (student.emailAddress === "student2@example.com") return { success: false };
      if (student.emailAddress === "student3@example.com") throw new Error("timeout");
      return { success: true };
    });

    const { walletProvisioning } = await bulkCreateStudents(
      [record(1), record(2), record(3)],
      businessId,
      actor,
    );

    expect(walletProvisioning.created).toBe(1);
    expect(walletProvisioning.pending).toEqual(
      expect.arrayContaining([
        { studentId: BigInt(101), reason: "Wallet service rejected the request" },
        { studentId: BigInt(102), reason: "Wallet service unavailable" },
      ]),
    );
    expect(prisma.students.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [BigInt(100)] } },
      data: { isWalletCreated: true },
    });
  });

  it("does not flag any wallet when all fail", async () => {
    walletMock.mockRejectedValue(new Error("down"));
    const { students, walletProvisioning } = await bulkCreateStudents([record(1)], businessId, actor);
    expect(students).toHaveLength(1);
    expect(walletProvisioning).toEqual({
      created: 0,
      pending: [{ studentId: BigInt(100), reason: "Wallet service unavailable" }],
    });
    expect(prisma.students.updateMany).not.toHaveBeenCalled();
  });

  it("limits concurrent wallet requests to 5", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    walletMock.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return { success: true };
    });

    const records = Array.from({ length: 12 }, (_, i) =>
      record(i + 1, { phoneNumber: `+2348000${1000 + i}` }),
    );
    const { walletProvisioning } = await bulkCreateStudents(records, businessId, actor);

    expect(walletMock).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBe(5);
    expect(walletProvisioning.created).toBe(12);
  });
});
