import prisma from "../config/database";

export class isStudentWalletCreated {
  static async changeStudentWalletCreationBooleanToTrue(
    studentId: bigint,
  ): Promise<void> {
    await prisma.students.update({
      where: { id: studentId },
      data: {
        isWalletCreated: true,
      },
    });
  }
}
