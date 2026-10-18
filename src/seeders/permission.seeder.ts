import prisma from "../config/database";
import { PERMISSIONS } from "./data/globalPermission";

const { admin, students, guardians } = PERMISSIONS;

/**
 * Upserts every permission by name. Existing rows keep their IDs, so role
 * and student/guardian assignments are left untouched; only description,
 * type and category are refreshed. Permissions removed from the data file
 * are not deleted.
 */
export const permissionsSeeder = async () => {
  try {
    console.log("🌱 Seeding permissions...");

    const allPermissions = [
      ...admin.menus,
      ...admin.actions,
      ...students.menus,
      ...students.actions,
      ...guardians.menus,
      ...guardians.actions,
    ];

    const existing = new Set(
      (
        await prisma.permissions.findMany({
          where: { name: { in: allPermissions.map(({ name }) => name) } },
          select: { name: true },
        })
      ).map(({ name }) => name),
    );

    await prisma.$transaction(
      async (tx) => {
        for (const { name, description, type, category } of allPermissions) {
          await tx.permissions.upsert({
            where: { name },
            update: { description, type, category },
            create: { name, description, type, category },
          });
        }
      },
      // ~100 round trips; the remote DB exceeds the 5s default
      { timeout: 60_000 },
    );

    const created = allPermissions.filter(({ name }) => !existing.has(name));

    console.log(
      `✅ Permissions seeded: ${allPermissions.length} processed, ${created.length} created, ${allPermissions.length - created.length} updated.`,
    );
    created.forEach(({ name }) => console.log(`   + ${name}`));

    return { processed: allPermissions.length, created: created.map(({ name }) => name) };
  } catch (error) {
    console.error("❌ Error seeding permissions:", error);
    throw error;
  }
};
