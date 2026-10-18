import bcrypt from "bcrypt";

import prisma from "../config/database";

export const saltRounds: number = Number(process.env.SALT_ROUNDS) || 17;

export async function userSeeder() {
  try {
    const userCount = await prisma.users.count();

    if (userCount > 0) {
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