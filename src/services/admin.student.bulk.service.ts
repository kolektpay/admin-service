import bcrypt from "bcrypt";
import { GuardianStatus } from "@prisma/client";
import prisma from "../config/database";
import { AuditModel } from "../models/audit.model";
import { NotificationModel } from "../models/notifications.model";
import { createStudentWallet } from "../thirdPartyService/wallet.services";
import { TempPasswordTokenManager } from "../utils/tempPasswordTokenManager";
import { AppError, IFieldError } from "../middleware/error.middleware";
import { BulkStudentRecord } from "../validations/studentManagement.schema";
import {
  assertSubclassesExist,
  findStudentUniquenessConflicts,
  mapStudentUniqueViolation,
  StudentActor,
  studentConflictError,
} from "./admin.student.service";

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;

// Guardians in these states can have students assigned to them
const ASSIGNABLE_GUARDIAN_STATUSES: GuardianStatus[] = ["active", "pending"];

const WALLET_REQUEST_CONCURRENCY = 5;
const TRANSACTION_TIMEOUT_MS = 30_000;

const studentField = (index: number, field: string) => `students[${index}].${field}`;

// ==========================================
// Pre-transaction validation
// ==========================================

/** Reject the batch if two records share an email, phone number or registration number. */
const assertNoDuplicatesWithinBatch = (records: BulkStudentRecord[]): void => {
  const fields = ["email", "phoneNumber", "registrationNumber"] as const;
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

/** Every guardian must belong to the caller's business, not be deleted, and be assignable. */
const assertGuardiansAreAssignable = async (
  records: BulkStudentRecord[],
  businessId: bigint,
): Promise<void> => {
  const guardianIds = [...new Set(records.map((r) => r.guardianId))];
  const eligible = await prisma.guardians.findMany({
    where: {
      id: { in: guardianIds },
      businessId,
      deletedAt: null,
      status: { in: ASSIGNABLE_GUARDIAN_STATUSES },
    },
    select: { id: true },
  });
  const eligibleIds = new Set(eligible.map((g) => g.id));

  const details = records.flatMap((record, index) =>
    eligibleIds.has(record.guardianId)
      ? []
      : [
          {
            field: studentField(index, "guardianId"),
            message: "Guardian not found or not eligible for assignment",
          },
        ],
  );

  if (details.length) {
    throw new AppError(
      "One or more guardians cannot be assigned",
      400,
      "GUARDIAN_NOT_ASSIGNABLE",
      details,
    );
  }
};

const validateBatch = async (
  records: BulkStudentRecord[],
  businessId: bigint,
): Promise<void> => {
  assertNoDuplicatesWithinBatch(records);

  const conflicts = await findStudentUniquenessConflicts(records, studentField);
  if (conflicts.length) throw studentConflictError(conflicts);

  await assertGuardiansAreAssignable(records, businessId);
  await assertSubclassesExist(
    records.map((r) => r.subclassId),
    (subclassId) =>
      records.flatMap((r, index) =>
        r.subclassId === subclassId ? [studentField(index, "subclassId")] : [],
      ),
  );
};

// ==========================================
// Transaction
// ==========================================

interface PreparedStudent {
  record: BulkStudentRecord;
  temporaryPassword: string;
  hashedPassword: string;
}

/** Password hashing is slow, so it happens before the transaction opens. */
const prepareStudents = (records: BulkStudentRecord[]): Promise<PreparedStudent[]> =>
  Promise.all(
    records.map(async (record) => {
      const temporaryPassword = TempPasswordTokenManager.generateToken();
      const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds);
      return { record, temporaryPassword, hashedPassword };
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
      const idFor = (record: BulkStudentRecord) => studentIdByEmail.get(record.email)!;

      await tx.guardianHasStudents.createMany({
        data: prepared.map(({ record }) => ({
          studentId: idFor(record),
          guardianId: record.guardianId,
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

type CreatedStudent = Awaited<ReturnType<typeof insertStudentsAtomically>>[number];

// ==========================================
// Wallet provisioning (after commit)
// ==========================================

export interface WalletProvisioningResult {
  created: number;
  pending: { studentId: bigint; reason: string }[];
}

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
};

/**
 * Wallets live in the external payment service, so they cannot join the
 * database transaction. They are requested only after the students are
 * committed; each student's `isWalletCreated` flag records the outcome.
 * Students left with `isWalletCreated = false` are reported as pending and
 * can be retried through POST /admin/wallet/student-wallets.
 */
const provisionStudentWallets = async (
  students: CreatedStudent[],
  recordByEmail: Map<string, BulkStudentRecord>,
  businessId: bigint,
): Promise<WalletProvisioningResult> => {
  const createdIds: bigint[] = [];
  const pending: WalletProvisioningResult["pending"] = [];

  await runWithConcurrency(students, WALLET_REQUEST_CONCURRENCY, async (student) => {
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
      if (response?.success === false) {
        pending.push({ studentId: student.id, reason: "Wallet service rejected the request" });
      } else {
        createdIds.push(student.id);
      }
    } catch {
      pending.push({ studentId: student.id, reason: "Wallet service unavailable" });
    }
  });

  if (createdIds.length) {
    await prisma.students.updateMany({
      where: { id: { in: createdIds } },
      data: { isWalletCreated: true },
    });
  }

  return { created: createdIds.length, pending };
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
): Promise<{ students: CreatedStudent[]; walletProvisioning: WalletProvisioningResult }> => {
  await validateBatch(records, businessId);

  const prepared = await prepareStudents(records);

  let students: CreatedStudent[];
  try {
    students = await insertStudentsAtomically(prepared, businessId, actor);
  } catch (error) {
    // A concurrent request may have claimed an email/phone/reg number since validation
    throw mapStudentUniqueViolation(error);
  }

  const recordByEmail = new Map(records.map((r) => [r.email, r]));
  const walletProvisioning = await provisionStudentWallets(students, recordByEmail, businessId);

  return { students, walletProvisioning };
};
