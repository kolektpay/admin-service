import prisma from "../config/database";

export class UserPasswordResetModel {
  /**
   * Create a new password reset token for a user
   * Revokes all existing non-revoked tokens before creating new one
   */
static async createResetToken(
  userId: string | bigint,
  token: string,
  tokenExpiresAt: Date,
): Promise<void> {
  // First, revoke all existing non-revoked tokens for this user

  if (typeof userId === "string") {
    await prisma.userPasswordReset.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    // Then create new token
    await prisma.userPasswordReset.create({
      data: {
        userId,
        token,
        tokenExpiresAt,
        isRevoked: false,
      },
    });
  } else {
    // bigint id could belong to either a student or a guardian —
    // check students first, fall back to guardians (same order as login)
    const isStudent = await prisma.students.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (isStudent) {
      await prisma.userPasswordReset.updateMany({
        where: {
          studentId: userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });

      // Then create new token
      await prisma.userPasswordReset.create({
        data: {
          studentId: userId,
          token,
          tokenExpiresAt,
          isRevoked: false,
        },
      });
    } else {
      await prisma.userPasswordReset.updateMany({
        where: {
          guardianId: userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });

      // Then create new token
      await prisma.userPasswordReset.create({
        data: {
          guardianId: userId,
          token,
          tokenExpiresAt,
          isRevoked: false,
        },
      });
    }
  }
}

  /**
   * find token for comparison
   */
  static async obtainToken(token: string) {
    return await prisma.userPasswordReset.findFirst({
      where: {
        token,
      },
    });
  }
}
