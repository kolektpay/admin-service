import prisma from "../config/database";

export const userHasRoleSeeder = async () => {
  try {
    const userHasRoleCount = await prisma.userHasRole.count();

    if (userHasRoleCount > 0) {
      console.log("User roles already seeded!");
      return;
    }

    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    const usersInfo = await prisma.users.findMany({
      select: {
        id: true,
      },
    });

    await prisma.userHasRole.createMany({
      data: usersInfo.flatMap((userInfo) =>
        roles.slice(0, 1).map((role) => ({
          userId: userInfo.id,
          roleId: role.id,
        })),
      ),
    });

    console.log("✅ User roles seeded successfully!");
  } catch (error) {
    console.log(`❌ Error seeding user roles: ${error}`);
  }
};