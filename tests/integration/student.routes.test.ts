jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/managers/token.manager", () => ({
  __esModule: true,
  default: { verifyAccessToken: jest.fn() },
}));
jest.mock("../../src/models/audit.model", () => ({
  AuditModel: {
    logStudentsBulkCreated: jest.fn(),
    logStudentUpdated: jest.fn(),
    logStudentStatusChanged: jest.fn(),
    logStudentDeleted: jest.fn(),
  },
}));
jest.mock("../../src/thirdPartyService/wallet.services", () => ({
  createStudentWallet: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../../src/cache/throttleStore", () => ({
  incrementAndCheck: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../src/utils/request.metadata", () => ({
  extractRequestMetadata: () => ({ ip: "127.0.0.1" }),
}));
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: { hash: jest.fn(async (value: string) => `hashed:${value}`) },
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import express from "express";
import request from "supertest";
import prismaClient from "../../src/config/database";
import TokenManager from "../../src/managers/token.manager";
import { incrementAndCheck } from "../../src/cache/throttleStore";
import studentRouter from "../../src/routes/student/student.routes";
import { errorHandler, notFoundHandler } from "../../src/middleware/error.middleware";
import { PrismaMock } from "../helpers/prismaMock";
import { validStudentRecord } from "../helpers/fixtures";

const prisma = prismaClient as unknown as PrismaMock;
const verifyAccessToken = TokenManager.verifyAccessToken as jest.Mock;

// Mirrors src/index.ts (which cannot be imported because it starts listening)
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};
const app = express();
app.use(express.json());
app.use("/api/v1/admin/students", studentRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const BASE = "/api/v1/admin/students";
const AUTH = { Authorization: "Bearer test-token" };

const loginAs = (decoded: Record<string, unknown>) =>
  verifyAccessToken.mockResolvedValue({ decoded, tokenData: { revoked: false } });

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  loginAs({ userId: "staff-1", businessId: 1, role: "admin" });
  prisma.roleHasPermission.findFirst.mockResolvedValue({ roleId: BigInt(1) });
});

describe("authentication and authorisation", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
    expect(prisma.students.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 for a revoked token", async () => {
    verifyAccessToken.mockResolvedValue({
      decoded: { userId: "staff-1", businessId: 1 },
      tokenData: { revoked: true },
    });
    expect((await request(app).get(BASE).set(AUTH)).status).toBe(401);
  });

  it.each([
    ["student", { studentId: "s-1", businessId: 1, role: "student" }],
    ["guardian", { guardianId: "g-1", businessId: 1, role: "guardian" }],
  ])("returns 403 for %s tokens", async (_label, decoded) => {
    loginAs(decoded);
    const res = await request(app).get(BASE).set(AUTH);
    expect(res.status).toBe(403);
    expect(prisma.roleHasPermission.findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 for staff without a business", async () => {
    loginAs({ userId: "staff-1", role: "admin" });
    expect((await request(app).get(BASE).set(AUTH)).status).toBe(403);
  });

  it.each([
    ["get", BASE, "admin.student_management.read_student"],
    ["post", BASE, "admin.student_management.create_student"],
    ["post", `${BASE}/bulk`, "admin.student_management.create_student"],
    ["patch", `${BASE}/1`, "admin.student_management.update_student"],
    ["patch", `${BASE}/1/block`, "admin.student_management.update_student"],
    ["patch", `${BASE}/1/unblock`, "admin.student_management.update_student"],
    ["delete", `${BASE}/1`, "admin.student_management.delete_student"],
  ] as const)("%s %s requires %s", async (method, url, permission) => {
    prisma.roleHasPermission.findFirst.mockResolvedValue(null);

    const res = await request(app)[method](url).set(AUTH).send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toContain(permission);
    expect(prisma.roleHasPermission.findFirst.mock.calls[0][0].where.permission).toEqual({
      name: permission,
    });
  });
});

describe("GET /students", () => {
  beforeEach(() => {
    prisma.students.findMany.mockResolvedValue([
      { id: BigInt(7), firstName: "Ngozi", subclassId: BigInt(3) },
    ]);
    prisma.students.count.mockResolvedValue(1);
  });

  it("returns students and pagination, serialising bigint ids", async () => {
    const res = await request(app).get(`${BASE}?page=1&limit=10&status=active`).set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Students fetched successfully",
      data: {
        students: [{ id: 7, firstName: "Ngozi", subclassId: 3 }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(prisma.students.findMany.mock.calls[0][0].where).toMatchObject({
      businessId: BigInt(1),
      status: "active",
    });
  });

  it("returns 400 with field details for invalid query params", async () => {
    const res = await request(app).get(`${BASE}?limit=500&sortBy=password`).set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["limit", "sortBy"]),
    );
    expect(prisma.students.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /students and /students/bulk", () => {
  beforeEach(() => {
    prisma.students.findMany.mockResolvedValue([]);
    prisma.guardians.findMany.mockResolvedValue([{ id: BigInt(12) }]);
    prisma.subclasses.findMany.mockResolvedValue([{ id: BigInt(3) }]);
    prisma.students.updateMany.mockResolvedValue({ count: 1 });
    prisma.students.createManyAndReturn.mockImplementation(async ({ data }) =>
      data.map((row: Record<string, unknown>, i: number) => ({
        id: BigInt(100 + i),
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName,
        phoneNumber: row.phoneNumber,
        address: row.address,
        registrationNumber: row.registrationNumber,
        status: "pending",
        subclassId: row.subclassId,
        createdAt: new Date("2026-10-13T00:00:00.000Z"),
      })),
    );
  });

  it("creates a single student (201) without exposing the password", async () => {
    const res = await request(app).post(BASE).set(AUTH).send(validStudentRecord());

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Student created successfully");
    expect(res.body.data.student).toMatchObject({ id: 100, email: "ngozi.adetunji@example.com" });
    expect(res.body.data.student).not.toHaveProperty("password");
    expect(res.body.data.walletProvisioning).toEqual({ created: 1, pending: [] });
  });

  it("creates a batch (201) and reports the count", async () => {
    const res = await request(app)
      .post(`${BASE}/bulk`)
      .set(AUTH)
      .send({
        students: [
          validStudentRecord(),
          validStudentRecord({
            email: "b@example.com",
            phoneNumber: "+2348000000002",
            registrationNumber: "STU002",
          }),
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("2 student(s) created successfully");
    expect(res.body.data.createdCount).toBe(2);
  });

  it("returns 409 for duplicates within the batch", async () => {
    const res = await request(app)
      .post(`${BASE}/bulk`)
      .set(AUTH)
      .send({ students: [validStudentRecord(), validStudentRecord({ phoneNumber: "+2348000000002" })] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_IN_REQUEST");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-editable field like status", async () => {
    const res = await request(app).post(BASE).set(AUTH).send(validStudentRecord({ status: "active" }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 429 when the bulk endpoint is throttled", async () => {
    (incrementAndCheck as jest.Mock).mockResolvedValueOnce(42);
    const res = await request(app).post(`${BASE}/bulk`).set(AUTH).send({ students: [validStudentRecord()] });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain("42 seconds");
    expect(incrementAndCheck).toHaveBeenCalledWith("throttle:students-bulk-create:staff-1", 10, 60);
  });
});

describe("PATCH /students/:studentId", () => {
  it("updates the student", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: BigInt(5), status: "active" });
    prisma.students.findMany.mockResolvedValue([]);
    prisma.students.update.mockResolvedValue({ id: BigInt(5), firstName: "Ada" });

    const res = await request(app).patch(`${BASE}/5`).set(AUTH).send({ firstName: "Ada" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 5, firstName: "Ada" });
    expect(prisma.students.update.mock.calls[0][0].where).toEqual({
      id: BigInt(5),
      businessId: BigInt(1),
      deletedAt: null,
    });
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(app).patch(`${BASE}/abc`).set(AUTH).send({ firstName: "Ada" });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("studentId");
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app).patch(`${BASE}/5`).set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for a student in another business or deleted", async () => {
    prisma.students.findFirst.mockResolvedValue(null);
    const res = await request(app).patch(`${BASE}/5`).set(AUTH).send({ firstName: "Ada" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("STUDENT_NOT_FOUND");
  });
});

describe("PATCH /students/:studentId/block and /unblock", () => {
  beforeEach(() => {
    prisma.students.updateMany.mockResolvedValue({ count: 1 });
  });

  it("blocks a student", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: BigInt(5), status: "active" });
    const res = await request(app).patch(`${BASE}/5/block`).set(AUTH).send({ reason: "Fraud" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Student blocked successfully",
      data: { studentId: 5, status: "blocked", changed: true },
    });
  });

  it("requires a reason to block", async () => {
    const res = await request(app).patch(`${BASE}/5/block`).set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("reason");
  });

  it("returns 409 for a graduated student", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: BigInt(5), status: "graduated" });
    const res = await request(app).patch(`${BASE}/5/block`).set(AUTH).send({ reason: "Fraud" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("unblocks without a body", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: BigInt(5), status: "blocked" });
    const res = await request(app).patch(`${BASE}/5/unblock`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Student unblocked successfully");
  });

  it("reports unblocking a non-blocked student as unchanged", async () => {
    prisma.students.findFirst.mockResolvedValue({ id: BigInt(5), status: "active" });
    const res = await request(app).patch(`${BASE}/5/unblock`).set(AUTH).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "Student is not blocked", data: { changed: false } });
  });
});

describe("DELETE /students/:studentId", () => {
  it("soft deletes the student", async () => {
    prisma.students.update.mockResolvedValue({});
    const res = await request(app).delete(`${BASE}/5`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Student deleted successfully");
    expect(prisma.students.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when the student does not exist", async () => {
    const { prismaError } = jest.requireActual("../helpers/fixtures");
    prisma.students.update.mockRejectedValue(prismaError("P2025"));
    const res = await request(app).delete(`${BASE}/5`).set(AUTH);
    expect(res.status).toBe(404);
  });

  it("returns 500 (not a hung request) on unexpected errors", async () => {
    prisma.students.update.mockRejectedValue(new Error("db down"));
    const res = await request(app).delete(`${BASE}/5`).set(AUTH);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});
