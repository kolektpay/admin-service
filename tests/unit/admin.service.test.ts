jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: { hash: jest.fn(async (value: string) => `hashed:${value}`) },
}));

import prismaClient from "../../src/config/database";
import { AppError } from "../../src/middleware/error.middleware";
import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  listAdmins,
  reactivateAdmin,
  updateAdmin,
  updateAdminStatus,
} from "../../src/services/admin.service";
import { prismaError } from "../helpers/fixtures";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;

const BUSINESS_ID = BigInt(1);
const ADMIN_ID = "321d02df-abcf-4ca7-a53d-75c2858633c0";
const actor = { userId: "staff-1", businessId: BUSINESS_ID, ip: "127.0.0.1" };

const bursar = { id: BigInt(7), name: "Bursar" };

/** A row as selected by adminPublicSelect. */
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
  userHasRoles: [{ role: bursar }],
  ...overrides,
});

/** The administrator being managed, as read by the service's lookup. */
const target = (status = "active", role: { id: bigint; name: string } | null = bursar) => ({
  id: ADMIN_ID,
  status,
  userHasRoles: role ? [{ role }] : [],
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

let emailOwner: { id: string } | null;
let managedAdmin: ReturnType<typeof target> | null;

beforeEach(() => {
  emailOwner = null;
  managedAdmin = target();
  // The same query serves the administrator lookup and the email uniqueness check
  prisma.users.findFirst.mockImplementation(async ({ where }: { where: { email?: string } }) =>
    where.email ? emailOwner : managedAdmin,
  );
  prisma.users.findUniqueOrThrow.mockResolvedValue(adminRow());
  prisma.users.updateMany.mockResolvedValue({ count: 1 });
  prisma.role.findFirst.mockResolvedValue({
    name: "Bursar",
    permissions: [{ permissionId: BigInt(61) }],
  });
  prisma.roleHasPermission.findMany.mockResolvedValue([{ permissionId: BigInt(61) }]);
});

describe("listAdmins", () => {
  it("scopes to the business, combines filters and adds each admin's role", async () => {
    prisma.users.findMany.mockResolvedValue([adminRow()]);
    prisma.users.count.mockResolvedValue(11);

    const result = await listAdmins(BUSINESS_ID, {
      page: 2,
      limit: 10,
      role: "bursar",
      status: "active",
      name: "jane smith",
      email: "@example.com",
    });

    const args = prisma.users.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      deletedAt: null,
      userHasRoles: {
        some: { businessId: BUSINESS_ID, role: { name: { equals: "bursar", mode: "insensitive" } } },
      },
      status: "active",
      email: { contains: "@example.com", mode: "insensitive" },
      AND: [
        { OR: [{ firstName: { contains: "jane", mode: "insensitive" } }, { lastName: { contains: "jane", mode: "insensitive" } }] },
        { OR: [{ firstName: { contains: "smith", mode: "insensitive" } }, { lastName: { contains: "smith", mode: "insensitive" } }] },
      ],
    });
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(args.select.password).toBeUndefined();
    expect(prisma.users.count).toHaveBeenCalledWith({ where: args.where });
    expect(result.users[0]).toMatchObject({ id: ADMIN_ID, role: bursar, userHasRoles: [{ role: bursar }] });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
  });
});

describe("getAdminById", () => {
  it("returns the admin with their role", async () => {
    managedAdmin = adminRow() as never;

    await expect(getAdminById(ADMIN_ID, BUSINESS_ID)).resolves.toMatchObject({ id: ADMIN_ID, role: bursar });
    const args = prisma.users.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: ADMIN_ID, deletedAt: null, userHasRoles: { some: { businessId: BUSINESS_ID } } });
    expect(args.select.password).toBeUndefined();
  });

  it("returns 404 for a user outside the business", async () => {
    managedAdmin = null;

    await expectAppError(getAdminById(ADMIN_ID, BUSINESS_ID), 404, "ADMIN_NOT_FOUND");
  });
});

describe("createAdmin", () => {
  const input = {
    email: "jane.smith@example.com",
    firstName: "jane",
    lastName: "smith",
    roleId: BigInt(7),
  };

  beforeEach(() => {
    prisma.users.create.mockResolvedValue(adminRow());
  });

  it("creates the account, role, business link, password history and email in one transaction", async () => {
    const admin = await createAdmin(input, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const { data, select } = prisma.users.create.mock.calls[0][0];
    expect(data).toMatchObject({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: expect.stringMatching(/^hashed:/),
      mustChangePassword: true,
      createdBy: "staff-1",
      userHasRoles: { create: { roleId: BigInt(7), businessId: BUSINESS_ID } },
      businesses: { create: { businessId: BUSINESS_ID } },
      passwordHistories: { create: { password: data.password, passwordstatus: "password-change" } },
    });
    expect(data).not.toHaveProperty("roleId");
    expect(select.password).toBeUndefined();
    expect(prisma.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toRecipientAddress: "jane.smith@example.com", type: "change_password_email" }),
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: `admin_created: ${ADMIN_ID} with role 7` }),
    });
    expect(admin).toMatchObject({ id: ADMIN_ID, role: bursar });
    expect(admin).not.toHaveProperty("password");
  });

  it("rejects a role that does not exist for the business", async () => {
    prisma.role.findFirst.mockResolvedValue(null);

    await expectAppError(createAdmin(input, actor), 400, "INVALID_ROLE");
    expect(prisma.role.findFirst.mock.calls[0][0].where).toEqual({
      id: BigInt(7),
      OR: [{ businessId: null }, { businessId: BUSINESS_ID }],
    });
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it("refuses to assign the manager role", async () => {
    prisma.role.findFirst.mockResolvedValue({ name: "manager", permissions: [] });

    await expectAppError(createAdmin(input, actor), 403, "MANAGER_ROLE_NOT_ASSIGNABLE");
  });

  it("refuses a role granting permissions the actor does not hold", async () => {
    prisma.role.findFirst.mockResolvedValue({
      name: "Bursar",
      permissions: [{ permissionId: BigInt(61) }, { permissionId: BigInt(99) }],
    });

    await expectAppError(createAdmin(input, actor), 403, "PERMISSION_ESCALATION");
  });

  it("rejects an email that is already in use", async () => {
    emailOwner = { id: "someone-else" };

    await expectAppError(createAdmin(input, actor), 409, "EMAIL_TAKEN");
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate email to 409", async () => {
    prisma.users.create.mockRejectedValue(prismaError("P2002"));

    await expectAppError(createAdmin(input, actor), 409, "EMAIL_TAKEN");
  });
});

describe("updateAdmin", () => {
  it("replaces the previous role with the new one", async () => {
    prisma.role.findFirst.mockResolvedValue({ name: "Cashier", permissions: [] });

    await updateAdmin(ADMIN_ID, { roleId: BigInt(8) }, actor);

    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: ADMIN_ID, deletedAt: null },
      data: {
        userHasRoles: {
          deleteMany: { businessId: BUSINESS_ID },
          create: { roleId: BigInt(8), businessId: BUSINESS_ID },
        },
      },
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: `admin_role_assigned: ${ADMIN_ID} to role 8` }),
    });
  });

  it("leaves the role alone when it is unchanged", async () => {
    await updateAdmin(ADMIN_ID, { firstName: "janet", roleId: BigInt(7) }, actor);

    expect(prisma.role.findFirst).not.toHaveBeenCalled();
    expect(prisma.users.update.mock.calls[0][0].data).toEqual({ firstName: "janet" });
  });

  it("lets staff edit their own details but not their own role", async () => {
    managedAdmin = { ...target(), id: actor.userId };

    await expect(updateAdmin(actor.userId, { firstName: "me" }, actor)).resolves.toBeDefined();
    await expectAppError(updateAdmin(actor.userId, { roleId: BigInt(8) }, actor), 403, "CANNOT_MANAGE_SELF");
  });

  it("protects the business manager's account", async () => {
    managedAdmin = target("active", { id: BigInt(2), name: "manager" });

    await expectAppError(updateAdmin(ADMIN_ID, { firstName: "x" }, actor), 403, "MANAGER_PROTECTED");
  });

  it("rejects an email that belongs to another user", async () => {
    emailOwner = { id: "someone-else" };

    await expectAppError(updateAdmin(ADMIN_ID, { email: "taken@example.com" }, actor), 409, "EMAIL_TAKEN");
    expect(prisma.users.findFirst).toHaveBeenCalledWith({
      where: { email: "taken@example.com", id: { not: ADMIN_ID } },
      select: { id: true },
    });
  });
});

describe("deleteAdmin", () => {
  it("soft deletes the admin and revokes their sessions", async () => {
    await deleteAdmin(ADMIN_ID, actor);

    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: ADMIN_ID, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.userTokens.updateMany).toHaveBeenCalledWith({
      where: { userId: ADMIN_ID, revoked: false },
      data: { revoked: true },
    });
  });

  it("refuses to delete yourself", async () => {
    managedAdmin = { ...target(), id: actor.userId };

    await expectAppError(deleteAdmin(actor.userId, actor), 403, "CANNOT_MANAGE_SELF");
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the admin was deleted concurrently", async () => {
    prisma.users.update.mockRejectedValue(prismaError("P2025"));

    await expectAppError(deleteAdmin(ADMIN_ID, actor), 404, "ADMIN_NOT_FOUND");
  });
});

describe("updateAdminStatus", () => {
  const leave = {
    status: "on_leave" as const,
    reason: "Annual leave",
    expectedReturnDate: new Date("2026-11-02T00:00:00Z"),
  };

  it("places an active admin on leave, storing the details and revoking sessions", async () => {
    prisma.users.findUniqueOrThrow.mockResolvedValue(
      adminRow({ status: "on_leave", leaveReason: leave.reason, expectedReturnDate: leave.expectedReturnDate }),
    );

    const result = await updateAdminStatus(ADMIN_ID, leave, actor);

    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: ADMIN_ID, status: "active", deletedAt: null },
      data: {
        status: "on_leave",
        leaveReason: "Annual leave",
        expectedReturnDate: leave.expectedReturnDate,
        blockReason: null,
      },
    });
    expect(prisma.userTokens.updateMany).toHaveBeenCalled();
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: `admin_status_changed: ${ADMIN_ID} to on_leave due to Annual leave` }),
    });
    expect(result).toMatchObject({ changed: true, admin: { status: "on_leave", leaveReason: "Annual leave" } });
  });

  it.each(["blocked", "inactive", "pending"])("cannot place a %s admin on leave", async (status) => {
    managedAdmin = target(status);

    await expectAppError(updateAdminStatus(ADMIN_ID, leave, actor), 409, "INVALID_STATUS_TRANSITION");
    expect(prisma.users.updateMany).not.toHaveBeenCalled();
  });

  it("blocks an admin on leave, clearing the leave details", async () => {
    managedAdmin = target("on_leave");

    await updateAdminStatus(ADMIN_ID, { status: "blocked", reason: "Policy breach" }, actor);

    expect(prisma.users.updateMany.mock.calls[0][0]).toEqual({
      where: { id: ADMIN_ID, status: "on_leave", deletedAt: null },
      data: { status: "blocked", blockReason: "Policy breach", leaveReason: null, expectedReturnDate: null },
    });
  });

  it("treats blocking a blocked admin as a no-op", async () => {
    managedAdmin = target("blocked");
    prisma.users.findFirst.mockImplementation(async ({ where }: { where: { email?: string } }) =>
      where.email ? null : { ...adminRow({ status: "blocked" }), ...target("blocked") },
    );

    const result = await updateAdminStatus(ADMIN_ID, { status: "blocked" }, actor);

    expect(result.changed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to change your own status", async () => {
    managedAdmin = { ...target(), id: actor.userId };

    await expectAppError(updateAdminStatus(actor.userId, leave, actor), 403, "CANNOT_MANAGE_SELF");
  });

  it("returns 409 when the status changed concurrently", async () => {
    prisma.users.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(updateAdminStatus(ADMIN_ID, leave, actor), 409, "STATUS_CHANGED_CONCURRENTLY");
    expect(prisma.auditLogs.create).not.toHaveBeenCalled();
  });
});

describe("reactivateAdmin", () => {
  it("brings an admin back from leave, clearing block and leave details", async () => {
    managedAdmin = target("on_leave");

    const result = await reactivateAdmin(ADMIN_ID, actor);

    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: ADMIN_ID, status: "on_leave", deletedAt: null },
      data: {
        status: "active",
        blockReason: null,
        leaveReason: null,
        expectedReturnDate: null,
        failedLoginCount: 0,
      },
    });
    expect(result.changed).toBe(true);
  });

  it("does not activate an admin who never completed onboarding", async () => {
    managedAdmin = target("inactive");
    prisma.users.findFirst.mockImplementation(async ({ where }: { where: { email?: string } }) =>
      where.email ? null : { ...adminRow({ status: "inactive" }), ...target("inactive") },
    );

    const result = await reactivateAdmin(ADMIN_ID, actor);

    expect(result.changed).toBe(false);
    expect(prisma.users.updateMany).not.toHaveBeenCalled();
  });
});
