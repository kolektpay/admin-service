import prisma from "../config/database";

export async function subclassSeeder() {
  try {
    // delete existing subclasses first
    await prisma.subclasses.deleteMany({});
    console.log("🗑️ Existing subclasses deleted!");

    await prisma.subclasses.createMany({
      data: [
        // Creche (classId: 1)
        { name: "A", classId: 1n },
        { name: "B", classId: 1n },
        { name: "C", classId: 1n },

        // Nursery 1 (classId: 2)
        { name: "A", classId: 2n },
        { name: "B", classId: 2n },
        { name: "C", classId: 2n },

        // Nursery 2 (classId: 3)
        { name: "A", classId: 3n },
        { name: "B", classId: 3n },
        { name: "C", classId: 3n },

        // Primary 1 (classId: 4)
        { name: "A", classId: 4n },
        { name: "B", classId: 4n },
        { name: "C", classId: 4n },

        // Primary 2 (classId: 5)
        { name: "A", classId: 5n },
        { name: "B", classId: 5n },
        { name: "C", classId: 5n },

        // Primary 3 (classId: 6)
        { name: "A", classId: 6n },
        { name: "B", classId: 6n },
        { name: "C", classId: 6n },

        // Primary 4 (classId: 7)
        { name: "A", classId: 7n },
        { name: "B", classId: 7n },
        { name: "C", classId: 7n },

        // Primary 5 (classId: 8)
        { name: "A", classId: 8n },
        { name: "B", classId: 8n },
        { name: "C", classId: 8n },

        // Primary 6 (classId: 9)
        { name: "A", classId: 9n },
        { name: "B", classId: 9n },
        { name: "C", classId: 9n },

        // JSS 1 (classId: 10)
        { name: "A", classId: 10n },
        { name: "B", classId: 10n },
        { name: "C", classId: 10n },

        // JSS 2 (classId: 11)
        { name: "A", classId: 11n },
        { name: "B", classId: 11n },
        { name: "C", classId: 11n },

        // JSS 3 (classId: 12)
        { name: "A", classId: 12n },
        { name: "B", classId: 12n },
        { name: "C", classId: 12n },

        // SS 1 (classId: 13)
        { name: "A", classId: 13n },
        { name: "B", classId: 13n },
        { name: "C", classId: 13n },

        // SS 2 (classId: 14)
        { name: "A", classId: 14n },
        { name: "B", classId: 14n },
        { name: "C", classId: 14n },

        // SS 3 (classId: 15)
        { name: "A", classId: 15n },
        { name: "B", classId: 15n },
        { name: "C", classId: 15n },
      ],
      skipDuplicates: true,
    });

    console.log("✅ Subclasses seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding subclasses:", error);
  }
}