import prisma from "../config/database";

export class GuardianHasStudentsModel {
  /**
   * Confirm a guardian is mapped to a given student
   * (a guardian may be mapped to many students — this checks one specific pair)
   */
  static async isGuardianMappedToStudent(
    guardianId: bigint,
    studentId: bigint,
  ): Promise<boolean> {
    const mapping = await prisma.guardianHasStudents.findFirst({
      where: {
        guardianId,
        studentId,
      },
      select: {
        id: true,
      },
    });
    return mapping !== null;
  }
}