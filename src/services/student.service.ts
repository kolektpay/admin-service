import { GuardianStatus, Prisma, StudentStatus } from "@prisma/client";
import bcrypt from "bcrypt";

import prisma from "../config/database";
import { getCurrentTimestamp } from "../helpers/date.helper";
import {
  getUniqueViolationField,
  isPrismaErrorCode,
} from "../helpers/prismaError.helper";
import { IFieldError } from "../interfaces/common.interface";
import {
  PreparedStudent,
  StudentActor,
  StudentStatusChangeResult,
  StudentUniqueFields,
  WalletProvisioningResult,
} from "../interfaces/student.interfaces";
import { TempPasswordTokenManager } from "../managers/tempPasswordTokenManager";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import { NotificationModel } from "../models/notifications.model";
import { StudentPublicRecord, studentPublicSelect } from "../models/student.model";
import { createStudentWallet } from "../thirdPartyService/wallet.services";
import {
  BulkStudentRecord,
  ListStudentsQuery,
  UpdateStudentInput,
} from "../validations/studentManagement.schema";

// ==========================================
// Shared helpers
// ==========================================

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

/** Reject subclasses that do not exist or belong to another business. */
export const assertSubclassesExist = async (
  subclassIds: bigint[],
  businessId: bigint,
  fieldPath: (subclassId: bigint) => string[],
): Promise<void> => {
  const uniqueIds = [...new Set(subclassIds)];
  const found = await prisma.subclasses.findMany({
    where: { id: { in: uniqueIds }, businessId },
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
    await assertSubclassesExist([input.subclassId], businessId, () => ["subclassId"]);
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

// ==========================================
// Bulk creation
// ==========================================

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;

// Guardians in these states can have students assigned to them
const ASSIGNABLE_GUARDIAN_STATUSES: GuardianStatus[] = ["active", "pending"];

const WALLET_REQUEST_CONCURRENCY = 5;
const TRANSACTION_TIMEOUT_MS = 30_000;

const studentField = (index: number, field: string) =>
  `students[${index}].${field}`;

// ==========================================
// Pre-transaction validation
// ==========================================

/** Reject the batch if two records share an email, phone number or registration number. */
const assertNoDuplicatesWithinBatch = (records: BulkStudentRecord[]): void => {
  const fields = ["email", "registrationNumber"] as const;
  const details: IFieldError[] = [];

  for (const field of fields) {
    const firstIndexByValue = new Map<string, number>();
    records.forEach((record, index) => {
      const value = record[field];
      if (!value) return;

      const firstIndex = firstIndexByValue.get(value);
      if (firstIndex === undefined) {
        firstIndexByValue.set(value, index);
      } else {
        details.push({
          field: studentField(index, field),
          message: `Duplicates ${studentField(firstIndex, field)} in this request`,
        });
      }
    });
  }

  if (details.length) {
    throw new AppError(
      "The request contains duplicate student records",
      409,
      "DUPLICATE_IN_REQUEST",
      details,
    );
  }
};

/**
 * Look up each record's guardian by email. Every guardian must belong to the
 * caller's business, not be deleted, and be assignable. Returns the guardian
 * id for each record, in the same order as `records`.
 */
const resolveGuardianIds = async (
  records: BulkStudentRecord[],
  businessId: bigint,
): Promise<bigint[]> => {
  // Guardian emails are not normalised on creation, so match case-insensitively
  const guardianEmails = [...new Set(records.map((r) => r.guardianEmail))];
  const eligible = await prisma.guardians.findMany({
    where: {
      OR: guardianEmails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
      businessId,
      deletedAt: null,
      status: { in: ASSIGNABLE_GUARDIAN_STATUSES },
    },
    select: { id: true, email: true },
  });
  const guardianIdByEmail = new Map(
    eligible.map((g) => [g.email!.toLowerCase(), g.id]),
  );

  const details: IFieldError[] = [];
  const guardianIds = records.map((record, index) => {
    const guardianId = guardianIdByEmail.get(record.guardianEmail);
    if (guardianId === undefined) {
      details.push({
        field: studentField(index, "guardianEmail"),
        message: "Guardian not found or not eligible for assignment",
      });
    }
    return guardianId!;
  });

  if (details.length) {
    throw new AppError(
      "One or more guardians cannot be assigned",
      400,
      "GUARDIAN_NOT_ASSIGNABLE",
      details,
    );
  }

  return guardianIds;
};

/** Validates the batch and returns the resolved guardian id for each record. */
const validateBatch = async (
  records: BulkStudentRecord[],
  businessId: bigint,
): Promise<bigint[]> => {
  assertNoDuplicatesWithinBatch(records);

  const conflicts = await findStudentUniquenessConflicts(records, studentField);
  if (conflicts.length) throw studentConflictError(conflicts);

  const guardianIds = await resolveGuardianIds(records, businessId);
  await assertSubclassesExist(
    records.map((r) => r.subclassId),
    businessId,
    (subclassId) =>
      records.flatMap((r, index) =>
        r.subclassId === subclassId ? [studentField(index, "subclassId")] : [],
      ),
  );

  return guardianIds;
};

// ==========================================
// Transaction
// ==========================================

/** Password hashing is slow, so it happens before the transaction opens. */
const prepareStudents = (
  records: BulkStudentRecord[],
  guardianIds: bigint[],
): Promise<PreparedStudent[]> =>
  Promise.all(
    records.map(async (record, index) => {
      const temporaryPassword = TempPasswordTokenManager.generateToken();
      const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds);
      return {
        record,
        guardianId: guardianIds[index],
        temporaryPassword,
        hashedPassword,
      };
    }),
  );

/**
 * Insert students, guardian links, password history, temporary-password
 * notifications (picked up by the mailer from the notifications table) and
 * audit rows in one transaction. Any failure rolls back the whole batch.
 */
const insertStudentsAtomically = (
  prepared: PreparedStudent[],
  businessId: bigint,
  actor: StudentActor,
) =>
  prisma.$transaction(
    async (tx) => {
      const students = await tx.students.createManyAndReturn({
        data: prepared.map(({ record, hashedPassword }) => ({
          businessId,
          subclassId: record.subclassId,
          firstName: record.firstName,
          middleName: record.middleName,
          lastName: record.lastName,
          email: record.email,
          phoneNumber: record.phoneNumber,
          registrationNumber: record.registrationNumber,
          gender: record.gender,
          age: record.age,
          dateOfBirth: record.dateOfBirth,
          address: record.address,
          avatar: record.avatar,
          password: hashedPassword,
          mustChangePassword: true,
        })),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phoneNumber: true,
          address: true,
          registrationNumber: true,
          status: true,
          subclassId: true,
          createdAt: true,
        },
      });

      // Match rows back to input by email (unique) rather than relying on insert order
      const studentIdByEmail = new Map(students.map((s) => [s.email, s.id]));
      const idFor = (record: BulkStudentRecord) =>
        studentIdByEmail.get(record.email)!;

      await tx.guardianHasStudents.createMany({
        data: prepared.map(({ record, guardianId }) => ({
          studentId: idFor(record),
          guardianId,
        })),
      });

      await tx.passwordHistory.createMany({
        data: prepared.map(({ record, hashedPassword }) => ({
          studentId: idFor(record),
          password: hashedPassword,
          passwordstatus: "password-change",
        })),
      });

      await tx.notifications.createMany({
        data: prepared.map(({ record, temporaryPassword }) =>
          NotificationModel.buildTempPasswordNotificationForStudents({
            email: record.email,
            firstName: record.firstName,
            lastName: record.lastName,
            generatedPassword: temporaryPassword,
            resetLink: `${process.env.MUST_CHANGE_PASSWORD_LINK_URL}/change-password?email=${record.email}`,
          }),
        ),
      });

      await AuditModel.logStudentsBulkCreated(
        actor.userId,
        students.map((s) => s.id),
        actor.ip,
        tx,
      );

      return students;
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );

type CreatedStudent = Awaited<
  ReturnType<typeof insertStudentsAtomically>
>[number];

// ==========================================
// Wallet provisioning (after commit)
// ==========================================

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.min(limit, queue.length) },
    async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
};

/**
 * Wallets live in the external payment service, so they cannot join the
 * database transaction and a wallet failure does not roll the students back.
 * Wallets are requested only after the students are committed. Each wallet
 * that is created is recorded in `students_has_wallets` and flips the
 * student's `isWalletCreated` flag; both writes share one transaction.
 * Students left with `isWalletCreated = false` are reported as pending and
 * can be retried through POST /admin/wallet/student-wallets.
 */
const provisionStudentWallets = async (
  students: CreatedStudent[],
  recordByEmail: Map<string, BulkStudentRecord>,
  businessId: bigint,
): Promise<WalletProvisioningResult> => {
  const created: { studentId: bigint; walletId: string }[] = [];
  const pending: WalletProvisioningResult["pending"] = [];

  await runWithConcurrency(
    students,
    WALLET_REQUEST_CONCURRENCY,
    async (student) => {
      const record = recordByEmail.get(student.email)!;
      try {
        const response = await createStudentWallet({
          businessId: Number(businessId),
          student: {
            firstName: student.firstName,
            lastName: student.lastName,
            middleName: student.middleName ?? undefined,
            emailAddress: student.email,
            mobileNumber: student.phoneNumber,
            address: student.address,
            city: record.city,
            alias: record.alias,
            studentId: Number(student.id),
          },
        });

        // The wallet provider resolves with { success: false } instead of throwing
        const walletId: string | undefined = response?.data?.walletId;
        if (response?.success === false) {
          pending.push({
            studentId: student.id,
            reason: "Wallet service rejected the request",
          });
        } else if (!walletId) {
          pending.push({
            studentId: student.id,
            reason: "Wallet service returned no wallet id",
          });
        } else {
          created.push({ studentId: student.id, walletId });
        }
      } catch {
        pending.push({
          studentId: student.id,
          reason: "Wallet service unavailable",
        });
      }
    },
  );

  if (created.length) {
    await prisma.$transaction([
      prisma.studentsHasWallets.createMany({
        data: created.map(({ studentId, walletId }) => ({
          student_id: studentId,
          business_id: businessId,
          wallet_id: walletId,
        })),
        skipDuplicates: true,
      }),
      prisma.students.updateMany({
        where: { id: { in: created.map((c) => c.studentId) } },
        data: { isWalletCreated: true },
      }),
    ]);
  }

  return { created: created.length, pending };
};

// ==========================================
// Entry point
// ==========================================

/**
 * Create a batch of students for one business. All database writes are
 * atomic; wallet creation follows the commit (see provisionStudentWallets).
 */
export const bulkCreateStudents = async (
  records: BulkStudentRecord[],
  businessId: bigint,
  actor: StudentActor,
): Promise<{
  students: CreatedStudent[];
  walletProvisioning: WalletProvisioningResult;
}> => {
  const guardianIds = await validateBatch(records, businessId);

  const prepared = await prepareStudents(records, guardianIds);

  let students: CreatedStudent[];
  try {
    students = await insertStudentsAtomically(prepared, businessId, actor);
  } catch (error) {
    // A concurrent request may have claimed an email/phone/reg number since validation
    throw mapStudentUniqueViolation(error);
  }

  const recordByEmail = new Map(records.map((r) => [r.email, r]));
  const walletProvisioning = await provisionStudentWallets(
    students,
    recordByEmail,
    businessId,
  );

  return { students, walletProvisioning };
};
