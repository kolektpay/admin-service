import { Prisma, UserStatus } from "@prisma/client";

import prisma from "../config/database";
import { AdminActor } from "../interfaces/admin.interfaces";

type DbClient = Prisma.TransactionClient;

export class AuditModel {
  /**
   * Log failed login attempt to audit log
   */
  static async logFailedLogin(
    userId: string | null,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "failure",
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
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
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
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "blocked",
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
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
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
      await prisma.auditLogs.create({
        data: {
          userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          status: "password_change",
        },
      });
    } else {
      await prisma.auditLogs.create({
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          status: "password_change",
        },
      });
    }
  }

  static async logGottenEveryUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_get_every_user",
      },
    });
  }

  static async logGottenUniqueUserById(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_get_user_by_unique_id",
      },
    });
  }

  static async logGottenAllWalletDetails(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "All_wallet_details_successfully_gotten_for_this_user",
      },
    });
  }

  static async logPaymentLinkGenerated(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "Payment_link_successfully_generated",
      },
    });
  }

  static async logAllGeneratedPaymentLinksGotten(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "All_generated_payment_links_retrieved",
      },
    });
  }

  static async logSetupTwoFactorOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_setup_2fa_operation_was_successful",
      },
    });
  }

  static async logEnableTwoFactorOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
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
      await prisma.auditLogs.create({
        data: {
          userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          status: "forgot_password_operation_was_successful",
        },
      });
    } else {
      await prisma.auditLogs.create({
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          status: "reset_password_operation_was_successful",
        },
      });
    } else {
      await prisma.auditLogs.create({
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          userId,
          ipAddress,
          result: "success",
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
      await prisma.auditLogs.create({
        data: {
          studentId: userId,
          ipAddress,
          result: "success",
          status: "must_change_password_operation_was_successful",
        },
      });
    } else {
      await prisma.auditLogs.create({
        data: {
          guardianId: userId,
          ipAddress,
          result: "success",
          status: "must_change_password_operation_was_successful",
        },
      });
    }
  }

  static async logPasswordRotationEnforcementOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "Password rotation enforcement message log information.",
      },
    });
  }

  static async logUserChangedPasswordOperation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "This user has successfully changed his password.",
      },
    });
  }

  static async logUserCreatedNewGuardianEntry(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status:
          "This user has successfully created a new student entry on the guardians table.",
      },
    });
  }

  static async logUpdatedGuardianInfoForAParticlarBusinessId(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: `This user with id ${userId} updated guardian info`,
      },
    });
  }

  static async logDeletedGuardianInfoForAParticlarBusinessId(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: `This user with id ${userId} deleted guardian info`,
      },
    });
  }

  static async logNewStudentWalletCreation(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: `This user with id ${userId} created a wallet for a new student`,
      },
    });
  }

  static async logUserLogout(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "user_logout",
      },
    });
  }

  static async logPaymentItemCreation(
    userId: string,
    ipAddress: string | undefined,
    businessId: bigint | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        businessId,
        result: "success",
        status: "payment_item_creation",
      },
    });
  }

  static async logPaymentItemApproval(
    userId: string,
    ipAddress: string | undefined,
    businessId: bigint | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        businessId,
        result: "success",
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
    await db.auditLogs.createMany({
      data: studentIds.map((studentId) => ({
        userId,
        studentId,
        ipAddress,
        result: "success" as const,
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
    await db.auditLogs.create({
      data: {
        userId,
        studentId,
        ipAddress,
        result: "success",
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
    await db.auditLogs.create({
      data: {
        userId,
        studentId,
        ipAddress,
        result: "success",
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
    await db.auditLogs.create({
      data: {
        userId,
        studentId,
        ipAddress,
        result: action === "blocked" ? "blocked" : "success",
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
    roleId: bigint,
    db: DbClient = prisma,
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
        status: `admin_created: ${adminId} with role ${roleId}`,
      },
    });
  }

  static async logAdminUpdated(
    actor: AdminActor,
    adminId: string,
    updatedFields: string[],
    db: DbClient = prisma,
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
        status: `admin_updated: ${adminId} (${updatedFields.join(", ")})`,
      },
    });
  }

  static async logAdminRoleChanged(
    actor: AdminActor,
    adminId: string,
    roleId: bigint | null,
    db: DbClient = prisma,
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
        status: roleId
          ? `admin_role_assigned: ${adminId} to role ${roleId}`
          : `admin_role_unassigned: ${adminId}`,
      },
    });
  }

  static async logAdminDeleted(
    actor: AdminActor,
    adminId: string,
    db: DbClient = prisma,
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
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
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: status === "blocked" ? "blocked" : "success",
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
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
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
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
        status: `role_deleted: ${roleId} (${roleName})`,
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
    await db.auditLogs.create({
      data: {
        ...auditActor(actor),
        result: "success",
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
