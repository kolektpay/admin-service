import { permissionsSeeder } from "./permission.seeder";
import { rolesHasPermissionSeeder } from "./rolesHasPermission.seeder";
import prisma from "../config/database";
// import { roleSeeder } from "./role.seeder";

// import { classSeeder } from "./class.seeder";
// import { userSeeder } from "./user.seeder";
// import {  businessTypeSeeder  } from "./businessType.seeder";
// import { guardianSeeder } from "./guardians.seeder";
// import { userHasRoleSeeder } from "./userHasRole.seeder";
// import { studentsAndGuardiansHavePermissionsSeeder } from "./studentsAndGuardiansHavePermission.seedeer";
// import { studentSeeder } from "./students.seeder";
// import { seedGuardianHasStudents } from "./guardianHasStudents.seeder";

export const runSeeders = async () => {
  // await userSeeder();
  await permissionsSeeder();
  // await businessTypeSeeder();
  // await guardianSeeder();
  // await classSeeder();
  // await roleSeeder();
  await rolesHasPermissionSeeder();
  // await studentSeeder();
  // await seedGuardianHasStudents();

  // await userHasRoleSeeder();
  //  await studentsAndGuardiansHavePermissionsSeeder();
};

runSeeders()
  .catch((e) => {
    console.error("❌ Seeder failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
