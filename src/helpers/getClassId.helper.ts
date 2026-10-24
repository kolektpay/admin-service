import prisma from "../config/database";

/**
 * Looks up a student by their ID and returns the classId of the
 * class their subclass belongs to, or null if they are unassigned.
 *
 * Throws an error if the student does not exist.
 */
export async function getClassIdFromStudentId(
  studentId: bigint,
): Promise<bigint | null> {
  const student = await prisma.students.findUnique({
    where: { id: studentId },
    select: {
      subclass: {
        select: {
          classId: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  return student.subclass?.classId ?? null;
}