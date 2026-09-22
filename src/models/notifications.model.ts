import { EmailStatus } from "@prisma/client";
import prisma from "../config/database";
import { EmailUser } from "../utils/emailTemplate";
// import { Emails } from "../utils/emailTemplate";

// const email = Emails.getEmail("PAYMENT_SUCCESSFUL");

interface LoginNotificationData {
  email: string;
  firstName: string;
  lastName: string;
  ipAddress?: string;
  device?: string;
  location?: string;
  browser?: string;
  os?: string;
}

interface PasswordResetNotificationData {
  email: string;
  fullName: string;
  resetLink: string;
}

interface OtpNotificationData {
  otp: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface MustChangePasswordNotificationData {
  email: string;
  firstName: string;
  lastName: string;
  generatedPassword: string;
  resetLink: string;
}

export class NotificationModel {
  /**
   * Send login notification email
   */
  static async sendLoginNotification(
    data: LoginNotificationData,
  ): Promise<void> {
    const clientData = Object.values(data).join(",");

    await prisma.notifications.create({
      data: {
        subject: "New_login_detected",
        content: clientData,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,

        type: "login_email",
        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendLoginNotificationForStudent(
    data: LoginNotificationData,
  ): Promise<void> {
    const clientData = Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject: "student_login_detected",
        content: clientData,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "login_email",
        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendLoginNotificationForGuardian(
    data: LoginNotificationData,
  ): Promise<void> {
    const clientData = Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject: "guardian_login_detected",
        content: clientData,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "login_email",
        status: EmailStatus.PENDING,
      },
    });
  }

  /**
   * Send password reset email notification
   */
  static async sendPasswordResetNotification(
    data: PasswordResetNotificationData,
  ): Promise<void> {
    const passwordResetData = Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject: "Reset Password",
        content: passwordResetData,
        toRecipientAddress: data.email,
        toRecipientName: data.fullName,
        type: "pass_reset_email",
        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendOtpNotification(data: OtpNotificationData): Promise<void> {
    const otpData = Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject: "Otp Notification on User creation",
        content: otpData,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "otp_email",
        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendTempPasswordNotification(
    data: MustChangePasswordNotificationData,
  ): Promise<void> {
    const mustChangeTemporaryPasswordData = Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject:
          "Temporary password generated after user creation that must be changed on login",
        content: mustChangeTemporaryPasswordData,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "change_password_email",

        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendTempPasswordNotificationForStudents(
    data: MustChangePasswordNotificationData,
  ): Promise<void> {
    const mustChangeTemporaryPasswordDataForStudents =
      Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject:
          "Temporary password generated after student creation that must be changed on login",
        content: mustChangeTemporaryPasswordDataForStudents,
        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "change_password_email",

        status: EmailStatus.PENDING,
      },
    });
  }

  static async sendTempPasswordNotificationForGuardians(
    data: MustChangePasswordNotificationData,
  ): Promise<void> {
    const mustChangeTemporaryPasswordDataForGuardians =
      Object.values(data).join(",");
    await prisma.notifications.create({
      data: {
        subject:
          "Temporary password generated after guardian creation that must be changed on login",
        content: mustChangeTemporaryPasswordDataForGuardians,

        toRecipientAddress: data.email,
        toRecipientName: `${data.firstName} ${data.lastName}`,
        type: "change_password_email",

        status: EmailStatus.PENDING,
      },
    });
  }

  static async retrieveOtpFromDb(email: string): Promise<string | null> {
    const user = await prisma.notifications.findFirst({
      where: { toRecipientAddress: email },
      select: {
        content: true,
      },
    });

    return (user?.content as string) ?? null;
  }
  static async getAllPersonnelWhoCanApprovePaymentItemsByBusinessId(
    businessId: bigint,
  ) {
    return await prisma.users.findMany({
      where: {
        userHasRoles: {
          some: {
            role: {
              permissions: {
                some: {
                  permission: {
                    name: "admin.payment_item.approve",
                  },
                },
              },
            },
          },
        },
        businesses: {
          some: {
            businessId,
          },
        },
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  static async notifyUsersWithPaymentApprovalPrivilege(
    emailbody: string,
    emailSubject: string,
    userEmails: EmailUser[],
  ): Promise<void> {
    if (userEmails.length === 0) {
      return;
    }

    const toRecipientAddress = userEmails.map((user) => user.email).join(",");

    const toRecipientName = userEmails
      .map((user) => `"${user.firstName} ${user.lastName}"`)
      .join(", ");

    await prisma.notifications.create({
      data: {
        subject: emailSubject,
        content: emailbody,
        toRecipientAddress: toRecipientAddress,
        toRecipientName: toRecipientName,
        type: "payment_approval_email",
        status: EmailStatus.PENDING,
      },
    });
  }
}
