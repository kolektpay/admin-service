import prisma from "../config/database";
import bcrypt from "bcrypt";

export const saltRounds: number = Number(process.env.SALT_ROUNDS) || 17;

async function ensureKolektSuperAdmin() {
  const existingAdmin = await prisma.users.findFirst({
    where: {
      userHasRoles: {
        some: {
          role: {
            name: "Kolekt-super-admin",
          },
          businessId: null,
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (existingAdmin) {
    console.log("✅ Kolekt super admin already exists!");
    return;
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { name: "Kolekt-super-admin" },
    select: { id: true },
  });

  if (!superAdminRole) {
    console.log("❌ Kolekt-super-admin role not found — seed roles first.");
    return;
  }

  const passwordHash = await bcrypt.hash("Password123", saltRounds);

  await prisma.users.create({
    data: {
      email: "unachukwuuche49@gmail.com",
      firstName: "Uchechukwu",
      lastName: "Unachukwu",
      password: passwordHash,
      status: "active",
      userHasRoles: {
        create: {
          roleId: superAdminRole.id,
          businessId: null,
        },
      },
    },
  });

  console.log("✅ Kolekt super admin created!");
}

export async function userSeeder() {
  try {
    const userCount = await prisma.users.count();

    if (userCount > 0) {
      const isAdminPresent = await prisma.users.findUnique({
        where: {
          email: "unachukwuuche49@gmail.com",
        },
      });

      if (!isAdminPresent) {
        await ensureKolektSuperAdmin();
        return;
      }

      console.log("Users already seeded!");
      return;
    }

    const passwordHash = await bcrypt.hash("Password123", saltRounds);

    await prisma.users.createMany({
      data: [
        {
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          password: passwordHash,
          status: "active",
        },
        {
          email: "bob@example.com",
          firstName: "Bob",
          lastName: "Johnson",
          password: passwordHash,
          status: "active",
        },
        {
          email: "unachukwu.samuel@gmail.com",
          firstName: "Samuel",
          lastName: "Unachukwu",
          password: passwordHash,
          status: "active",
        },
      ],
    });
    console.log("✅ Dummy users seeded!");
  } catch (error) {
    console.log(`❌ Error seeding users: ${error}`);
  }
}