import { Prisma, StudentStatus } from "@prisma/client";
import prisma from "../config/database";
import { getCurrentTimestamp } from "../helpers/date.helper";
import { AuditModel } from "../models/audit.model";
import { AppError, IFieldError } from "../middleware/error.middleware";
import {
  getUniqueViolationField,
  isPrismaErrorCode,
} from "../helpers/prismaError.helper";
import {
  ListStudentsQuery,
  UpdateStudentInput,
} from "../validations/studentManagement.schema";
import { StudentPublicRecord, studentPublicSelect } from "./student.query";

// ==========================================
// Shared helpers
// ==========================================

interface StudentUniqueFields {
  email?: string;
  phoneNumber?: string;
  registrationNumber?: string | null;
}

// Most specific first: "email" also appears inside other column names' metadata
const STUDENT_UNIQUE_FIELD_ALIASES: Record<string, string[]> = {
  registrationNumber: ["registration_number", "registrationNumber"],
  phoneNumber: ["phone_number", "phoneNumber"],
  email: ["email"],
};

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  email: "Email address",
  phoneNumber: "Phone number",
  registrationNumber: "Registration number",
};

/**
 * Find candidate values that already belong to another student.
 * Soft-deleted students are included because they still hold the unique keys.
 * `fieldPath` names the offending field for each candidate in the error details.
 */
export const findStudentUniquenessConflicts = async (
  candidates: StudentUniqueFields[],
  fieldPath: (index: number, field: string) => string,
  excludeStudentId?: bigint,
): Promise<IFieldError[]> => {
  const emails = candidates.flatMap((c) => (c.email ? [c.email] : []));
  const phoneNumbers = candidates.flatMap((c) => (c.phoneNumber ? [c.phoneNumber] : []));
  const registrationNumbers = candidates.flatMap((c) =>
    c.registrationNumber ? [c.registrationNumber] : [],
  );

  const orConditions: Prisma.StudentsWhereInput[] = [
    ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
    ...(phoneNumbers.length ? [{ phoneNumber: { in: phoneNumbers } }] : []),
    ...(registrationNumbers.length
      ? [{ registrationNumber: { in: registrationNumbers } }]
      : []),
  ];
  if (orConditions.length === 0) return [];

  const existing = await prisma.students.findMany({
    where: {
      OR: orConditions,
      ...(excludeStudentId !== undefined && { id: { not: excludeStudentId } }),
    },
    select: { email: true, phoneNumber: true, registrationNumber: true },
  });

  const takenEmails = new Set(existing.map((s) => s.email.toLowerCase()));
  const takenPhoneNumbers = new Set(existing.map((s) => s.phoneNumber));
  const takenRegistrationNumbers = new Set(existing.map((s) => s.registrationNumber));

  return candidates.flatMap((candidate, index) => {
    const errors: IFieldError[] = [];
    if (candidate.email && takenEmails.has(candidate.email)) {
      errors.push(conflictDetail(fieldPath(index, "email"), "email"));
    }
    if (candidate.phoneNumber && takenPhoneNumbers.has(candidate.phoneNumber)) {
      errors.push(conflictDetail(fieldPath(index, "phoneNumber"), "phoneNumber"));
    }
    if (
      candidate.registrationNumber &&
      takenRegistrationNumbers.has(candidate.registrationNumber)
    ) {
      errors.push(
        conflictDetail(fieldPath(index, "registrationNumber"), "registrationNumber"),
      );
    }
    return errors;
  });
};

const conflictDetail = (path: string, field: string): IFieldError => ({
  field: path,
  message: `${UNIQUE_FIELD_LABELS[field]} is already in use`,
});

export const studentConflictError = (details: IFieldError[]): AppError =>
  new AppError(
    "One or more unique student fields are already in use",
    409,
    "DUPLICATE_STUDENT_FIELD",
    details,
  );

/**
 * Translate a database unique-constraint violation (e.g. lost race with a
 * concurrent request) into a 409. Other errors are returned unchanged.
 */
export const mapStudentUniqueViolation = (error: unknown): unknown => {
  if (!isPrismaErrorCode(error, "P2002")) return error;

  const field = getUniqueViolationField(error, STUDENT_UNIQUE_FIELD_ALIASES);
  return studentConflictError([
    field
      ? conflictDetail(field, field)
      : { field: "student", message: "A unique student field is already in use" },
  ]);
};

export const assertSubclassesExist = async (
  subclassIds: bigint[],
  fieldPath: (subclassId: bigint) => string[],
): Promise<void> => {
  const uniqueIds = [...new Set(subclassIds)];
  const found = await prisma.subclasses.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((s) => s.id));
  const details = uniqueIds
    .filter((id) => !foundIds.has(id))
    .flatMap((id) =>
      fieldPath(id).map((field) => ({ field, message: "Subclass does not exist" })),
    );

  if (details.length) {
    throw new AppError("Invalid subclass", 400, "INVALID_SUBCLASS", details);
  }
};

const studentNotFoundError = () =>
  new AppError("Student not found", 404, "STUDENT_NOT_FOUND");

// ==========================================
// Listing
// ==========================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const buildStudentListFilter = (
  businessId: bigint,
  query: ListStudentsQuery,
): Prisma.StudentsWhereInput => {
  const andConditions: Prisma.StudentsWhereInput[] = [];

  // Every word of `name` must match the first, middle or last name
  for (const word of query.name?.split(/\s+/) ?? []) {
    andConditions.push({
      OR: [
        { firstName: { contains: word, mode: "insensitive" } },
        { middleName: { contains: word, mode: "insensitive" } },
        { lastName: { contains: word, mode: "insensitive" } },
      ],
    });
  }

  if (query.search) {
    andConditions.push({
      OR: [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { registrationNumber: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }

  const hasClassFilter = query.class !== undefined || query.classId !== undefined;
  const hasAgeRange = query.minAge !== undefined || query.maxAge !== undefined;
  const hasDateRange = query.startDate !== undefined || query.endDate !== undefined;

  return {
    businessId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.regNo && { registrationNumber: query.regNo }),
    ...(query.subclassId && { subclassId: query.subclassId }),
    ...(hasClassFilter && {
      subclass: {
        classId: query.classId,
        ...(query.class && {
          class: { name: { equals: query.class, mode: "insensitive" } },
        }),
      },
    }),
    ...(query.age !== undefined && { age: query.age }),
    ...(hasAgeRange && { age: { gte: query.minAge, lte: query.maxAge } }),
    // Calendar dates (UTC): startDate is inclusive from 00:00, endDate inclusive to 23:59:59.999
    ...(hasDateRange && {
      createdAt: {
        gte: query.startDate,
        lt: query.endDate && new Date(query.endDate.getTime() + MS_PER_DAY),
      },
    }),
    ...(andConditions.length && { AND: andConditions }),
  };
};

/**
 * Paginated, filtered student list for one business.
 * Sorting is restricted to approved fields with `id` as a tie-breaker
 * so page boundaries are deterministic.
 */
export const listStudents = async (
  businessId: bigint,
  query: ListStudentsQuery,
): Promise<{
  students: StudentPublicRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const where = buildStudentListFilter(businessId, query);

  const [students, total] = await prisma.$transaction([
    prisma.students.findMany({
      where,
      select: studentPublicSelect,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.students.count({ where }),
  ]);

  return {
    students,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

// ==========================================
// Update
// ==========================================

export interface StudentActor {
  userId: string;
  ip?: string;
}

const findActiveStudent = (studentId: bigint, businessId: bigint) =>
  prisma.students.findFirst({
    where: { id: studentId, businessId, deletedAt: null },
    select: { id: true, status: true },
  });

/**
 * Update the explicitly allowed fields of one student. Uniqueness is checked
 * up front for clear errors and enforced by the database for concurrent requests.
 */
export const updateStudentById = async (
  studentId: bigint,
  businessId: bigint,
  input: UpdateStudentInput,
  actor: StudentActor,
): Promise<StudentPublicRecord> => {
  if (!(await findActiveStudent(studentId, businessId))) {
    throw studentNotFoundError();
  }

  const conflicts = await findStudentUniquenessConflicts(
    [input],
    (_index, field) => field,
    studentId,
  );
  if (conflicts.length) throw studentConflictError(conflicts);

  if (input.subclassId !== undefined) {
    await assertSubclassesExist([input.subclassId], () => ["subclassId"]);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.students.update({
        where: { id: studentId, businessId, deletedAt: null },
        data: input,
        select: studentPublicSelect,
      });
      await AuditModel.logStudentUpdated(
        actor.userId,
        studentId,
        Object.keys(input),
        actor.ip,
        tx,
      );
      return student;
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) throw studentNotFoundError();
    throw mapStudentUniqueViolation(error);
  }
};

// ==========================================
// Block / unblock
// ==========================================

// Statuses that represent an account in normal use. Graduated, withdrawn
// and suspended students are managed through other flows and cannot be
// blocked here, so unblocking (which restores "active") never revives them.
const BLOCKABLE_STATUSES: StudentStatus[] = ["active", "pending", "inactive"];

export interface StudentStatusChangeResult {
  studentId: bigint;
  status: StudentStatus;
  changed: boolean;
}

/**
 * Block a student. Repeating the request on a blocked student is a no-op.
 * The status write is conditional on the status we read, so a concurrent
 * change surfaces as a 409 instead of being silently overwritten.
 */
export const blockStudent = async (
  studentId: bigint,
  businessId: bigint,
  reason: string,
  actor: StudentActor,
): Promise<StudentStatusChangeResult> => {
  const student = await findActiveStudent(studentId, businessId);
  if (!student) throw studentNotFoundError();

  if (student.status === "blocked") {
    return { studentId, status: student.status, changed: false };
  }
  if (!BLOCKABLE_STATUSES.includes(student.status)) {
    throw new AppError(
      `A student with status "${student.status}" cannot be blocked`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  await prisma.$transaction(async (tx) => {
    await applyStatusChange(tx, studentId, student.status, {
      status: "blocked",
      blockReason: reason,
    });
    await AuditModel.logStudentStatusChanged(
      actor.userId,
      studentId,
      "blocked",
      reason,
      actor.ip,
      tx,
    );
  });

  return { studentId, status: "blocked", changed: true };
};

/**
 * Unblock a student, restoring "active" and resetting the failed-login counter
 * (otherwise the next failed login would immediately re-block them).
 * Unblocking a student who is not blocked is a no-op.
 */
export const unblockStudent = async (
  studentId: bigint,
  businessId: bigint,
  reason: string | undefined,
  actor: StudentActor,
): Promise<StudentStatusChangeResult> => {
  const student = await findActiveStudent(studentId, businessId);
  if (!student) throw studentNotFoundError();

  if (student.status !== "blocked") {
    return { studentId, status: student.status, changed: false };
  }

  await prisma.$transaction(async (tx) => {
    await applyStatusChange(tx, studentId, "blocked", {
      status: "active",
      blockReason: null,
      failedLoginCount: 0,
    });
    await AuditModel.logStudentStatusChanged(
      actor.userId,
      studentId,
      "unblocked",
      reason,
      actor.ip,
      tx,
    );
  });

  return { studentId, status: "active", changed: true };
};

const applyStatusChange = async (
  tx: Prisma.TransactionClient,
  studentId: bigint,
  expectedStatus: StudentStatus,
  data: Prisma.StudentsUpdateManyMutationInput,
): Promise<void> => {
  const { count } = await tx.students.updateMany({
    where: { id: studentId, status: expectedStatus, deletedAt: null },
    data,
  });

  if (count === 0) {
    throw new AppError(
      "Student status was changed by another request. Please retry.",
      409,
      "STATUS_CHANGED_CONCURRENTLY",
    );
  }
};

// ==========================================
// Delete
// ==========================================

/**
 * Soft delete a student. The row keeps its unique email, phone number and
 * registration number, so those values cannot be reused afterwards.
 */
export const deleteStudentById = async (
  studentId: bigint,
  businessId: bigint,
  actor: StudentActor,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.students.update({
        where: { id: studentId, businessId, deletedAt: null },
        data: { deletedAt: getCurrentTimestamp() },
      });
      await AuditModel.logStudentDeleted(actor.userId, studentId, actor.ip, tx);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) throw studentNotFoundError();
    throw error;
  }
};
