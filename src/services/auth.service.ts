import bcrypt from "bcrypt";
import TokenManager from "../utils/token.manager";

import { IUserResponse } from "../interfaces/user.interface";
import { isPastDate } from "../helpers/date.helper";
import { config } from "../config/app";
import { AuditModel } from "../models/audit.model";
import { UserModel } from "../models/user.model";
import { NotificationModel } from "../models/notifications.model";

import prisma from "../config/database";
import ApiError from "../utils/apiError";

let support_email = config.supportEmail;
const MAX_ATTEMPTS = 3;

export const authenticateUserService = async (
  email: string,
): Promise<IUserResponse | null> => {
  try {
    let user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        status: true,
        password: true,
        passwordExpiresAt: true,
        updatedAt: true,
        failedLoginCount: true,
        totpEnabled: true,
        totpTempExpiresAt: true,
        totpTempSecret: true,
        totpSecret: true,
        totpRequired: true,
        mustChangePassword: true,
      },
    });

    return user;
  } catch (error) {
    throw new ApiError(500, "Failed to authenticate user.");
  }
};

export const passwordValidatorService = async (
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

export const logInService = async (
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
    const user = await authenticateUserService(email);

    if (!user) {
      await AuditModel.logFailedLogin(null, ipaddress);
      throw new ApiError(401, "Invalid login credentials");
    }

    const passwordCheck = await passwordValidatorService(
      user.password,
      password,
    );

    if (!passwordCheck) {
  

      let reason = "blocked due to multiple failed login attempts (3)";
      if (user.failedLoginCount + 1 >= 3) {
        await UserModel.incrementFailedLoginCount(
          user.id,
          user.failedLoginCount,
          MAX_ATTEMPTS,
        );

        await UserModel.blockAccount(user.id, reason);
        await AuditModel.logBlockedAccount(user.id, ipaddress, reason);

        throw new ApiError(
          403,
          `An error occured. Please contact support at ${support_email}.`,
        );
      }

      failed_login_count = user.failedLoginCount;

      await AuditModel.logFailedLogin(user.id, ipaddress);

      await UserModel.incrementFailedLoginCount(
        user.id,
        failed_login_count,
        MAX_ATTEMPTS,
      );

      throw new ApiError(401, "Invalid login credentials");
    }

    if (user.status !== "active") {
  
      failed_login_count = await UserModel.incrementFailedLoginCount(
        user.id,
        failed_login_count,
        MAX_ATTEMPTS,
      );

      if (user.failedLoginCount + 1 >= 3) {
         
        let reason =
          "multiple failed login attempts by user who is not yet active";
        await UserModel.blockAccount(user.id, reason);
        failed_login_count = await UserModel.incrementFailedLoginCount(
          user.id,
          user.failedLoginCount,
          MAX_ATTEMPTS,
        );

        await AuditModel.logBlockedAccount(user.id, ipaddress, reason);

        throw new ApiError(
          401,
          `An error occured. Please contact support at ${support_email}.`,
        );
      }

      failed_login_count = await UserModel.incrementFailedLoginCount(
        user.id,
        failed_login_count,
        MAX_ATTEMPTS,
      );

      await AuditModel.logFailedLogin(user.id, ipaddress);

      throw new ApiError(401, "Invalid login credentials");
    }

    if (
      user.passwordExpiresAt &&
      isPastDate(new Date(user.passwordExpiresAt))
    ) {

     
      let reason =
        "Password usage time has expired and password needs to be changed";
      failed_login_count = await UserModel.incrementFailedLoginCount(
        user.id,
        user.failedLoginCount,
        MAX_ATTEMPTS,
      );

      await UserModel.expirePassword(user.id);

      await AuditModel.logBlockedAccount(user.id, ipaddress, reason);

      throw new ApiError(
        403,
        "Password has expired! Please change your password.",
      );
    }

    const tokens = await TokenManager.generateTokens(user.id);

    await UserModel.resetFailedLoginCount(user.id);

    await AuditModel.logSuccessfulLogin(user.id, ipaddress);

    await NotificationModel.sendLoginNotification({
      email,
      firstName: user.firstName,
      lastName: user.lastName,
      ipAddress: ipaddress,
      device,
      location,
      browser,
      os,
    });

    const userInfo = { ...user, tokens };

    return {
      userInfo,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Unexpected login error:", error);
    throw new ApiError(500, "Login failed");
  }
};
