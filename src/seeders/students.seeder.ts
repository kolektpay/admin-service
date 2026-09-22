import prisma from "../config/database";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 13;

export async function studentSeeder() {
  try {
    console.log("🌱 Seeding students...");

    const students = [
      {
        businessId: 1n,
        subclassId: 55n,
        password: await bcrypt.hash("Password123!", SALT_ROUNDS),
        mustChangePassword: false,
        isWalletCreated: false,
        age: 7,
        email: "chukwuemeka.nwosu@example.com",
        phoneNumber: "+2348031110060",
        avatar: null,
        gender: "Male",
        dateOfBirth: new Date("2019-03-12"),
        firstName: "Chukwuemeka",
        lastName: "Nwosu",
        middleName: "Tobenna",
        registrationNumber: "REG-4001",
        address: "22 Bode Thomas Street, Surulere, Lagos",
        status: "active" as const,
        failedLoginCount: 0,
      },
      {
        businessId: 1n,
        subclassId: 53n,
        password: await bcrypt.hash("Password123!", SALT_ROUNDS),
        mustChangePassword: false,
        isWalletCreated: false,
        age: 4,
        email: "adaeze.okonkwo@example.com",
        phoneNumber: "+2348031110062",
        avatar: null,
        gender: "Female",
        dateOfBirth: new Date("2022-06-18"),
        firstName: "Adaeze",
        lastName: "Okonkwo",
        middleName: "Chisom",
        registrationNumber: "REG-4002",
        address: "5 Allen Avenue, Ikeja, Lagos",
        status: "active" as const,
        failedLoginCount: 0,
      },
      {
        businessId: 1n,
        subclassId: 76n,
        password: await bcrypt.hash("Password123!", SALT_ROUNDS),
        mustChangePassword: false,
        isWalletCreated: false,
        age: 13,
        email: "oluwaseun.adeleke@example.com",
        phoneNumber: "+2348031110064",
        avatar: null,
        gender: "Male",
        dateOfBirth: new Date("2013-09-05"),
        firstName: "Oluwaseun",
        lastName: "Adeleke",
        middleName: null,
        registrationNumber: "REG-4003",
        address: "11 Broad Street, Lagos Island, Lagos",
        status: "active" as const,
        failedLoginCount: 0,
      },
      {
        businessId: 1n,
        subclassId: 87n,
        password: await bcrypt.hash("Password123!", SALT_ROUNDS),
        mustChangePassword: false,
        isWalletCreated: false,
        age: 16,
        email: "chidinma.okafor@example.com",
        phoneNumber: "+2348031110066",
        avatar: null,
        gender: "Female",
        dateOfBirth: new Date("2010-01-22"),
        firstName: "Chidinma",
        lastName: "Okafor",
        middleName: "Ugochi",
        registrationNumber: "REG-4004",
        address: "3 Kingsway Road, Ikoyi, Lagos",
        status: "active" as const,
        failedLoginCount: 0,
      },
    ];

    for (const student of students) {
      const exists = await prisma.students.findFirst({
        where: { registrationNumber: student.registrationNumber },
      });

      if (exists) {
        console.log(
          `⏭️ Student ${student.firstName} ${student.lastName} already exists, skipping...`,
        );
        continue;
      }

      await prisma.students.create({ data: student });
      console.log(
        `✅ Created student: ${student.firstName} ${student.lastName}`,
      );
    }

    console.log("✅ Students seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding students:", error);
  }
}