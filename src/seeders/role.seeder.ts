import prisma from "../config/database";
import { ROLES } from "../utils/globalRoles";

console.log(ROLES);
export const roleSeeder = async () => {
  await prisma.role.deleteMany();
  try {
    const roleCount = await prisma.role.count();

    if (roleCount > 0) {
      console.log("Roles already seeded!");
      return;
    }

    // Delete all existing roles (optional for testing)
    await prisma.role.deleteMany();

    // Insert roles
    await prisma.role.createMany({
      data: ROLES.map((role) => ({
        name: role,
      })),
    });

    console.log("✅ Roles seeded successfully!");
  } catch (error) {
    console.log(`❌ Error seeding roles: ${error}`);
  }
};
