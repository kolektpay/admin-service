import bcrypt from "bcrypt";
import prisma from "../config/database";
import ApiError from "../utils/apiError";
import { AuditModel } from "../models/audit.model";
import { StudentModel } from "../models/student.model";
import { config } from "../config/app";
import { isPastDate } from "../helpers/date.helper";

import { NotificationModel } from "../models/notifications.model";
import TokenManager from "../utils/token.manager";
import { IGuardianResponseForAuth } from "../interfaces/guardian.interfaces";
import { GuardianModel } from "../models/guardian.model";

let support_email = config.supportEmail;
const MAX_ATTEMPTS = 3;

export const authenticateGuardianService = async (
  email: string,
): Promise<IGuardianResponseForAuth | null> => {
  try {
    let guardian = await prisma.guardians.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        password: true,
        lastLoggedInAt: true,
        failedLoginCount: true,
        createdAt: true,
        passwordExpiresAt: true,
        mustChangePassword: true,
        phoneNumber: true,
      },
    });

    return guardian;
  } catch (error) {
    throw new ApiError(500, "Failed to authenticate guardian");
  }
};

export const guardianPasswordValidatorService = async (
  hashed_password: string,
  plain_text_password: string,
): Promise<boolean> => {
  let resultOutcome: boolean;
  try {
    resultOutcome = await bcrypt.compare(plain_text_password, hashed_password);
  } catch (error) {
    console.error("Password validation error:", error);
    return false;
  }

  return resultOutcome;
};

// Fetches the students mapped to a given guardian via the
// GuardianHasStudents junction table. Only selects safe, non-sensitive
// student fields — never password, otpSecret, failedLoginCount, etc.
// Kept as its own function so it can be reused or tested independently
// of the login flow.
export const getStudentsMappedToGuardianService = async (
  guardianId: bigint,
) => {
  const guardianStudentLinks = await prisma.guardianHasStudents.findMany({
    where: { guardianId },
    select: {
      students: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          registrationNumber: true,
          avatar: true,
          status: true,
          subclassId: true,
        },
      },
    },
  });

  return guardianStudentLinks.map((link) => link.students);
};

export const guardianLoginService = async (
  email: string,
  password: string,
  ipaddress: string | undefined,
  device: string | undefined,
  location: string | undefined,
  browser: string | undefined,
  os: string | undefined,
) => {
  try {
    let failed_login_count: number = 0;
    const guardian = await authenticateGuardianService(email);

    if (!guardian) {
      await AuditModel.logFailedLoginForGuardian(null, ipaddress);
      throw new ApiError(401, "Invalid login credentials");
    }

    const passwordCheck = await guardianPasswordValidatorService(
      guardian.password as string,
      password,
    );

    if (!passwordCheck) {
  

      let reason = "blocked due to multiple failed login attempts (3)";
      if (guardian.failedLoginCount + 1 >= 3) {
        await GuardianModel.incrementFailedLoginCountForGuardian(
          guardian.id,
          guardian.failedLoginCount,
          MAX_ATTEMPTS,
        );

        await GuardianModel.blockGuardianAccount(guardian.id, reason);
        await AuditModel.logBlockedGuardianAccount(
          guardian.id,
          ipaddress,
          reason,
        );

        throw new ApiError(
          403,
          "Account blocked due to multiple failed login attempts",
        );
      }

      failed_login_count = guardian.failedLoginCount;

      await AuditModel.logFailedLoginForGuardian(guardian.id, ipaddress);

      await GuardianModel.incrementFailedLoginCountForGuardian(
        guardian.id,
        failed_login_count,
        MAX_ATTEMPTS,
      );

      throw new ApiError(401, "Invalid login credentials");
    }

    if (guardian.status !== "active") {
      failed_login_count =
        await StudentModel.incrementFailedLoginCountForStudent(
          guardian.id,
          failed_login_count,
          MAX_ATTEMPTS,
        );

      if (guardian.failedLoginCount + 1 >= 3) {
        let reason =
          "multiple failed login attempts by guardian who is not yet active";
        await GuardianModel.blockGuardianAccount(guardian.id, reason);
        failed_login_count =
          await GuardianModel.incrementFailedLoginCountForGuardian(
            guardian.id,
            guardian.failedLoginCount,
            MAX_ATTEMPTS,
          );

        await AuditModel.logBlockedGuardianAccount(
          guardian.id,
          ipaddress,
          reason,
        );

        throw new ApiError(
          401,
          `An error occured. Please contact support at ${support_email}.`,
        );
      }

      failed_login_count =
        await GuardianModel.incrementFailedLoginCountForGuardian(
          guardian.id,
          failed_login_count,
          MAX_ATTEMPTS,
        );

      await AuditModel.logFailedLoginForGuardian(guardian.id, ipaddress);

      throw new ApiError(401, "Invalid login credentials");
    }

    if (
      guardian.passwordExpiresAt &&
      isPastDate(new Date(guardian.passwordExpiresAt))
    ) {
      let reason =
        "Password usage time has expired and password needs to be changed";
      failed_login_count =
        await GuardianModel.incrementFailedLoginCountForGuardian(
          guardian.id,
          guardian.failedLoginCount,
          MAX_ATTEMPTS,
        );

      await GuardianModel.expirePassword(guardian.id);

      await AuditModel.logBlockedGuardianAccount(guardian.id, ipaddress, reason);

      throw new ApiError(
        403,
        "Password has expired! Please change your password.",
      );
    }

    if (guardian.mustChangePassword) {
      throw new ApiError(401, "Please change your temporary password.");
    }

    const tokens = await TokenManager.generateTokens(guardian.id);

    await GuardianModel.resetFailedLoginCountForGuardian(guardian.id);

    await AuditModel.logSuccessfulLoginForGuardian(guardian.id, ipaddress);

    await NotificationModel.sendLoginNotificationForGuardian({
      email,
      firstName: guardian.firstName as string,
      lastName: guardian.lastName as string,
      ipAddress: ipaddress,
      device,
      location,
      browser,
      os,
    });

    // Pull the students mapped to this guardian so the frontend gets
    // them back alongside the login/session info in one response.
    const students = await getStudentsMappedToGuardianService(guardian.id);

    const guardianInfo = { ...guardian, tokens };
    const { password: _removed, ...safeGuardianInfo } = guardianInfo;

    return {
      safeGuardianInfo,
      students,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Unexpected login error:", error);
    throw new ApiError(500, "Login failed");
  }
};