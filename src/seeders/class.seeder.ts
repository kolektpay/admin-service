import prisma from "../config/database";

export async function classSeeder() {
  try {
    const classCount = await prisma.classes.count();

    if (classCount > 0) {
      console.log("class names already seeded!");
      return;
    } else {
      // Delete all existing classes (optional for testing)

      await prisma.classes.deleteMany();

      // Hash a common test password

      // Insert dummy users
      await prisma.classes.createMany({
        data: [
          {
            name: "Creche",
            category: "normal",
            description: "Early childhood care for toddlers",
          },
          {
            name: "Nursery 1",
            category: "normal",
            description: "First year of nursery education",
          },
          {
            name: "Nursery 2",
            category: "normal",
            description: "Second year of nursery education",
          },
          {
            name: "Primary 1",
            category: "normal",
            description: "First year of primary education",
          },
          {
            name: "Primary 2",
            category: "normal",
            description: "Second year of primary education",
          },
          {
            name: "Primary 3",
            category: "normal",
            description: "Third year of primary education",
          },
          {
            name: "Primary 4",
            category: "normal",
            description: "Fourth year of primary education",
          },
          {
            name: "Primary 5",
            category: "normal",
            description: "Fifth year of primary education",
          },
          {
            name: "Primary 6",
            category: "normal",
            description: "Sixth and final year of primary education",
          },
          {
            name: "JSS 1",
            category: "normal",
            description: "Junior Secondary School year 1",
          },
          {
            name: "JSS 2",
            category: "normal",
            description: "Junior Secondary School year 2",
          },
          {
            name: "JSS 3",
            category: "normal",
            description: "Junior Secondary School year 3 (BECE year)",
          },
          {
            name: "SS 1",
            category: "normal",
            description: "Senior Secondary School year 1",
          },
          {
            name: "SS 2",
            category: "normal",
            description: "Senior Secondary School year 2",
          },
          {
            name: "SS 3",
            category: "normal",
            description: "Senior Secondary School year 3 (WAEC/SSCE year)",
          },
        ],
      });
      console.log("✅ Dummy classes seeded!");
    }
  } catch (error) {
    console.log(`❌ Error seeding classes: ${error}`);
  }
}
