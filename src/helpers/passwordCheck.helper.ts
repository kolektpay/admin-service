
import { IUserResponse } from "../interfaces/user.interface";

import { AuditModel } from "../models/audit.model";
import { UserModel } from "../models/user.model";

import ApiError from "../utils/apiError";

interface PasswordCheckResult {
  success: boolean;
  accountBlocked?: boolean;
  failedLoginCount?: number;
}

export const passwordCheckerAndLoggingFunction = async (
  user: IUserResponse,
  ipaddress?: string,
): Promise<PasswordCheckResult> => {
  let failedLoginCount = user.failedLoginCount + 1;
  const MAX_ATTEMPTS = 3;
  try {
    if (failedLoginCount >= MAX_ATTEMPTS) {
      let reason = "multiple failed login attempts";
      await UserModel.blockAccount(user.id, reason);
      await AuditModel.logFailedLogin(user.id, ipaddress);

      return { success: false, accountBlocked: true, failedLoginCount };
    }

    failedLoginCount = Number(failedLoginCount);

    await UserModel.incrementFailedLoginCount(
      user.id,
      failedLoginCount,
      MAX_ATTEMPTS,
    );
    await AuditModel.logFailedLogin(user.id, ipaddress);

    return { success: false, accountBlocked: false, failedLoginCount };
  } catch {
    throw new ApiError(500, "Failed to ascertain failed password attempts.");
  }
};


