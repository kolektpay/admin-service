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
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
} from "../../src/services/role.service";
import { prismaError } from "../helpers/fixtures";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;

const BUSINESS_ID = BigInt(1);
const actor = { userId: "staff-1", businessId: BUSINESS_ID, ip: "127.0.0.1" };

const roleRow = (overrides: Record<string, unknown> = {}) => ({
  id: BigInt(7),
  name: "Bursar",
  type: "custom",
  businessId: BUSINESS_ID,
  createdAt: new Date("2026-10-16T09:00:00Z"),
  updatedAt: new Date("2026-10-16T09:00:00Z"),
  permissions: [
    { permission: { id: BigInt(61), name: "admin.user_management.read_user", description: "Read user", type: "action" } },
  ],
  _count: { userHasRoles: 2 },
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

beforeEach(() => {
  prisma.roleHasPermission.findMany.mockResolvedValue([
    { permissionId: BigInt(61) },
    { permissionId: BigInt(62) },
  ]);
});

describe("listPermissions", () => {
  it("returns only assignable admin permissions with pagination", async () => {
    prisma.permissions.findMany.mockResolvedValue([{ id: BigInt(61) }]);
    prisma.permissions.count.mockResolvedValue(41);

    const result = await listPermissions({ page: 2, limit: 20, type: "action", search: "user" });

    const args = prisma.permissions.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ category: "admin", isBlacklisted: false, type: "action" });
    expect(args.where.OR).toHaveLength(2);
    expect(args).toMatchObject({ skip: 20, take: 20 });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
  });
});

describe("listRoles", () => {
  it("lists built-in and own-business roles and shapes each record", async () => {
    prisma.role.findMany.mockResolvedValue([roleRow(), roleRow({ id: BigInt(1), name: "admin", type: "fixed", businessId: null })]);
    prisma.role.count.mockResolvedValue(2);

    const result = await listRoles(BUSINESS_ID, { page: 1, limit: 10, search: "burs" });

    const { where } = prisma.role.findMany.mock.calls[0][0];
    expect(where.AND).toEqual([
      { OR: [{ businessId: null }, { businessId: BUSINESS_ID }] },
      { name: { contains: "burs", mode: "insensitive" } },
    ]);
    expect(prisma.role.count).toHaveBeenCalledWith({ where });
    expect(result.roles[0]).toEqual({
      id: BigInt(7),
      name: "Bursar",
      type: "custom",
      scope: "business",
      assignedAdminsCount: 2,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      permissions: [
        { id: BigInt(61), name: "admin.user_management.read_user", description: "Read user", type: "action" },
      ],
    });
    expect(result.roles[1].scope).toBe("system");
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });
});

describe("createRole", () => {
  const input = { name: "Bursar", permissionIds: [BigInt(61), BigInt(62)] };

  beforeEach(() => {
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.permissions.findMany.mockResolvedValue([{ id: BigInt(61) }, { id: BigInt(62) }]);
    prisma.role.create.mockResolvedValue(roleRow({ _count: { userHasRoles: 0 } }));
  });

  it("creates a custom role for the business with its permissions and audits it", async () => {
    const role = await createRole(input, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.role.create.mock.calls[0][0].data).toEqual({
      name: "Bursar",
      type: "custom",
      businessId: BUSINESS_ID,
      permissions: {
        createMany: { data: [{ permissionId: BigInt(61) }, { permissionId: BigInt(62) }] },
      },
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "staff-1", businessId: BUSINESS_ID, status: "role_created: 7 (Bursar)" }),
    });
    expect(role).toMatchObject({ id: BigInt(7), scope: "business", assignedAdminsCount: 0 });
  });

  it("checks the name case-insensitively against built-in and own roles", async () => {
    prisma.role.findFirst.mockResolvedValue({ id: BigInt(3) });

    await expectAppError(createRole(input, actor), 409, "ROLE_NAME_TAKEN");
    expect(prisma.role.findFirst.mock.calls[0][0].where.AND).toEqual([
      { OR: [{ businessId: null }, { businessId: BUSINESS_ID }] },
      { name: { equals: "Bursar", mode: "insensitive" } },
    ]);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("rejects permissions that do not exist or are not assignable", async () => {
    prisma.permissions.findMany.mockResolvedValue([{ id: BigInt(61) }]);

    const promise = createRole(input, actor);
    await expectAppError(promise, 400, "INVALID_PERMISSION");
    await expect(promise).rejects.toMatchObject({
      details: [{ field: "permissionIds", message: "Permission 62 does not exist or cannot be assigned to a role" }],
    });
    expect(prisma.permissions.findMany.mock.calls[0][0].where).toMatchObject({
      category: "admin",
      isBlacklisted: false,
    });
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("refuses to grant permissions the actor does not hold", async () => {
    prisma.roleHasPermission.findMany.mockResolvedValue([{ permissionId: BigInt(61) }]);

    await expectAppError(createRole(input, actor), 403, "PERMISSION_ESCALATION");
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate name to 409", async () => {
    prisma.role.create.mockRejectedValue(prismaError("P2002"));

    await expectAppError(createRole(input, actor), 409, "ROLE_NAME_TAKEN");
  });
});

describe("deleteRole", () => {
  const visibleRole = { id: BigInt(7), name: "Bursar", businessId: BUSINESS_ID, _count: { userHasRoles: 0 } };

  beforeEach(() => {
    prisma.role.findFirst.mockResolvedValue(visibleRole);
    prisma.role.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes the role's permissions and the role in one transaction and audits it", async () => {
    await deleteRole(BigInt(7), actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.roleHasPermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: BigInt(7) } });
    expect(prisma.role.deleteMany).toHaveBeenCalledWith({
      where: {
        id: BigInt(7),
        businessId: BUSINESS_ID,
        userHasRoles: { none: { user: { deletedAt: null } } },
      },
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "role_deleted: 7 (Bursar)" }),
    });
  });

  it("returns 404 for a role outside the business", async () => {
    prisma.role.findFirst.mockResolvedValue(null);

    await expectAppError(deleteRole(BigInt(7), actor), 404, "ROLE_NOT_FOUND");
  });

  it("refuses to delete a built-in role", async () => {
    prisma.role.findFirst.mockResolvedValue({ ...visibleRole, businessId: null });

    await expectAppError(deleteRole(BigInt(7), actor), 403, "SYSTEM_ROLE");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to delete a role held by administrators", async () => {
    prisma.role.findFirst.mockResolvedValue({ ...visibleRole, _count: { userHasRoles: 2 } });

    const promise = deleteRole(BigInt(7), actor);
    await expectAppError(promise, 409, "ROLE_IN_USE");
    await expect(promise).rejects.toThrow("assigned to 2 administrator(s)");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rolls back when the role is assigned between the check and the delete", async () => {
    prisma.role.deleteMany.mockResolvedValue({ count: 0 });

    await expectAppError(deleteRole(BigInt(7), actor), 409, "ROLE_IN_USE");
    expect(prisma.auditLogs.create).not.toHaveBeenCalled();
  });
});
