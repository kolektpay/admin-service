import { AuditActorType, Prisma, UserStatus } from "@prisma/client";

import prisma from "../config/database";
import { AuditAction, classChangeAction } from "../constants/auditActions";
import { AdminActor } from "../interfaces/admin.interfaces";
import {
  markAudited,
  requestAuditFields,
  tokenBusinessId,
} from "../utils/auditContext";

type DbClient = Prisma.TransactionClient;

export type AuditRow = Omit<Prisma.AuditLogsUncheckedCreateInput, "action"> & {
  action: AuditAction;
};

/**
 * The business a log row belongs to, so every row can be shown to the right
 * school. Uses, in order: the businessId the caller passed; the student's
 * business; the guardian's business (or their children's, when they all share
 * one); the business in the request's token; the administrator's business
 * when they belong to exactly one. Returns null when none of these settles
 * it, rather than guessing.
 */
const resolveBusinessId = async (
  row: Pick<AuditRow, "businessId" | "userId" | "studentId" | "guardianId">,
  db: DbClient,
): Promise<bigint | null> => {
  if (row.businessId !== undefined && row.businessId !== null) {
    return BigInt(row.businessId);
  }

  const fromToken = tokenBusinessId();

  if (row.studentId !== undefined && row.studentId !== null) {
    const student = await db.students.findUnique({
      where: { id: BigInt(row.studentId) },
      select: { businessId: true },
    });
    if (student) return student.businessId;
  }

  if (row.guardianId !== undefined && row.guardianId !== null) {
    const guardianId = BigInt(row.guardianId);
    const guardian = await db.guardians.findUnique({
      where: { id: guardianId },
      select: { businessId: true },
    });
    if (guardian?.businessId) return guardian.businessId;

    const children = await db.guardianHasStudents.findMany({
      where: { guardianId },
      select: { students: { select: { businessId: true } } },
    });
    const childBusinesses = new Set(children.map(({ students }) => students.businessId));
    if (childBusinesses.size === 1) return [...childBusinesses][0];
  }

  // The school the administrator is signed into, even if they belong to several
  if (fromToken !== undefined) return fromToken;

  if (row.userId) {
    // Two rows are enough to tell "exactly one" from "several"
    const memberships = await db.userBusiness.findMany({
      where: { userId: row.userId, businessId: { not: null } },
      select: { businessId: true },
      distinct: ["businessId"],
      take: 2,
    });
    if (memberships.length === 1) return memberships[0].businessId;
  }

  return null;
};

/**
 * Who acted. An administrator on the row acted (possibly on a student or
 * guardian); without one, a guardian acted (possibly on their child); else a
 * student. A row naming nobody is an attempt on an account that doesn't exist.
 */
const inferActorType = (row: AuditRow): AuditActorType => {
  if (row.userId) return "admin";
  if (row.guardianId !== undefined && row.guardianId !== null) return "guardian";
  if (row.studentId !== undefined && row.studentId !== null) return "student";
  return "anonymous";
};

/** The student or guardian an administrator or guardian acted on, if any. */
const inferTarget = (
  row: AuditRow,
  actorType: AuditActorType,
): { targetType?: string; targetId?: string } => {
  if (row.targetType) return {};
  const hasStudent = row.studentId !== undefined && row.studentId !== null;
  const hasGuardian = row.guardianId !== undefined && row.guardianId !== null;

  if ((actorType === "admin" || actorType === "guardian") && hasStudent) {
    return { targetType: "student", targetId: String(row.studentId) };
  }
  if (actorType === "admin" && hasGuardian) {
    return { targetType: "guardian", targetId: String(row.guardianId) };
  }
  return {};
};

/**
 * Every audit write goes through here. Fills in who acted, what they acted on,
 * the business, and the request's IP, device, route and request id. The IP
 * comes from the request (respecting "trust proxy") rather than from callers,
 * which read the spoofable X-Forwarded-For header directly.
 */
export const createAuditLog = async (db: DbClient, { data }: { data: AuditRow }) => {
  const request = requestAuditFields();
  const actorType = data.actorType ?? inferActorType(data);
  markAudited();

  return db.auditLogs.create({
    data: {
      ...request,
      ...data,
      ipAddress: request.ipAddress ?? data.ipAddress?.slice(0, 45) ?? null,
      actorType,
      ...inferTarget(data, actorType),
      businessId: await resolveBusinessId(data, db),
    },
  });
};

export class AuditModel {
  /**
   * Log failed login attempt to audit log
   */
  static async logFailedLogin(
    userId: string | null,
    ipAddress: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "failure",
        action: "auth.login_failed" as const,
        status: "failed_login_attempt",
      },
    });
  }

  /**
   * Log successful login to audit log
   */
  static async logSuccessfulLogin(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.login_succeeded" as const,
        status: "successful_login_attempt",
      },
    });
  }

  /**
   * Log blocked account attempt
   */
  static async logBlockedAccount(
    userId: string,
    ipAddress: string | undefined,
    reason: string,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "blocked",
        action: "auth.account_locked" as const,
        status: `user_account_blocked due to ${reason}`,
      },
    });
  }
  //log blocked student account

  /**
   * Log view audit logs attempt
   */
  static async logAuditLogsViewed(
    userId: string,
    ipAddress: string | undefined,
    businessId?: bigint,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        businessId,
        result: "success",
        action: "audit_logs.viewed" as const,
        status: "request_to_view_audit_logs",
      },
    });
  }

  /**
   * Log user password change attempt
   */

  static async logPasswordChange(
    userId: string | bigint,
    ipAddress: string | undefined,
    accountRole?: "student" | "guardian",
  ): Promise<void> {
    if (typeof userId === "string") {
      await createAuditLog(prisma, {
        data: {
          userId,
          ipAddress,
          result: "success",
          action: "auth.password_changed" as const,
          status: "password_change",
        },
      });
      return;
    }

    let role = accountRole;
    if (!role) {
      const isStudent = await prisma.students.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      role = isStudent ? "student" : "guardian";
    }

    if (role === "student") {
      await createAuditLog(prisma, {
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_changed" as const,
          status: "password_change",
        },
      });
    } else {
      await createAuditLog(prisma, {
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_changed" as const,
          status: "password_change",
        },
      });
    }
  }

  static async logGottenEveryUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "admin.listed" as const,
        status: "request_to_get_every_user",
      },
    });
  }

  static async logGottenUniqueUserById(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "admin.viewed" as const,
        status: "request_to_get_user_by_unique_id",
      },
    });
  }

  static async logGottenAllWalletDetails(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "wallet.details_viewed" as const,
        status: "All_wallet_details_successfully_gotten_for_this_user",
      },
    });
  }

  static async logPaymentLinkGenerated(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "payment_link.generated" as const,
        status: "Payment_link_successfully_generated",
      },
    });
  }

  static async logAllGeneratedPaymentLinksGotten(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "payment_link.listed" as const,
        status: "All_generated_payment_links_retrieved",
      },
    });
  }

  static async logSetupTwoFactorOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.two_factor_setup" as const,
        status: "request_to_setup_2fa_operation_was_successful",
      },
    });
  }

  static async logEnableTwoFactorOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.two_factor_enabled" as const,
        status: "request_to_enable_2fa_operation_was_successful",
      },
    });
  }

  static async logForgotPaswordOperation(
    userId: string | bigint,
    ipAddress?: string | undefined,
    accountRole?: "student" | "guardian",
  ): Promise<void> {
    if (typeof userId === "string") {
      await createAuditLog(prisma, {
        data: {
          userId,
          ipAddress,
          result: "success",
          action: "auth.password_forgot_requested" as const,
          status: "forgot_password_operation_was_successful",
        },
      });
      return;
    }

    let role = accountRole;
    if (!role) {
      const isStudent = await prisma.students.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      role = isStudent ? "student" : "guardian";
    }

    if (role === "student") {
      await createAuditLog(prisma, {
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_forgot_requested" as const,
          status: "forgot_password_operation_was_successful",
        },
      });
    } else {
      await createAuditLog(prisma, {
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_forgot_requested" as const,
          status: "forgot_password_operation_was_successful",
        },
      });
    }
  }
  static async logResetPaswordOperation(
    userId: string | bigint,
    ipAddress?: string | undefined,
    accountRole?: "student" | "guardian",
  ): Promise<void> {
    if (typeof userId === "string") {
      await createAuditLog(prisma, {
        data: {
          userId,
          ipAddress,
          result: "success",
          action: "auth.password_reset" as const,
          status: "reset_password_operation_was_successful",
        },
      });
      return;
    }

    let role = accountRole;
    if (!role) {
      const isStudent = await prisma.students.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      role = isStudent ? "student" : "guardian";
    }

    if (role === "student") {
      await createAuditLog(prisma, {
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_reset" as const,
          status: "reset_password_operation_was_successful",
        },
      });
    } else {
      await createAuditLog(prisma, {
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          action: "auth.password_reset" as const,
          status: "reset_password_operation_was_successful",
        },
      });
    }
  }

  /**
   * Log a must-change-password operation. Works for either a Users-table
   * account (string uuid) or a Students/Guardians account (bigint id).
   * For the bigint case, accountRole tells us which junction column to
   * write to (studentId vs guardianId); if it's not passed, we fall back
   * to checking whether the id belongs to a student, matching the same
   * pattern used by logPasswordChange, logForgotPaswordOperation, and
   * logResetPaswordOperation above.
   */
  static async logMustChangePasswordOperation(
    userId: string | bigint,
    ipAddress?: string | undefined,
    accountRole?: "student" | "guardian",
  ): Promise<void> {
    if (typeof userId === "string") {
      await createAuditLog(prisma, {
        data: {
          userId,
          ipAddress,
          result: "success",
          action: "auth.temporary_password_changed" as const,
          status: "must_change_password_operation_was_successful",
        },
      });
      return;
    }

    let role = accountRole;
    if (!role) {
      const isStudent = await prisma.students.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      role = isStudent ? "student" : "guardian";
    }

    if (role === "student") {
      await createAuditLog(prisma, {
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          action: "auth.temporary_password_changed" as const,
          status: "must_change_password_operation_was_successful",
        },
      });
    } else {
      await createAuditLog(prisma, {
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          action: "auth.temporary_password_changed" as const,
          status: "must_change_password_operation_was_successful",
        },
      });
    }
  }

  static async logPasswordRotationEnforcementOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.password_rotation_enforced" as const,
        status: "Password rotation enforcement message log information.",
      },
    });
  }

  static async logUserChangedPasswordOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.password_changed" as const,
        status: "This user has successfully changed his password.",
      },
    });
  }

  static async logUserCreatedNewGuardianEntry(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "guardian.created" as const,
        status:
          "This user has successfully created a new student entry on the guardians table.",
      },
    });
  }

  static async logUpdatedGuardianInfoForAParticlarBusinessId(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "guardian.updated" as const,
        status: `This user with id ${userId} updated guardian info`,
      },
    });
  }

  static async logDeletedGuardianInfoForAParticlarBusinessId(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "guardian.deleted" as const,
        status: `This user with id ${userId} deleted guardian info`,
      },
    });
  }

  static async logNewStudentWalletCreation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "wallet.student_wallet_created" as const,
        status: `This user with id ${userId} created a wallet for a new student`,
      },
    });
  }

  static async logUserLogout(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        result: "success",
        action: "auth.logout" as const,
        status: "user_logout",
      },
    });
  }

  static async logPaymentItemCreation(
    userId: string,
    ipAddress: string | undefined,
    businessId: bigint | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        businessId,
        result: "success",
        action: "payment_item.created" as const,
        status: "payment_item_creation",
      },
    });
  }

  static async logPaymentItemApproval(
    userId: string,
    ipAddress: string | undefined,
    businessId: bigint | undefined,
  ): Promise<void> {
    await createAuditLog(prisma, {
      data: {
        userId,
        ipAddress,
        businessId,
        result: "success",
        action: "payment_item.approved" as const,
        status: "payment_item_approval",
      },
    });
  }

  // ==========================================
  // Student management (actor + target student recorded on each row).
  // Accept a transaction client so the audit row commits atomically
  // with the change it describes.
  // ==========================================

  static async logStudentsBulkCreated(
    userId: string,
    studentIds: bigint[],
    ipAddress: string | undefined,
    db: DbClient = prisma,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    // A bulk upload targets a single business, so one lookup covers every row
    const businessId = await resolveBusinessId(
      { userId, studentId: studentIds[0] },
      db,
    );

    const request = requestAuditFields();
    markAudited();

    await db.auditLogs.createMany({
      data: studentIds.map((studentId) => ({
        businessId,
        userId,
        studentId,
        ...request,
        ipAddress: request.ipAddress ?? ipAddress?.slice(0, 45),
        actorType: "admin" as const,
        targetType: "student",
        targetId: String(studentId),
        result: "success" as const,
        action: "student.created" as const,
        status: "student_created_via_bulk_upload",
      })),
    });
  }

  static async logStudentUpdated(
    userId: string,
    studentId: bigint,
    updatedFields: string[],
    ipAddress: string | undefined,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        userId,
        studentId,
        ipAddress,
        result: "success",
        action: "student.updated" as const,
        status: `student_info_updated: ${updatedFields.join(", ")}`,
      },
    });
  }

  static async logStudentDeleted(
    userId: string,
    studentId: bigint,
    ipAddress: string | undefined,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        userId,
        studentId,
        ipAddress,
        result: "success",
        action: "student.deleted" as const,
        status: "student_deleted",
      },
    });
  }

  static async logStudentStatusChanged(
    userId: string,
    studentId: bigint,
    action: "blocked" | "unblocked",
    reason: string | undefined,
    ipAddress: string | undefined,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        userId,
        studentId,
        ipAddress,
        result: action === "blocked" ? "blocked" : "success",
        action: action === "blocked" ? "student.blocked" : "student.unblocked",
        status: `student_account_${action}${reason ? ` due to ${reason}` : ""}`,
      },
    });
  }

  // ==========================================
  // Administrator and role management.
  // userId is the actor; the affected record is named in status.
  // ==========================================

  static async logAdminCreated(
    actor: AdminActor,
    adminId: string,
    roleIds: bigint[],
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "admin.created" as const,
        status: `admin_created: ${adminId} with roles [${roleIds.join(", ")}]`,
      },
    });
  }

  static async logAdminUpdated(
    actor: AdminActor,
    adminId: string,
    updatedFields: string[],
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "admin.updated" as const,
        status: `admin_updated: ${adminId} (${updatedFields.join(", ")})`,
      },
    });
  }

  static async logAdminRolesChanged(
    actor: AdminActor,
    adminId: string,
    added: bigint[],
    removed: bigint[],
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "admin.roles_changed" as const,
        status: `admin_roles_changed: ${adminId}, added [${added.join(", ")}], removed [${removed.join(", ")}]`,
      },
    });
  }

  static async logAdminDeleted(
    actor: AdminActor,
    adminId: string,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "admin.deleted" as const,
        status: `admin_deleted: ${adminId}`,
      },
    });
  }

  static async logAdminStatusChanged(
    actor: AdminActor,
    adminId: string,
    status: UserStatus,
    reason: string | undefined,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: status === "blocked" || status === "blocked_by_admin" ? "blocked" : "success",
        action: "admin.status_changed" as const,
        status: `admin_status_changed: ${adminId} to ${status}${reason ? ` due to ${reason}` : ""}`,
      },
    });
  }

  static async logRoleCreated(
    actor: AdminActor,
    roleId: bigint,
    roleName: string,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "role.created" as const,
        status: `role_created: ${roleId} (${roleName})`,
      },
    });
  }

  static async logRoleDeleted(
    actor: AdminActor,
    roleId: bigint,
    roleName: string,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "role.deleted" as const,
        status: `role_deleted: ${roleId} (${roleName})`,
      },
    });
  }

  /** Class and subclass changes, e.g. "class_created: 4 (JSS 1)". */
  static async logClassChange(
    actor: AdminActor,
    status: string,
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: classChangeAction(status),
        status,
      },
    });
  }

  static async logRolePermissionsUpdated(
    actor: AdminActor,
    roleId: bigint,
    roleName: string,
    added: bigint[],
    removed: bigint[],
    db: DbClient = prisma,
  ): Promise<void> {
    await createAuditLog(db, {
      data: {
        ...auditActor(actor),
        result: "success",
        action: "role.permissions_updated" as const,
        status: `role_permissions_updated: role ${roleId} (${roleName}), added [${added.join(", ")}], removed [${removed.join(", ")}]`,
      },
    });
  }
}

const auditActor = (actor: AdminActor) => ({
  userId: actor.userId,
  businessId: actor.businessId,
  ipAddress: actor.ip,
});
