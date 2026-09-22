import prisma from "../config/database";

export const studentsAndGuardiansHavePermissionsSeeder = async () => {
  try {
    console.log("🌱 Seeding student and guardian permissions...");

    await prisma.studentsAndGuardiansHavePermissionsTable.deleteMany();

    const studentPermissions = await prisma.permissions.findMany({
      where: {
        category: "student",
      },
    });

    const guardianPermissions = await prisma.permissions.findMany({
      where: {
        category: "guardian",
      },
    });

    const allStudents = await prisma.students.findMany();
    const allGuardians = await prisma.guardians.findMany();

    const studentPermissionRecords = allStudents.flatMap((student) =>
      studentPermissions.map((permission) => ({
        studentId: student.id,
        permissionId: permission.id,
      })),
    );

    const guardianPermissionRecords = allGuardians.flatMap((guardian) =>
      guardianPermissions.map((permission) => ({
        guardianId: guardian.id,
        permissionId: permission.id,
      })),
    );

    const allPermissionRecords = [
      ...studentPermissionRecords,
      ...guardianPermissionRecords,
    ];

    await prisma.studentsAndGuardiansHavePermissionsTable.createMany({
      data: allPermissionRecords,
      skipDuplicates: true,
    });

    console.log(
      `✅ Student and guardian permissions seeded successfully! ${allPermissionRecords.length} records created.`,
    );
  } catch (error) {
    console.error("❌ Error seeding student and guardian permissions:", error);
    throw error;
  }
};