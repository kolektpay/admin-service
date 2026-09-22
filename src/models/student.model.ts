import prisma from "../config/database";
import { getCurrentTimestamp } from "../helpers/date.helper";
import ApiError from "../utils/apiError";

export class StudentModel {
  /**
   * Increment failed login count and optionally block user
   */
  static async incrementFailedLoginCountForStudent(
    studentId: bigint,
    currentCount: number,
    maxAttempts: number = 3,
  ): Promise<number> {
    const shouldBlock = currentCount + 1 >= maxAttempts;
    const response = await prisma.students.update({
      where: { id: studentId },
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
  static async resetFailedLoginCountForStudent(
    studentId: bigint,
  ): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        lastLoggedInAt: getCurrentTimestamp(),
        failedLoginCount: 0,
      },
    });
  }

  /**
   * Block user account
   */
  static async blockStudentAccount(
    studentId: bigint,
    reason: string,
  ): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        status: "blocked",
        blockReason: reason, // reason for blocking needs to be provided
      },
    });
  }

  /**
   * Mark password as expired and block account
   */
  static async expirePasswordForStudent(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
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

  static async changeUserStatusToPending(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        status: "pending",
      },
    });
  }

  static async changeStudentStatusToActive(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        status: "active",
      },
    });
  }

  /**
   * Mark password as expired and block account
   */
  static async expirePassword(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        mustChangePassword: true,
        status: "blocked",
      },
    });
  }

  static async updatePasswordAndResetMustChangeToFalseForStudent(
    studentId: bigint,
    hashedPassword: string,
  ): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
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

  static async unblockStudentAccount(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        status: "active",
        blockReason: null,
      },
    });
  }

  static async deleteStudentAccount(studentId: bigint): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        deletedAt: getCurrentTimestamp(),
      },
    });
  }

  static async getBusinessIdBystudentId(studentId: bigint): Promise<number> {
    try {
      const studentInfo = await prisma.students.findFirst({
        where: { id: studentId },
        select: {
          businessId: true,
        },
      });

      if (!studentInfo) {
        throw new ApiError(404, "No business found for this student");
      }

      return Number(studentInfo.businessId);
    } catch (error) {
      throw new ApiError(500, "Failed to get businesone id");
    }
  }

  static async mustChangePasswordSetToTrueToForcePasswordChangeForStudent(
    studentId: bigint,
  ): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        mustChangePassword: true,
      },
    });
  }

  static async getStudentByStudentId(studentId: bigint) {
    try {
      const student = await prisma.students.findUnique({
        where: {
          id: studentId,
        },
      });

      if (!student) {
        throw new ApiError(404, "Student not found");
      }

      return student;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, "Failed to get student");
    }
  }
}
