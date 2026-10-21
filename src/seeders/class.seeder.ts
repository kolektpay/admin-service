import prisma from "../config/database";

const DEFAULT_CLASSES = [
  { name: "Creche", description: "Early childhood care for toddlers" },
  { name: "Nursery 1", description: "First year of nursery education" },
  { name: "Nursery 2", description: "Second year of nursery education" },
  { name: "Primary 1", description: "First year of primary education" },
  { name: "Primary 2", description: "Second year of primary education" },
  { name: "Primary 3", description: "Third year of primary education" },
  { name: "Primary 4", description: "Fourth year of primary education" },
  { name: "Primary 5", description: "Fifth year of primary education" },
  { name: "Primary 6", description: "Sixth and final year of primary education" },
  { name: "JSS 1", description: "Junior Secondary School year 1" },
  { name: "JSS 2", description: "Junior Secondary School year 2" },
  { name: "JSS 3", description: "Junior Secondary School year 3 (BECE year)" },
  { name: "SS 1", description: "Senior Secondary School year 1" },
  { name: "SS 2", description: "Senior Secondary School year 2" },
  { name: "SS 3", description: "Senior Secondary School year 3 (WAEC/SSCE year)" },
];

/**
 * Gives every business that has no classes yet the default classes. No
 * subclasses are created: schools add them only where they need them.
 * Businesses that already have classes are left alone, so re-runs never
 * touch classes that schools have set up themselves.
 */
export async function classSeeder() {
  try {
    const businesses = await prisma.businesses.findMany({
      where: { classes: { none: {} } },
      select: { id: true },
    });

    for (const { id: businessId } of businesses) {
      await prisma.classes.createMany({
        data: DEFAULT_CLASSES.map((data) => ({ ...data, businessId })),
        skipDuplicates: true,
      });
    }

    console.log(`✅ Default classes seeded for ${businesses.length} business(es)!`);
  } catch (error) {
    console.log(`❌ Error seeding classes: ${error}`);
  }
}
