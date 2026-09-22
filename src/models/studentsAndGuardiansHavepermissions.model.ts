import prisma from "../config/database";

export type PermissionHolderRole = "student" | "guardian";

export class StudentsAndGuardiansHavePermissionsModel {
  /**
   * Get all permissions for a client (student or guardian) within a business
   */
  static async getPermissionsForClient(
    clientId: bigint,
    businessId: bigint,
    clientRole: PermissionHolderRole,
  ) {

  
    return prisma.studentsAndGuardiansHavePermissionsTable.findMany({
      where: {
        businessId,
        studentId: clientRole === "student" ? clientId : undefined,
        guardianId: clientRole === "guardian" ? clientId : undefined,
      },
      select: {
        permissionId: true,
        permissions: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Replace all permissions for a student with the given set of permission names
   */
  static async editPermissionsForStudent(
  studentId: bigint,
  businessId: bigint,
  permissionNames: string[],
): Promise<{ id: bigint; name: string }[]> {
  const permissions = await prisma.permissions.findMany({
    where: {
      name: { in: permissionNames },
    },
    select: {
      id: true,
      name: true,
    },
  });



  await prisma.$transaction([
    prisma.studentsAndGuardiansHavePermissionsTable.deleteMany({
      where: { studentId },
    }),

    prisma.studentsAndGuardiansHavePermissionsTable.createMany({
      data: permissions.map((permission) => ({
        studentId,
        businessId,
        permissionId: permission.id,
      })),
    }),
  ]);

  return permissions;
}
}
