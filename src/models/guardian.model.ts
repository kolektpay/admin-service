import prisma from "../config/database";
import { getCurrentTimestamp } from "../helpers/date.helper";
import ApiError from "../utils/apiError";

export class GuardianModel {
  /**
   * Increment failed login count and optionally block user
   */
  static async incrementFailedLoginCountForGuardian(
    guardianId: bigint,
    currentCount: number,
    maxAttempts: number = 3,
  ): Promise<number> {
    const shouldBlock = currentCount + 1 >= maxAttempts;
    const response = await prisma.guardians.update({
      where: { id: guardianId },
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
  static async resetFailedLoginCountForGuardian(
    guardianId: bigint,
  ): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        lastLoggedInAt: getCurrentTimestamp(),
        failedLoginCount: 0,
      },
    });
  }

  /**
   * Block user account
   */
  static async blockGuardianAccount(
    guardianId: bigint,
    reason: string,
  ): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        status: "blocked",
        blockReason: reason, // reason for blocking needs to be provided
      },
    });
  }

  /**
   * Mark password as expired and block account
   */
  static async expirePasswordForGuardian(guardianId: bigint): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        mustChangePassword: true,
        status: "blocked",
      },
    });
  }

  //   static async saveTempTotpSecret(
  //     userId: string,
  //     secret: string,
  //     expiryMinutes: number,
  //   ): Promise<void> {
  //     await prisma.users.update({
  //       where: { id: userId },
  //       data: {
  //         totpTempSecret: secret,
  //         totpTempExpiresAt: getTimestampMinutesFromNow(expiryMinutes),
  //       },
  //     });
  //   }

  //   static async enableTotpForUser(
  //     userId: string,
  //     userSecret: string,
  //   ): Promise<void> {
  //     await prisma.users.update({
  //       where: { id: userId },
  //       data: {
  //         totpSecret: userSecret, // assign temp secret to permanent field
  //         totpEnabled: true,
  //         totpTempSecret: null,
  //         totpTempExpiresAt: null,
  //       },
  //     });
  //   }

  //   static async toggleTotpEnabled(
  //     userId: string,
  //     enabled: boolean,
  //   ): Promise<void> {
  //     await prisma.users.update({
  //       where: { id: userId },
  //       data: {
  //         totpEnabled: enabled,
  //       },
  //     });
  //   }

    static async changeGuardianStatusToPending(guardianId: bigint): Promise<void> {
      await prisma.guardians.update({
        where: { id: guardianId },
        data: {
          status: "pending",
        },
      });
    }

  static async changeGuardianStatusToActive(guardianId: bigint): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        status: "active",
      },
    });
  }

  /**
   * Mark password as expired and block account
   */
  static async expirePassword(guardianId: bigint): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        mustChangePassword: true,
        status: "blocked",
      },
    });
  }

  static async updatePasswordAndResetMustChangeToFalseForGuardian(
    guardianId: bigint,
    hashedPassword: string,
  ): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });
  }

  //   static async setOnboardStep(
  //     userId: string,
  //     stepper: onBoardTrackerType,
  //   ): Promise<void> {
  //     try {
  //       await prisma.users.update({
  //         where: { id: userId },
  //         data: {
  //           onBoardTracker: stepper,
  //         },
  //       });
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   }

  static async unblockGuardianAccount(guardianId: bigint): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        status: "active",
        blockReason: null,
      },
    });
  }

  static async deleteGuardianAccount(guardianId: bigint): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        deletedAt: getCurrentTimestamp(),
      },
    });
  }

  static async getBusinessIdByGuardianId(guardianId: bigint): Promise<number> {
    try {
   
      const guardianInfo = await prisma.guardians.findFirst({
        where: { id: guardianId },
        select: {
          businessId: true,
        },
      });

      if (!guardianInfo) {
        throw new ApiError(404, "No business found for this guardian");
      }

      return Number(guardianInfo.businessId);
    } catch (error) {
      throw new ApiError(500, "Failed to get businesssss id");
    }
  }

  static async mustChangePasswordSetToTrueToForcePasswordChangeForGuardian(
    guardianId: bigint,
  ): Promise<void> {
    await prisma.guardians.update({
      where: { id: guardianId },
      data: {
        mustChangePassword: true,
      },
    });
  }
}
