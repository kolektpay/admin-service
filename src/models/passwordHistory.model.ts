import prisma from "../config/database";

export class PasswordHistoryModel {
  /**
   * Create a new password history record for a user
   */
static async createPasswordHistory(
  userId: string | bigint,
  password: string,
  passwordStatus: string = "password-change",
  accountRole?: "student" | "guardian",
): Promise<void> {
  if (typeof userId === "string") {
    await prisma.passwordHistory.create({
      data: {
        userId,
        password,
        passwordstatus: passwordStatus,
      },
    });
    return;
  }

  let role = accountRole;
  if (!role) {
    const isStudent = await prisma.students.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    role = isStudent ? "student" : "guardian";
  }

  if (role === "student") {
    await prisma.passwordHistory.create({
      data: {
        studentId: userId,
        password,
        passwordstatus: passwordStatus,
      },
    });
  } else {
    await prisma.passwordHistory.create({
      data: {
        guardianId: userId,
        password,
        passwordstatus: passwordStatus,
      },
    });
  }
}

  static async obtainPasswordInfo(userId: string) {
    return await prisma.passwordHistory.findMany({
      where: {
        userId,
      },
      select: { password: true },
    });
  }
}
