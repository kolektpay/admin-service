import prisma from "../config/database";
import { PERMISSIONS } from "../utils/globalPermission";

const { admin, students, guardians, kolektSuperAdmin } = PERMISSIONS;

console.log(PERMISSIONS);

export const permissionsSeeder = async () => {
  try {
    console.log("🌱 Seeding permissions...");

    await prisma.studentsAndGuardiansHavePermissionsTable.deleteMany();

await prisma.permissions.deleteMany();

    console.log(
      "admin.menus",
      admin.menus,
      "student.menus",
      students.menus,
      "guardians.menus",
      guardians.menus,
    );

    const insertAdminMenuPermissions = admin.menus.map((admin_menu) =>
      prisma.permissions.create({
        data: {
          name: admin_menu.name,
          description: admin_menu.description,
          type: admin_menu.type,
          category: admin_menu.category,
        },
      }),
    );

    const insertAdminActionsPermissions = admin.actions.map((admin_action) =>
      prisma.permissions.create({
        data: {
          name: admin_action.name,
          description: admin_action.description,
          type: admin_action.type,
          category: admin_action.category,
        },
      }),
    );

    const insertStudentMenuPermissions = students.menus.map((student_menu) =>
      prisma.permissions.create({
        data: {
          name: student_menu.name,
          description: student_menu.description,
          type: student_menu.type,
          category: student_menu.category,
        },
      }),
    );

    const insertStudentActionsPermissions = students.actions.map(
      (student_action) =>
        prisma.permissions.create({
          data: {
            name: student_action.name,
            description: student_action.description,
            type: student_action.type,
            category: student_action.category,
          },
        }),
    );

    const insertGuardianMenuPermissions = guardians.menus.map((guardian_menu) =>
      prisma.permissions.create({
        data: {
          name: guardian_menu.name,
          description: guardian_menu.description,
          type: guardian_menu.type,
          category: guardian_menu.category,
        },
      }),
    );

    const insertGuardianActionsPermissions = guardians.actions.map(
      (guardian_action) =>
        prisma.permissions.create({
          data: {
            name: guardian_action.name,
            description: guardian_action.description,
            type: guardian_action.type,
            category: guardian_action.category,
          },
        }),
    );

    const insertKsaMenuPermissions = kolektSuperAdmin.menus.map((ksa_menu) =>
      prisma.permissions.create({
        data: {
          name: ksa_menu.name,
          description: ksa_menu.description,
          type: ksa_menu.type,
          category: ksa_menu.category,
        },
      }),
    );

    const insertKsaActionsPermissions = kolektSuperAdmin.actions.map((ksa_action) =>
      prisma.permissions.create({
        data: {
          name: ksa_action.name,
          description: ksa_action.description,
          type: ksa_action.type,
          category: ksa_action.category,
        },
      }),
    );
    const adminMenuResult = await Promise.all(insertAdminMenuPermissions);
    const adminActionResult = await Promise.all(insertAdminActionsPermissions);
    const studentMenuResult = await Promise.all(insertStudentMenuPermissions);
    const studentActionResult = await Promise.all(
      insertStudentActionsPermissions,
    );
    const guardianMenuResult = await Promise.all(insertGuardianMenuPermissions);
    const guardianActionResult = await Promise.all(
      insertGuardianActionsPermissions,
    );
    const ksaMenuResult = await Promise.all(insertKsaMenuPermissions);
    const ksaActionResult = await Promise.all(insertKsaActionsPermissions);

    const permissionsLengths =
      adminMenuResult.length +
      adminActionResult.length +
      studentMenuResult.length +
      studentActionResult.length +
      guardianMenuResult.length +
      guardianActionResult.length +
      ksaActionResult.length +
      ksaMenuResult.length;

    const finalResult = {
      adminMenus: adminMenuResult,
      adminActions: adminActionResult,
      studentMenus: studentMenuResult,
      studentActions: studentActionResult,
      guardianMenus: guardianMenuResult,
      guardianActions: guardianActionResult,
    };

    console.log(
      `✅ Permissions seeded successfully! ${permissionsLengths} permissions processed.`,
    );
    return finalResult;
  } catch (error) {
    console.error("❌ Error seeding permissions:", error);
    throw error;
  }
};
