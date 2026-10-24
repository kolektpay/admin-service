import { Prisma, StudentStatus } from "@prisma/client";

import prisma from "../config/database";
import { isPrismaErrorCode } from "../helpers/prismaError.helper";
import { AdminActor } from "../interfaces/admin.interfaces";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import { studentPublicSelect } from "../models/student.model";
import {
  AssignStudentInput,
  BulkAssignStudentsInput,
  BulkTransferStudentsInput,
  ListSubclassStudentsQuery,
} from "../validations/classManagement.schema";
import { ownSubclassWhere, paginate, subclassNotFoundError } from "./class.service";

// A student's class assignment is the single subclassId column on students,
// so a student can never be in more than one subclass; null means unassigned.
// Single-student writes are conditional on the subclass the student was read
// in, so two concurrent assignments cannot silently overwrite each other.

const assignmentSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  registrationNumber: true,
  status: true,
  subclass: {
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true, category: true } },
    },
  },
  updatedAt: true,
} satisfies Prisma.StudentsSelect;

type AssignmentRow = Prisma.StudentsGetPayload<{ select: typeof assignmentSelect }>;

const toAssignmentRecord = ({ subclass, ...student }: AssignmentRow) => {
  if (!subclass) return { student, class: null, subclass: null };
  const { class: parent, ...rest } = subclass;
  return { student, class: parent, subclass: rest };
};

export type AssignmentRecord = ReturnType<typeof toAssignmentRecord>;

const subclassSummarySelect = {
  id: true,
  name: true,
  class: { select: { id: true, name: true } },
} satisfies Prisma.SubclassesSelect;

const activeStudentWhere = (businessId: bigint) =>
  ({ businessId, deletedAt: null }) satisfies Prisma.StudentsWhereInput;

const studentNotFoundError = () =>
  new AppError("Student not found", 404, "STUDENT_NOT_FOUND");

const assignmentConflictError = () =>
  new AppError(
    "The student's assignment was changed by another request. Reload and try again.",
    409,
    "ASSIGNMENT_CONFLICT",
  );

// Students who have left the school stay in their last subclass as a record
const NON_TRANSFERABLE_STATUSES: StudentStatus[] = ["graduated", "withdrawn"];

const findOwnSubclassSummary = (subclassId: bigint, businessId: bigint) =>
  prisma.subclasses.findFirst({
    where: ownSubclassWhere(subclassId, businessId),
    select: subclassSummarySelect,
  });

// ==========================================
// Reading assignments
// ==========================================

/** The student's current class and subclass. */
export const getStudentAssignment = async (
  studentId: bigint,
  businessId: bigint,
): Promise<AssignmentRecord> => {
  const student = await prisma.students.findFirst({
    where: { id: studentId, ...activeStudentWhere(businessId) },
    select: assignmentSelect,
  });
  if (!student) throw studentNotFoundError();
  return toAssignmentRecord(student);
};

/** The active students currently assigned to a subclass. */
export const listSubclassStudents = async (
  subclassId: bigint,
  businessId: bigint,
  query: ListSubclassStudentsQuery,
) => {
  const subclass = await findOwnSubclassSummary(subclassId, businessId);
  if (!subclass) throw subclassNotFoundError();

  const { page, limit, search, status } = query;
  const where: Prisma.StudentsWhereInput = {
    ...activeStudentWhere(businessId),
    subclassId,
    ...(status && { status }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { registrationNumber: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.students.findMany({
      where,
      select: studentPublicSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.students.count({ where }),
  ]);

  return { subclass, students, pagination: paginate(page, limit, total) };
};

// ==========================================
// Assigning one student
// ==========================================

/**
 * Assign a student to a subclass, transferring them out of their current one.
 * Fails with ASSIGNMENT_CONFLICT if another request moved the student first.
 */
export const assignStudentToSubclass = async (
  studentId: bigint,
  input: AssignStudentInput,
  actor: AdminActor,
): Promise<AssignmentRecord> => {
  const [student, target] = await Promise.all([
    prisma.students.findFirst({
      where: { id: studentId, ...activeStudentWhere(actor.businessId) },
      select: { id: true, subclassId: true },
    }),
    findOwnSubclassSummary(input.subclassId, actor.businessId),
  ]);
  if (!student) throw studentNotFoundError();
  if (!target) throw subclassNotFoundError("subclassId");

  if (student.subclassId === input.subclassId) {
    throw new AppError(
      "The student is already assigned to this subclass",
      409,
      "STUDENT_ALREADY_ASSIGNED",
      [{ field: "subclassId", message: "The student is already assigned to this subclass" }],
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.students.updateMany({
        where: {
          id: studentId,
          ...activeStudentWhere(actor.businessId),
          subclassId: student.subclassId,
        },
        data: { subclassId: input.subclassId },
      });
      if (count === 0) throw assignmentConflictError();

      const from = student.subclassId === null ? "unassigned" : `subclass ${student.subclassId}`;
      await AuditModel.logClassChange(
        actor,
        `student_subclass_assigned: student ${studentId} from ${from} to ${input.subclassId}`,
        tx,
      );

      const updated = await tx.students.findUniqueOrThrow({
        where: { id: studentId },
        select: assignmentSelect,
      });
      return toAssignmentRecord(updated);
    });
  } catch (error) {
    // The subclass was deleted between the check and the write
    if (isPrismaErrorCode(error, "P2003")) throw subclassNotFoundError("subclassId");
    throw error;
  }
};

/**
 * Remove a student from their subclass, leaving them unassigned.
 * Fails with ASSIGNMENT_CONFLICT if another request moved the student first.
 */
export const unassignStudent = async (
  studentId: bigint,
  actor: AdminActor,
): Promise<AssignmentRecord> => {
  const student = await prisma.students.findFirst({
    where: { id: studentId, ...activeStudentWhere(actor.businessId) },
    select: { id: true, subclassId: true },
  });
  if (!student) throw studentNotFoundError();
  if (student.subclassId === null) {
    throw new AppError(
      "The student is not assigned to a subclass",
      409,
      "STUDENT_NOT_ASSIGNED",
    );
  }

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.students.updateMany({
      where: {
        id: studentId,
        ...activeStudentWhere(actor.businessId),
        subclassId: student.subclassId,
      },
      data: { subclassId: null },
    });
    if (count === 0) throw assignmentConflictError();

    await AuditModel.logClassChange(
      actor,
      `student_subclass_unassigned: student ${studentId} from subclass ${student.subclassId}`,
      tx,
    );

    const updated = await tx.students.findUniqueOrThrow({
      where: { id: studentId },
      select: assignmentSelect,
    });
    return toAssignmentRecord(updated);
  });
};

// ==========================================
// Bulk assignment
// ==========================================

type AssignSkipReason =
  | "not_found"
  | "already_in_subclass"
  | "ineligible_status"
  | "changed_concurrently";

/**
 * Assign a selection of students to one subclass, whatever subclass each is
 * in now (or none), as the "Assign Students" action does. Graduated and
 * withdrawn students are skipped. The write is one UPDATE, so it is
 * all-or-nothing; a student moved by another request in the meantime is
 * still assigned, since the outcome is the same subclass either way.
 */
export const bulkAssignStudents = async (input: BulkAssignStudentsInput, actor: AdminActor) => {
  const { subclassId, studentIds } = input;

  const destination = await findOwnSubclassSummary(subclassId, actor.businessId);
  if (!destination) throw subclassNotFoundError("subclassId");

  const found = await prisma.students.findMany({
    where: { id: { in: studentIds }, ...activeStudentWhere(actor.businessId) },
    select: { id: true, subclassId: true, status: true },
  });
  const byId = new Map(found.map((s) => [s.id, s]));

  const skipped: { studentId: bigint; reason: AssignSkipReason }[] = [];
  const eligibleIds: bigint[] = [];
  for (const id of studentIds) {
    const student = byId.get(id);
    if (!student) skipped.push({ studentId: id, reason: "not_found" });
    else if (student.subclassId === subclassId) {
      skipped.push({ studentId: id, reason: "already_in_subclass" });
    } else if (NON_TRANSFERABLE_STATUSES.includes(student.status)) {
      skipped.push({ studentId: id, reason: "ineligible_status" });
    } else eligibleIds.push(id);
  }

  const assigned =
    eligibleIds.length === 0
      ? []
      : await prisma
          .$transaction(async (tx) => {
            const rows = await tx.students.updateManyAndReturn({
              where: {
                ...activeStudentWhere(actor.businessId),
                id: { in: eligibleIds },
                status: { notIn: NON_TRANSFERABLE_STATUSES },
                // `not` alone would skip unassigned students, since NULL <> x is not true
                OR: [{ subclassId: null }, { subclassId: { not: subclassId } }],
              },
              data: { subclassId },
              select: { id: true },
            });
            await AuditModel.logClassChange(
              actor,
              `students_assigned: ${rows.length} to subclass ${subclassId}`,
              tx,
            );
            return rows;
          })
          .catch((error) => {
            if (isPrismaErrorCode(error, "P2003")) throw subclassNotFoundError("subclassId");
            throw error;
          });

  // Eligible students who were removed, left, or joined the subclass between the read and the update
  const assignedIds = new Set(assigned.map(({ id }) => id));
  eligibleIds
    .filter((id) => !assignedIds.has(id))
    .forEach((id) => skipped.push({ studentId: id, reason: "changed_concurrently" }));

  return {
    destination,
    assignedCount: assigned.length,
    assignedStudentIds: assigned.map(({ id }) => id),
    skippedCount: skipped.length,
    skipped,
  };
};

// ==========================================
// Bulk transfer
// ==========================================

type SkipReason = "not_found" | "not_in_source_subclass" | "ineligible_status";

/**
 * Move students from one subclass to another, e.g. JSS 1A → JSS 2A at the
 * end of a session. Without studentIds, every student in the source moves
 * except graduated or withdrawn ones, which are reported as skipped. The move is one conditional UPDATE, so it is all-or-nothing and a
 * student who left the source in the meantime is skipped, not moved twice.
 */
export const bulkTransferStudents = async (
  input: BulkTransferStudentsInput,
  actor: AdminActor,
) => {
  const { sourceSubclassId, destinationSubclassId, studentIds } = input;

  const [source, destination] = await Promise.all([
    findOwnSubclassSummary(sourceSubclassId, actor.businessId),
    findOwnSubclassSummary(destinationSubclassId, actor.businessId),
  ]);
  if (!source) throw subclassNotFoundError("sourceSubclassId");
  if (!destination) throw subclassNotFoundError("destinationSubclassId");

  const skipped: { studentId: bigint; reason: SkipReason }[] = [];
  let requestedIds: bigint[] | undefined;

  if (studentIds) {
    const found = await prisma.students.findMany({
      where: { id: { in: studentIds }, ...activeStudentWhere(actor.businessId) },
      select: { id: true, subclassId: true, status: true },
    });
    const byId = new Map(found.map((s) => [s.id, s]));

    requestedIds = [];
    for (const id of studentIds) {
      const student = byId.get(id);
      if (!student) skipped.push({ studentId: id, reason: "not_found" });
      else if (student.subclassId !== sourceSubclassId) {
        skipped.push({ studentId: id, reason: "not_in_source_subclass" });
      } else if (NON_TRANSFERABLE_STATUSES.includes(student.status)) {
        skipped.push({ studentId: id, reason: "ineligible_status" });
      } else requestedIds.push(id);
    }
  } else {
    const ineligible = await prisma.students.findMany({
      where: {
        ...activeStudentWhere(actor.businessId),
        subclassId: sourceSubclassId,
        status: { in: NON_TRANSFERABLE_STATUSES },
      },
      select: { id: true },
    });
    ineligible.forEach(({ id }) => skipped.push({ studentId: id, reason: "ineligible_status" }));
  }

  const moved =
    requestedIds?.length === 0
      ? []
      : await prisma
          .$transaction(async (tx) => {
            const rows = await tx.students.updateManyAndReturn({
              where: {
                ...activeStudentWhere(actor.businessId),
                subclassId: sourceSubclassId,
                status: { notIn: NON_TRANSFERABLE_STATUSES },
                ...(requestedIds && { id: { in: requestedIds } }),
              },
              data: { subclassId: destinationSubclassId },
              select: { id: true },
            });
            await AuditModel.logClassChange(
              actor,
              `students_transferred: ${rows.length} from subclass ${sourceSubclassId} to ${destinationSubclassId}`,
              tx,
            );
            return rows;
          })
          .catch((error) => {
            if (isPrismaErrorCode(error, "P2003")) {
              throw subclassNotFoundError("destinationSubclassId");
            }
            throw error;
          });

  // Requested students who left the source between the read and the update
  if (requestedIds) {
    const movedIds = new Set(moved.map(({ id }) => id));
    requestedIds
      .filter((id) => !movedIds.has(id))
      .forEach((id) => skipped.push({ studentId: id, reason: "not_in_source_subclass" }));
  }

  return {
    source,
    destination,
    movedCount: moved.length,
    movedStudentIds: moved.map(({ id }) => id),
    skippedCount: skipped.length,
    skipped,
  };
};
