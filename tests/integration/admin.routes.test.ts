jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/managers/token.manager", () => ({
  __esModule: true,
  default: { verifyAccessToken: jest.fn() },
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
import { errorHandler, notFoundHandler } from "../../src/middleware/error.middleware";
import roleRouter from "../../src/routes/role/role.routes";
import adminRouter from "../../src/routes/user.routes";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;
const verifyAccessToken = TokenManager.verifyAccessToken as jest.Mock;

// Mirrors src/index.ts (which cannot be imported because it starts listening)
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};
const app = express();
app.use(express.json());
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/admin", roleRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const BASE = "/api/v1/admin";
const AUTH = { Authorization: "Bearer test-token" };
const ADMIN_ID = "321d02df-abcf-4ca7-a53d-75c2858633c0";

const loginAs = (decoded: Record<string, unknown>) =>
  verifyAccessToken.mockResolvedValue({ decoded, tokenData: { revoked: false } });

/** Grant the logged-in staff member exactly these permissions. */
const grant = (...permissions: string[]) =>
  prisma.roleHasPermission.findFirst.mockImplementation(
    async ({ where }: { where: { permission: { name: string } } }) =>
      permissions.includes(where.permission.name) ? { roleId: BigInt(1) } : null,
  );

const adminRow = (overrides: Record<string, unknown> = {}) => ({
  id: ADMIN_ID,
  email: "jane.smith@example.com",
  firstName: "jane",
  lastName: "smith",
  phoneNumber: null,
  status: "active",
  blockReason: null,
  leaveReason: null,
  expectedReturnDate: null,
  mustChangePassword: true,
  totpEnabled: false,
  failedLoginCount: 0,
  lastLoggedInAt: null,
  passwordExpiresAt: null,
  createdAt: new Date("2026-10-16T09:00:00Z"),
  updatedAt: new Date("2026-10-16T09:00:00Z"),
  userHasRoles: [{ role: { id: BigInt(7), name: "Bursar" } }],
  ...overrides,
});

const futureDate = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
};

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  loginAs({ userId: "staff-1", businessId: 1, role: "user" });
  grant(
    "admin.role_management.read_role",
    "admin.role_management.create_role",
    "admin.role_management.delete_role",
    "admin.user_management.read_user",
    "admin.user_management.create_user",
    "admin.user_management.update_user",
    "admin.user_management.delete_user",
  );
  prisma.roleHasPermission.findMany.mockResolvedValue([{ permissionId: BigInt(61) }]);
});

describe("authentication and authorisation", () => {
  it.each([
    ["get", "/permissions"],
    ["get", "/roles"],
    ["post", "/roles"],
    ["delete", "/roles/7"],
    ["get", "/users"],
    ["patch", `/users/${ADMIN_ID}/status`],
  ])("returns 401 for %s %s without a token", async (method, path) => {
    const res = await (request(app) as any)[method](`${BASE}${path}`);
    expect(res.status).toBe(401);
  });

  it.each([
    ["get", "/roles", "admin.role_management.read_role"],
    ["post", "/roles", "admin.role_management.create_role"],
    ["delete", "/roles/7", "admin.role_management.delete_role"],
    ["get", "/users", "admin.user_management.read_user"],
    ["post", "/users", "admin.user_management.create_user"],
    ["patch", `/users/${ADMIN_ID}`, "admin.user_management.update_user"],
    ["put", `/users/${ADMIN_ID}/roles`, "admin.user_management.update_user"],
    ["patch", `/users/${ADMIN_ID}/status`, "admin.user_management.update_user"],
    ["delete", `/users/${ADMIN_ID}`, "admin.user_management.delete_user"],
  ])("%s %s requires %s", async (method, path, permission) => {
    grant();

    const res = await (request(app) as any)[method](`${BASE}${path}`).set(AUTH).send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(`unauthorised: missing ${permission} permission`);
  });

  it.each(["student", "guardian"])("rejects %s tokens", async (role) => {
    loginAs({ guardianId: 5, studentId: 5, businessId: 1, role });

    const res = await request(app).get(`${BASE}/roles`).set(AUTH);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("unauthorised: staff only");
  });
});

describe("roles and permissions", () => {
  it("GET /permissions returns permissions with pagination", async () => {
    prisma.permissions.findMany.mockResolvedValue([
      { id: BigInt(61), name: "admin.user_management.read_user", description: "Read user", type: "action" },
    ]);
    prisma.permissions.count.mockResolvedValue(1);

    const res = await request(app).get(`${BASE}/permissions?type=action`).set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      permissions: [{ id: 61, name: "admin.user_management.read_user", description: "Read user", type: "action" }],
      pagination: { page: 1, limit: 200, total: 1, totalPages: 1 },
    });
  });

  it("POST /roles creates a role and returns 201", async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.permissions.findMany.mockResolvedValue([{ id: BigInt(61) }]);
    prisma.role.create.mockResolvedValue({
      id: BigInt(7),
      name: "Bursar",
      type: "custom",
      businessId: BigInt(1),
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [{ permission: { id: BigInt(61), name: "admin.user_management.read_user", description: "Read user", type: "action" } }],
      _count: { userHasRoles: 0 },
    });

    const res = await request(app)
      .post(`${BASE}/roles`)
      .set(AUTH)
      .send({ name: "Bursar", permissionIds: [61, 61] });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 7, name: "Bursar", scope: "business", permissions: [{ id: 61 }] });
    expect(prisma.role.create.mock.calls[0][0].data.permissions.createMany.data).toEqual([
      { permissionId: BigInt(61) },
    ]);
  });

  it("POST /roles returns field-level validation errors", async () => {
    const res = await request(app).post(`${BASE}/roles`).set(AUTH).send({ name: "B" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["name", "permissionIds"]),
    );
  });

  it("DELETE /roles/:roleId returns 409 while the role is assigned", async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: BigInt(7),
      name: "Bursar",
      businessId: BigInt(1),
      _count: { userHasRoles: 1 },
    });

    const res = await request(app).delete(`${BASE}/roles/7`).set(AUTH);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ROLE_IN_USE");
  });

  it("DELETE /roles/:roleId rejects a non-numeric id", async () => {
    const res = await request(app).delete(`${BASE}/roles/abc`).set(AUTH);

    expect(res.status).toBe(400);
    expect(prisma.role.findFirst).not.toHaveBeenCalled();
  });
});

describe("administrators", () => {
  it("GET /users filters by role, status, name and email and includes the role", async () => {
    prisma.users.findMany.mockResolvedValue([adminRow()]);
    prisma.users.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`${BASE}/users?role=Bursar&status=active&name=jane&email=example.com&page=1&limit=5`)
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Users retrieved successfully");
    expect(res.body.data.users[0].role).toEqual({ id: 7, name: "Bursar" });
    expect(res.body.data.users[0]).not.toHaveProperty("password");
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });
    expect(prisma.users.findMany.mock.calls[0][0].where.userHasRoles.some.businessId).toBe(BigInt(1));
  });

  it("GET /users rejects an invalid status filter", async () => {
    const res = await request(app).get(`${BASE}/users?status=retired`).set(AUTH);

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("status");
  });

  it("GET /users/:id returns 404 for a user outside the business", async () => {
    prisma.users.findFirst.mockResolvedValue(null);

    const res = await request(app).get(`${BASE}/users/${ADMIN_ID}`).set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ADMIN_NOT_FOUND");
  });

  it("POST /users creates an admin with several roles without exposing the password", async () => {
    prisma.role.findMany.mockResolvedValue([
      { id: BigInt(7), name: "Bursar", permissions: [{ permissionId: BigInt(61) }] },
      { id: BigInt(9), name: "Auditor", permissions: [] },
    ]);
    prisma.users.findFirst.mockResolvedValue(null);
    prisma.users.create.mockResolvedValue(
      adminRow({
        userHasRoles: [
          { role: { id: BigInt(7), name: "Bursar" } },
          { role: { id: BigInt(9), name: "Auditor" } },
        ],
      }),
    );

    const res = await request(app)
      .post(`${BASE}/users`)
      .set(AUTH)
      .send({ email: "Jane.Smith@example.com", firstName: "Jane", lastName: "Smith", roleIds: [7, 9] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User created successfully");
    expect(res.body.data).toMatchObject({
      id: ADMIN_ID,
      roles: [{ id: 7, name: "Bursar" }, { id: 9, name: "Auditor" }],
      role: { id: 7, name: "Bursar" },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hashed:/);
  });

  it("POST /users requires at least one role", async () => {
    const res = await request(app)
      .post(`${BASE}/users`)
      .set(AUTH)
      .send({ email: "jane@example.com", firstName: "Jane", lastName: "Smith" });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain("roleIds");
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it("PUT /users/:id/roles replaces the admin's roles", async () => {
    prisma.users.findFirst.mockResolvedValue({
      id: ADMIN_ID,
      status: "active",
      userHasRoles: [{ role: { id: BigInt(7), name: "Bursar" } }],
    });
    prisma.role.findMany.mockResolvedValue([{ id: BigInt(9), name: "Auditor", permissions: [] }]);
    prisma.users.findUniqueOrThrow.mockResolvedValue(
      adminRow({ userHasRoles: [{ role: { id: BigInt(9), name: "Auditor" } }] }),
    );

    const res = await request(app)
      .put(`${BASE}/users/${ADMIN_ID}/roles`)
      .set(AUTH)
      .send({ roleIds: [9] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User roles updated successfully");
    expect(res.body.data.roles).toEqual([{ id: 9, name: "Auditor" }]);
    expect(prisma.userHasRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: ADMIN_ID, roleId: BigInt(9), businessId: BigInt(1) }],
    });
  });

  it("PUT /users/:id/roles rejects an empty role list", async () => {
    const res = await request(app)
      .put(`${BASE}/users/${ADMIN_ID}/roles`)
      .set(AUTH)
      .send({ roleIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("roleIds");
  });

  it("PATCH /users/:id/status places an admin on leave", async () => {
    const returnDate = futureDate();
    prisma.users.findFirst.mockResolvedValue({ id: ADMIN_ID, status: "active", userHasRoles: [] });
    prisma.users.updateMany.mockResolvedValue({ count: 1 });
    prisma.users.findUniqueOrThrow.mockResolvedValue(
      adminRow({ status: "on_leave", leaveReason: "Annual leave", expectedReturnDate: new Date(returnDate) }),
    );

    const res = await request(app)
      .patch(`${BASE}/users/${ADMIN_ID}/status`)
      .set(AUTH)
      .send({ status: "on_leave", reason: "Annual leave", expectedReturnDate: returnDate });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Administrator placed on leave");
    expect(res.body.data).toMatchObject({ status: "on_leave", leaveReason: "Annual leave" });
  });

  it("PATCH /users/:id/status rejects on_leave without the leave details", async () => {
    const res = await request(app)
      .patch(`${BASE}/users/${ADMIN_ID}/status`)
      .set(AUTH)
      .send({ status: "on_leave" });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["reason", "expectedReturnDate"]),
    );
  });

  it("DELETE /users/:id refuses to delete yourself", async () => {
    loginAs({ userId: ADMIN_ID, businessId: 1, role: "user" });
    prisma.users.findFirst.mockResolvedValue({ id: ADMIN_ID, status: "active", userHasRoles: [] });

    const res = await request(app).delete(`${BASE}/users/${ADMIN_ID}`).set(AUTH);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CANNOT_MANAGE_SELF");
  });

  it("POST /users/roles/assign adds to the admin's roles", async () => {
    prisma.users.findFirst.mockResolvedValue({
      id: ADMIN_ID,
      status: "active",
      userHasRoles: [{ role: { id: BigInt(7), name: "Bursar" } }],
    });
    prisma.role.findMany.mockResolvedValue([{ id: BigInt(9), name: "Auditor", permissions: [] }]);
    prisma.users.findUniqueOrThrow.mockResolvedValue(adminRow());

    const res = await request(app)
      .post(`${BASE}/users/roles/assign`)
      .set(AUTH)
      .send({ action: "assign", userId: ADMIN_ID, roleIds: [9] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User role has been assigned");
    expect(prisma.userHasRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: ADMIN_ID, roleId: BigInt(7), businessId: BigInt(1) },
        { userId: ADMIN_ID, roleId: BigInt(9), businessId: BigInt(1) },
      ],
    });
  });
});
