jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/managers/token.manager", () => ({
  __esModule: true,
  default: { generateTokens: jest.fn() },
}));
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: { compare: jest.fn() },
}));

import bcrypt from "bcrypt";

import prismaClient from "../../src/config/database";
import TokenManager from "../../src/managers/token.manager";
import { UserModel } from "../../src/models/user.model";
import {
  adminHeldLoginMessage,
  BLOCKED_BY_ADMIN_LOGIN_MESSAGE,
  logInService,
} from "../../src/services/auth.service";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;
const compare = bcrypt.compare as jest.Mock;

const USER_ID = "321d02df-abcf-4ca7-a53d-75c2858633c0";
const ON_LEAVE_MESSAGE =
  "Your account is on leave until 2026-11-02. Please contact your administrator.";
// Statuses only an administrator can lift
const notAdminHeld = { status: { notIn: ["on_leave", "blocked_by_admin"] } };

const user = (status: string) => ({
  id: USER_ID,
  email: "jane.smith@example.com",
  firstName: "jane",
  lastName: "smith",
  status,
  password: "hash",
  passwordExpiresAt: null,
  failedLoginCount: 2,
  expectedReturnDate: status === "on_leave" ? new Date("2026-11-02T00:00:00Z") : null,
});

const login = () =>
  logInService("jane.smith@example.com", "secret", "127.0.0.1", undefined, undefined, undefined, undefined);

describe.each([
  ["on_leave", ON_LEAVE_MESSAGE],
  ["blocked_by_admin", BLOCKED_BY_ADMIN_LOGIN_MESSAGE],
])("logInService for a %s user", (status, message) => {
  beforeEach(() => {
    prisma.users.findFirst.mockResolvedValue(user(status));
    compare.mockResolvedValue(true);
  });

  it("refuses with 403 and the reason, without issuing tokens", async () => {
    await expect(login()).rejects.toMatchObject({ statusCode: 403, message });
    expect(TokenManager.generateTokens).not.toHaveBeenCalled();
  });

  it("does not count the attempt or block the account automatically", async () => {
    await expect(login()).rejects.toMatchObject({ statusCode: 403 });

    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(prisma.users.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLogs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, status: "failed_login_attempt" }),
    });
  });
});

describe("logInService lookup", () => {
  it("does not find deleted users", async () => {
    prisma.users.findFirst.mockResolvedValue(null);

    await expect(login()).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.users.findFirst.mock.calls[0][0].where).toEqual({
      email: "jane.smith@example.com",
      deletedAt: null,
    });
  });
});

describe("adminHeldLoginMessage", () => {
  it("omits the return date when none is set", () => {
    expect(adminHeldLoginMessage({ status: "on_leave", expectedReturnDate: null })).toBe(
      "Your account is on leave. Please contact your administrator.",
    );
  });

  it.each(["active", "blocked", "inactive", "pending"])("does not apply to %s users", (status) => {
    expect(adminHeldLoginMessage({ status })).toBeNull();
  });
});

describe("status writes leave an admin block or leave in place", () => {
  it.each([
    ["changeUserStatusToActive", "active"],
    ["changeUserStatusToPending", "pending"],
  ] as const)("%s skips them", async (method, status) => {
    await UserModel[method](USER_ID);

    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, ...notAdminHeld },
      data: { status },
    });
  });

  it("a password reset changes the password but not the status", async () => {
    await UserModel.updatePasswordAndResetMustChangeToFalse(USER_ID, "new-hash");

    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: expect.objectContaining({ password: "new-hash", mustChangePassword: false }),
    });
    expect(prisma.users.update.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, ...notAdminHeld },
      data: { status: "active" },
    });
  });

  it("an automatic block does not replace them or their reason", async () => {
    await UserModel.blockAccount(USER_ID, "multiple failed login attempts");

    expect(prisma.users.update).not.toHaveBeenCalled();
    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, ...notAdminHeld },
      data: { status: "blocked", blockReason: "multiple failed login attempts" },
    });
  });

  it("the failed-login counter still counts, but its block skips them", async () => {
    prisma.users.update.mockResolvedValue({ failedLoginCount: 3 });

    await UserModel.incrementFailedLoginCount(USER_ID, 2, 3);

    expect(prisma.users.update.mock.calls[0][0].data).toEqual({ failedLoginCount: 3 });
    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, ...notAdminHeld },
      data: { status: "blocked" },
    });
  });

  it("an expired password does not replace them", async () => {
    await UserModel.expirePassword(USER_ID);

    expect(prisma.users.update.mock.calls[0][0].data).toEqual({ mustChangePassword: true });
    expect(prisma.users.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, ...notAdminHeld },
      data: { status: "blocked" },
    });
  });
});

describe("UserModel.canHoldSession", () => {
  it("only accepts active, non-deleted users", async () => {
    prisma.users.findFirst.mockResolvedValue(null);

    await expect(UserModel.canHoldSession(USER_ID)).resolves.toBe(false);
    expect(prisma.users.findFirst).toHaveBeenCalledWith({
      where: { id: USER_ID, status: "active", deletedAt: null },
      select: { id: true },
    });

    prisma.users.findFirst.mockResolvedValue({ id: USER_ID });
    await expect(UserModel.canHoldSession(USER_ID)).resolves.toBe(true);
  });
});
