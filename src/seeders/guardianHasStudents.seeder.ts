// prisma/seed-guardian-has-students.ts
//
// Seeds the GuardianHasStudents junction table by linking each existing
// guardian to a random set of students from the SAME business (school).
// Assumes Guardians and Students are already seeded with dummy data.

import prisma from "../config/database";

// Controls how many students get linked to each guardian.
// A random number in this range is picked per guardian, then capped
// at however many students actually exist for that guardian's business.
const MIN_STUDENTS_PER_GUARDIAN = 1;
const MAX_STUDENTS_PER_GUARDIAN = 3;

// Simple inclusive random integer helper — used to decide how many
// students a given guardian will be linked to.
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Shuffles the input array and returns the first `count` items.
// Used to pick a random, non-repeating subset of students for a guardian.
function pickRandomUnique<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function seedGuardianHasStudents() {
  // Pull every guardian, but only the fields we actually need:
  // id (to link) and businessId (to scope which students are eligible).
  const guardians = await prisma.guardians.findMany({
    select: { id: true, businessId: true },
  });

  // Nothing to do if Guardians hasn't been seeded yet.
  if (guardians.length === 0) {
    console.log("No guardians found — seed Guardians first.");
    return;
  }

  // Track progress so we can print a summary at the end.
  let totalLinksCreated = 0;
  let skippedGuardians = 0;

  // Process one guardian at a time so each guardian only gets matched
  // against students from their own business.
  for (const guardian of guardians) {
    // Guardians without a businessId can't be safely matched to any
    // student's business — skip rather than guessing.
    if (!guardian.businessId) {
      console.log(`Guardian ${guardian.id} has no businessId — skipping.`);
      skippedGuardians++;
      continue;
    }

    // Fetch only students belonging to this guardian's business.
    // This is the key safeguard that keeps the seed data from creating
    // cross-business guardian-student links (which the schema itself
    // doesn't prevent).
    const studentsInSameBusiness = await prisma.students.findMany({
      where: { businessId: guardian.businessId },
      select: { id: true },
    });

    // If this business has no students yet, there's nothing to link
    // this guardian to.
    if (studentsInSameBusiness.length === 0) {
      console.log(
        `No students found for guardian ${guardian.id} (business ${guardian.businessId}) — skipping.`,
      );
      skippedGuardians++;
      continue;
    }

    // Find students this guardian is ALREADY linked to, so we don't try
    // to re-create those rows. We do this explicitly instead of relying
    // on upsert() — with the pg driver adapter, upsert's existence check
    // can miss an existing composite-unique row and fall through to a
    // raw insert, which then throws P2002 instead of updating.
    const existingLinks = await prisma.guardianHasStudents.findMany({
      where: { guardianId: guardian.id },
      select: { studentId: true },
    });
    const alreadyLinkedIds = new Set(existingLinks.map((link) => link.studentId));

    // Remove students that are already linked to this guardian from the
    // candidate pool, so we only pick genuinely new ones.
    const eligibleStudents = studentsInSameBusiness.filter(
      (student) => !alreadyLinkedIds.has(student.id),
    );

    if (eligibleStudents.length === 0) {
      console.log(
        `Guardian ${guardian.id} already has links to all available students — skipping.`,
      );
      skippedGuardians++;
      continue;
    }

    // Decide how many NEW students to assign to this guardian, capped at
    // however many eligible (not-yet-linked) students actually exist.
    const numToAssign = Math.min(
      randomInt(MIN_STUDENTS_PER_GUARDIAN, MAX_STUDENTS_PER_GUARDIAN),
      eligibleStudents.length,
    );

    // Randomly select that many distinct students for this guardian.
    const chosenStudents = pickRandomUnique(eligibleStudents, numToAssign);

    // Bulk-insert all the new links for this guardian in one query.
    // skipDuplicates makes Postgres silently ignore any row that somehow
    // still collides with the unique constraint (e.g. a concurrent seed
    // run), instead of throwing — so this stays safe to re-run.
    const result = await prisma.guardianHasStudents.createMany({
      data: chosenStudents.map((student) => ({
        studentId: student.id,
        guardianId: guardian.id,
      })),
      skipDuplicates: true,
    });

    totalLinksCreated += result.count;
  }

  // Print a final summary of what the seed run did.
  console.log(`Seeded ${totalLinksCreated} guardian-student links.`);
  if (skippedGuardians > 0) {
    console.log(`Skipped ${skippedGuardians} guardians (no business or no matching students).`);
  }
}