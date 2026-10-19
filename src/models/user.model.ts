import { Prisma, UserStatus } from "@prisma/client";

import prisma from "../config/database";
import {
  getCurrentTimestamp,
  getTimestampMinutesFromNow,
} from "../helpers/date.helper";

/**
 * Administrator fields that are safe to return. Password hashes, TOTP
 * secrets, OTP data and tokens are deliberately excluded. Roles are
 * limited to the given business, in the order they were assigned.
 */
export const adminPublicSelect = (businessId: bigint) =>
  ({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phoneNumber: true,
    status: true,
    blockReason: true,
    leaveReason: true,
    expectedReturnDate: true,
    mustChangePassword: true,
    totpEnabled: true,
    failedLoginCount: true,
    lastLoggedInAt: true,
    passwordExpiresAt: true,
    createdAt: true,
    updatedAt: true,
    userHasRoles: {
      where: { businessId, roleId: { not: null } },
      select: { role: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    },
  }) satisfies Prisma.UsersSelect;

type AdminRow = Prisma.UsersGetPayload<{
  select: ReturnType<typeof adminPublicSelect>;
}>;

type AdminRole = { id: bigint; name: string };

export type AdminPublicRecord = Omit<AdminRow, "userHasRoles"> & {
  roles: AdminRole[];
  /** The first of roles, kept for clients of the single-role response shape */
  role: AdminRole | null;
};

export const toAdminRecord = ({
  userHasRoles,
  ...admin
}: AdminRow): AdminPublicRecord => {
  const roles = userHasRoles.flatMap(({ role }) => (role ? [role] : []));
  return { ...admin, roles, role: roles[0] ?? null };
};

/**
 * Statuses only an administrator can lift (by reactivating the account).
 * Self-service flows (password reset, 2FA setup) and automatic blocking
 * must not overwrite them: an automatic "blocked" can be cleared by a
 * password reset, which would let the user back in.
 */
export const ADMIN_HELD_STATUSES: UserStatus[] = ["on_leave", "blocked_by_admin"];

const notAdminHeld = {
  status: { notIn: ADMIN_HELD_STATUSES },
} satisfies Prisma.UsersWhereInput;

export class UserModel {
  /**
   * Increment failed login count and optionally block user
   */
  static async incrementFailedLoginCount(
    userId: string,
    currentCount: number,
    maxAttempts: number = 3,
  ): Promise<number> {
    const shouldBlock = currentCount + 1 >= maxAttempts;
    const response = await prisma.users.update({
      where: { id: userId },
      data: {
        failedLoginCount: currentCount + 1,
      },
      select: {
        failedLoginCount: true,
      },
    });

    if (shouldBlock) {
      await prisma.users.updateMany({
        where: { id: userId, ...notAdminHeld },
        data: { status: "blocked" },
      });
    }

    return response.failedLoginCount;
  }

  /**
   * Reset failed login count on successful login
   */
  static async resetFailedLoginCount(userId: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        lastLoggedInAt: getCurrentTimestamp(),
        failedLoginCount: 0,
      },
    });
  }

  /**
   * Block user account automatically (failed logins). Leaves an admin
   * block or leave, and its reason, in place.
   */
  static async blockAccount(userId: string, reason: string): Promise<void> {
    await prisma.users.updateMany({
      where: { id: userId, ...notAdminHeld },
      data: {
        status: "blocked",
        blockReason: reason, // reason for blocking needs to be provided
      },
    });
  }

  /**
   * Mark password as expired and block account
   */
  static async expirePassword(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: { mustChangePassword: true },
      }),
      prisma.users.updateMany({
        where: { id: userId, ...notAdminHeld },
        data: { status: "blocked" },
      }),
    ]);
  }

  static async saveTempTotpSecret(
    userId: string,
    secret: string,
    expiryMinutes: number,
  ): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        totpTempSecret: secret,
        totpTempExpiresAt: getTimestampMinutesFromNow(expiryMinutes),
      },
    });
  }

  static async enableTotpForUser(
    userId: string,
    userSecret: string,
  ): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        totpSecret: userSecret, // assign temp secret to permanent field
        totpEnabled: true,
        totpTempSecret: null,
        totpTempExpiresAt: null,
      },
    });
  }

  static async toggleTotpEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        totpEnabled: enabled,
      },
    });
  }

  static async changeUserStatusToPending(userId: string): Promise<void> {
    await prisma.users.updateMany({
      where: { id: userId, ...notAdminHeld },
      data: {
        status: "pending",
      },
    });
  }

  static async changeUserStatusToActive(userId: string): Promise<void> {
    await prisma.users.updateMany({
      where: { id: userId, ...notAdminHeld },
      data: {
        status: "active",
      },
    });
  }

  /** The password always changes; an admin block or leave stays in place. */
  static async updatePasswordAndResetMustChangeToFalse(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.users.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          createdAt: getCurrentTimestamp(),
          failedLoginCount: 0,
        },
      }),
      prisma.users.updateMany({
        where: { id: userId, ...notAdminHeld },
        data: { status: "active" },
      }),
    ]);
  }

  /** Only active, non-deleted users may hold a session. */
  static async canHoldSession(userId: string): Promise<boolean> {
    const user = await prisma.users.findFirst({
      where: { id: userId, status: "active", deletedAt: null },
      select: { id: true },
    });
    return user !== null;
  }

  static async mustChangePasswordSetToTrueToForcePasswordChange(
    userId: string,
  ): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        mustChangePassword: true,
      },
    });
  }

  static async getNameFromUserId(userId: string): Promise<string | null> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      return null;
    }

    return `${user.firstName} ${user.lastName}`;
  }
}
