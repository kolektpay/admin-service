import prisma from "../config/database";
import {
  getCurrentTimestamp,
  getTimestampMinutesFromNow,
} from "../helpers/date.helper";
import { onBoardTrackerType } from "@prisma/client";

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
        ...(shouldBlock && { status: "blocked" }),
      },
      select: {
        failedLoginCount: true,
      },
    });

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
   * Block user account
   */
  static async blockAccount(userId: string, reason: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
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
    await prisma.users.update({
      where: { id: userId },
      data: {
        mustChangePassword: true,
        status: "blocked",
      },
    });
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
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: "pending",
      },
    });
  }

  static async changeUserStatusToActive(userId: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: "active",
      },
    });
  }

  static async updatePasswordAndResetMustChangeToFalse(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        createdAt: getCurrentTimestamp(),
        status: "active",
        failedLoginCount: 0,
      },
    });
  }

  static async setOnboardStep(
    userId: string,
    stepper: onBoardTrackerType,
  ): Promise<void> {
    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          onBoardTracker: stepper,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  static async unblockAccount(userId: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        status: "active",
        blockReason: null,
      },
    });
  }

  static async deleteUserAccount(userId: string): Promise<void> {
    await prisma.users.update({
      where: { id: userId },
      data: {
        deletedAt: getCurrentTimestamp(),
      },
    });
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
