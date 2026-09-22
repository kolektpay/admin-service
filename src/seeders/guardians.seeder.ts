import prisma from "../config/database";
import { guardians } from "../utils/guardians";
import bcrypt from "bcrypt";

export const saltRounds: number = Number(process.env.SALT_ROUNDS) || 17;

export const guardianSeeder = async () => {
  await prisma.guardians.deleteMany();

  const passwordHash = await bcrypt.hash("Password123", saltRounds);

  try {
    const insertGuardians = guardians.map((guardian) =>
      prisma.guardians.create({
        data: {
          firstName: guardian.firstName,
           lastName: guardian.lastName,
          phoneNumber: guardian.PhoneNumber,
          email: guardian.email,
          password: passwordHash,
        },
      }),
    );
    const createdGuardians = await Promise.all(insertGuardians);

    console.log(`✅ guardians seeded successfully! ${createdGuardians}`);
  } catch (error) {
    console.log(`❌ Error seeding guardians: ${error}`);
  }
};
