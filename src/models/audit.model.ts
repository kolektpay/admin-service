import { Prisma } from "@prisma/client";
import prisma from "../config/database";

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
   * Log unblocking account attempt
   */
  static async logUnblockedAccount(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "blocked",
        status: "user_account_unblocked",
      },
    });
  }
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
   * Log assign role to user attempt
   */

  static async logAssignRoleToUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_assign_role_to_user",
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

  static async logCreatedNewUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_create_a_new_user",
      },
    });
  }

  static async logUpdateNewUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_update_existing_user_details",
      },
    });
  }

  static async logDeletedNewUser(
    userId: string,
    ipAddress: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "request_to_delete_an_existing_user",
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

  static async logNewManagerUserCreated(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "manager_creation_operation_was_successful",
      },
    });
  }

  static async logManagerBusinessCreated(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "manager_business_creation_operation_was_successful",
      },
    });
  }

  static async logManagerBusinessBankCreated(
    userId: string,
    ipAddress?: string | undefined,
  ): Promise<void> {
    await prisma.auditLogs.create({
      data: {
        userId,
        ipAddress,
        result: "success",
        status: "manager_business_bank_creation_operation_was_successful",
      },
    });
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
}
