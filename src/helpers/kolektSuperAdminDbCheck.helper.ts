import prisma from "../config/database";

export async function isKolektSuperAdmin(email: string): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { email },
    select: {
      userHasRoles: {
        where: {
          role: {
            name: "Kolekt-super-admin",
          },
        },
        select: { id: true },
      },
    },
  });

  if (!user) {
    return false;
  }

  return user.userHasRoles.length > 0;
}