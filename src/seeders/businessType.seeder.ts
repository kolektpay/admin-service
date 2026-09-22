import prisma from "../config/database";
import { BUSINESS_TYPES } from "../utils/globalBusinessTypes";

export const businessTypeSeeder = async () => {
  await prisma.businessTypes.deleteMany();
  try {
    const businessTypeTableCount = await prisma.businessTypes.count();

    if (businessTypeTableCount > 0) {
      console.log("Business type table already seeded!");
      return;
    }

    // Delete all existing business types (optional for testing)
    await prisma.businessTypes.deleteMany();

    // Insert business types
    await prisma.businessTypes.createMany({
      data: BUSINESS_TYPES.map((type, index) => ({
        id: index + 1,
        name: type.name,
      })),
    });

    console.log("✅ business types tables seeded successfully!");
  } catch (error) {
    console.log(`❌ Error seeding business types tables: ${error}`);
  }
};
