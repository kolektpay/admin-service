import prisma from "../config/database";

export const rolesHasPermissionSeeder = async () => {
  try {
    // No "already seeded" guard: skipDuplicates makes re-runs safe and lets
    // newly added permissions reach existing roles.
    const roleIds = await prisma.role.findMany({
      select: { id: true, name: true },
    });

    const permissionIds = await prisma.permissions.findMany({
      select: { id: true, name: true, category: true },
    });

    // All permissions categorized as "admin" — not just student/guardian management
    const adminCategoryPermissions = permissionIds.filter(
      (permission) => permission.category === "admin",
    );

    const data = roleIds.flatMap((role) => {
      const assignedPermissions =
        role.name === "manager"
          ? permissionIds
          : role.name === "admin"
          ? adminCategoryPermissions
          : permissionIds.slice(0, 5);

      return assignedPermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      }));
    });

    await prisma.roleHasPermission.createMany({
      data,
      skipDuplicates: true,
    });

    console.log("✅ roles has permission table seeded successfully!");
  } catch (error) {
    console.log(`❌ Error seeding roles has permission table: ${error}`);
  }
};