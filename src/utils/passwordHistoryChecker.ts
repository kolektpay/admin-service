import bcrypt from "bcrypt";

import prisma from "../config/database";

export async function passwordHistoryChecker(
  userId: string | bigint,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch previous passwords

  if (typeof userId === "string") {
    const previousPasswords = await prisma.passwordHistory.findMany({
      where: { userId },
      select: { password: true },
    });

    // 2. Check if the new password was used before
    for (const entry of previousPasswords) {
      const match = await bcrypt.compare(newPassword, entry.password);
      if (match) {
        return { success: true };
      }
    }

    return { success: false };
  } else {
     const previousPasswords = await prisma.passwordHistory.findMany({
      where: { studentId: userId },
      select: { password: true },
    });

    // 2. Check if the new password was used before
    for (const entry of previousPasswords) {
      const match = await bcrypt.compare(newPassword, entry.password);
      if (match) {
        return { success: true };
      }
    }

    return { success: false };
  }
}
