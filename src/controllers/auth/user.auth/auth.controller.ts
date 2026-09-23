import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../../utils/response.util";
import {
  authenticateUserService,
  logInService,
  passwordValidatorService,
} from "../../../services/auth.service";
import TokenManager from "../../../utils/token.manager";
import { extractRequestMetadata } from "../../../utils/request.metadata";
import TotpManager from "../../../utils/twoFactorManager";
import {
  FinalUserInfoInterface,
  KolektSuperAdminLoginInfoInterface,
  TokenPair,
  UserLoginInfoIfNo2faInterface,
  UserLoginInfoInterface,
} from "../../../interfaces/auth.interface";
import { UserModel } from "../../../models/user.model";
import { PasswordResetTokenManager } from "../../../utils/passwordResetManager";
import { UserPasswordResetModel } from "../../../models/userPasswordReset.model";
import { NotificationModel } from "../../../models/notifications.model";
import { PasswordHistoryModel } from "../../../models/passwordHistory.model";
import bcrypt from "bcrypt";
import { passwordHistoryChecker } from "../../../utils/passwordHistoryChecker";
import { AuditModel } from "../../../models/audit.model";
import { UserRoleModel } from "../../../models/userHasRole.model";
import { RolePermissionModel } from "../../../models/permissions.model";
import { ICreateUserDTO } from "../../../interfaces/user.interface";
import { createUserBeforeOtpVerify } from "../../../services/user.service";
import { IServiceResponse } from "../../../interfaces/common.interface";
import { ICreateBusinessDTO } from "../../../interfaces/business.interface";
import { createUserBusiness } from "../../../services/userbusiness.service";
import { TempPasswordTokenManager } from "../../../utils/tempPasswordTokenManager";
import OtpGenerator from "../../../utils/otpRegistrationManager";
import dotenv from "dotenv";
import { onBoardTrackerType } from "@prisma/client";

import { getCurrentTimestamp } from "../../../helpers/date.helper";
import { passwordCheckerAndLoggingFunction } from "../../../helpers/passwordCheck.helper";
import { isKolektSuperAdmin } from "../../../helpers/kolektSuperAdminDbCheck.helper";
import { BusinessTypesModel } from "../../../models/businessTypes.model";

dotenv.config();

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Admin / Staff login
 *     description: Authenticates an admin or staff user and returns authentication tokens and user permissions.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@kolekt.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account is not authorized to log in
 *       429:
 *         description: Too many login attempts
 *       500:
 *         description: Internal server error
 */
export const loginHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, password, code } = req.body;

  const { ip } = extractRequestMetadata(req);

  const userInfo = await authenticateUserService(email);
  const isUserKolektSuperAdmin = await isKolektSuperAdmin(email);

  if (!userInfo) {
    return errorResponse(res, "invalid login details", 404);
  } else if (
    !userInfo.totpSecret &&
    userInfo.status === "active" &&
    !userInfo.mustChangePassword
  ) {
    const passwordCheck = await passwordValidatorService(
      userInfo.password,
      password,
    );

    if (passwordCheck) {
      const userLoginInfoIfNo2fa: UserLoginInfoIfNo2faInterface = {
        name: userInfo.firstName + " " + userInfo.lastName,
        userEmail: userInfo.email,
        totpEnabled: userInfo.totpEnabled as boolean,
        totpRequired: userInfo.totpRequired as boolean,
      };

      return successResponse(
        res,
        "Please proceed to 2fa setup process",
        userLoginInfoIfNo2fa,
      );
    }

    const result = await passwordCheckerAndLoggingFunction(userInfo, ip);

    if (result.accountBlocked) {
      return errorResponse(
        res,
        `Account blocked due to multiple failed login attempts. Please contact support at ${process.env.SUPPORT_EMAIL}`,
        403,
      );
    }

    return errorResponse(
      res,
      `Invalid credentials. ${3 - result.failedLoginCount!} attempts remaining`,
      401,
    );
  } else if (!code && userInfo.mustChangePassword && userInfo.totpSecret) {
    const passwordCheck = await passwordValidatorService(
      userInfo.password,
      password,
    );

    if (passwordCheck) {
      return successResponse(
        res,
        "Please change your old password to a new one",
      );
    }

    const result = await passwordCheckerAndLoggingFunction(userInfo, ip);

    if (result.accountBlocked) {
      return errorResponse(
        res,
        `Account blocked due to multiple failed login attempts. Please contact support at ${process.env.SUPPORT_EMAIL}`,
        403,
      );
    }

    return errorResponse(
      res,
      `Invalid credentials. ${3 - result.failedLoginCount!} attempts remaining`,
      401,
    );
  } else if (!code && userInfo.totpSecret) {
    const response = {
      totpEnabled: userInfo.totpEnabled,
      totpRequired: userInfo.totpRequired,
    };

    const passwordCheck = await passwordValidatorService(
      userInfo.password,
      password,
    );

    if (passwordCheck) {
      console.log(response);

      //this will be uncommented if u wanna enforce 2fa for all users with totpSecret
      // return successResponse(
      //   res,
      //   "Please enter 2fa verification code",
      //   response,
      // );

      //this and everything below shiould be deleted if u wanna enforce 2fa for all users with totpSecret
      // const isValid = await TotpManager.verifyToken(
      //   userInfo.totpSecret as string,
      //   code,
      // );

      // if (!isValid) {
      //   return errorResponse(res, "invalid token", 401);
      // }

      const { ip, location, device, browser, os } = extractRequestMetadata(req);

      try {
        const user = await logInService(
          email,
          password,
          ip,
          location,
          device,
          browser,
          os,
        );

        if (!userInfo || !user) {
          return errorResponse(res, "Invalid login details", 401);
        }

        const userRoles = await UserRoleModel.getUserRoles(userInfo.id);

        const actionsArray: string[] = [];
        const menusArray: string[] = [];
        const rolesArray: string[] = [];
        const roleIdArray: bigint[] = [];

        if (!userRoles || userRoles.length === 0) {
          return errorResponse(res, "No roles were assigned to this user", 404);
        }

        userRoles.forEach((userRole) => {
          if (userRole.role) {
            rolesArray.push(userRole.role.name);
          }

          if (userRole.roleId) {
            roleIdArray.push(userRole.roleId);
          }
        });

        const allUserPermissions =
          await RolePermissionModel.getRolePermissions(roleIdArray);

        allUserPermissions.forEach((element) => {
          element.forEach((item) => {
            if (item.permission.type === "action") {
              actionsArray.push(item.permission.name);
            } else {
              menusArray.push(item.permission.name);
            }
          });
        });

        const userLoginInfo: UserLoginInfoInterface = {
          name: userInfo.firstName + " " + userInfo.lastName,
          accessToken: user.userInfo.tokens.accessToken,
          refreshToken: user.userInfo.tokens.refreshToken,
          userEmail: userInfo.email,
          totpEnabled: userInfo.totpEnabled as boolean,
        };

        const kolektSuperAdminLoginInfo: KolektSuperAdminLoginInfoInterface = {
          name: userInfo.firstName + " " + userInfo.lastName,
          role: rolesArray,
          permissions: {
            menus: menusArray,
            actions: actionsArray,
          },
          accessToken: user.userInfo.tokens.accessToken,
          refreshToken: user.userInfo.tokens.refreshToken,
          userEmail: userInfo.email,
          totpEnabled: userInfo.totpEnabled as boolean,
        };

        if (isUserKolektSuperAdmin) {
          return successResponse(
            res,
            "login successful",
            kolektSuperAdminLoginInfo,
          );
        }

        return successResponse(res, "login successful", userLoginInfo);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid login details";

        const statusCode = message.includes("Account blocked") ? 403 : 401;

        return errorResponse(res, message, statusCode);
      }
    }

    const result = await passwordCheckerAndLoggingFunction(userInfo, ip);

    if (result.accountBlocked) {
      return errorResponse(
        res,
        `Account blocked due to multiple failed login attempts. Please contact support at ${process.env.SUPPORT_EMAIL}`,
        403,
      );
    }

    return errorResponse(
      res,
      `Invalid credentials. ${3 - result.failedLoginCount!} attempts remaining`,
      401,
    );
  } else if (
    !userInfo.totpSecret &&
    userInfo.status === "inactive" &&
    userInfo.mustChangePassword
  ) {
    const passwordCheck = await passwordValidatorService(
      userInfo.password,
      password,
    );

    if (passwordCheck) {
      return errorResponse(
        res,
        "Please change your temporary password to a new password.",
      );
    }

    const result = await passwordCheckerAndLoggingFunction(userInfo, ip);

    if (result.accountBlocked) {
      return errorResponse(
        res,
        `Account blocked due to multiple failed login attempts. Please contact support at ${process.env.SUPPORT_EMAIL}`,
        403,
      );
    }

    return errorResponse(
      res,
      `Invalid credentials. ${3 - result.failedLoginCount!} attempts remaining`,
      401,
    );
  } else if (
    !userInfo.totpSecret &&
    userInfo.status === "inactive" &&
    !userInfo.mustChangePassword
  ) {
    const passwordCheck = await passwordValidatorService(
      userInfo.password,
      password,
    );

    if (passwordCheck) {
      return successResponse(
        res,
        "Please proceed to 2fa set up to complete user creation process",
      );
    }

    const result = await passwordCheckerAndLoggingFunction(userInfo, ip);

    if (result.accountBlocked) {
      return errorResponse(
        res,
        `Account blocked due to multiple failed login attempts. Please contact support at ${process.env.SUPPORT_EMAIL}`,
        403,
      );
    }

    return errorResponse(
      res,
      `Invalid credentials. ${3 - result.failedLoginCount!} attempts remaining`,
      401,
    );
  } else {
    const isValid = await TotpManager.verifyToken(
      userInfo.totpSecret as string,
      code,
    );

    if (!isValid) {
      return errorResponse(res, "invalid token", 401);
    }

    const { ip, location, device, browser, os } = extractRequestMetadata(req);

    try {
      const user = await logInService(
        email,
        password,
        ip,
        location,
        device,
        browser,
        os,
      );

      if (!userInfo || !user) {
        return errorResponse(res, "Invalid login details", 401);
      }

      const userRoles = await UserRoleModel.getUserRoles(userInfo.id);

      const actionsArray: string[] = [];
      const menusArray: string[] = [];
      const rolesArray: string[] = [];
      const roleIdArray: bigint[] = [];

      if (!userRoles || userRoles.length === 0) {
        return errorResponse(res, "No roles were assigned to this user", 404);
      }

      userRoles.forEach((userRole) => {
        if (userRole.role) {
          rolesArray.push(userRole.role.name);
        }

        if (userRole.roleId) {
          roleIdArray.push(userRole.roleId);
        }
      });

      const allUserPermissions =
        await RolePermissionModel.getRolePermissions(roleIdArray);

      allUserPermissions.forEach((element) => {
        element.forEach((item) => {
          if (item.permission.type === "action") {
            actionsArray.push(item.permission.name);
          } else {
            menusArray.push(item.permission.name);
          }
        });
      });

      const userLoginInfo: UserLoginInfoInterface = {
        name: userInfo.firstName + " " + userInfo.lastName,
        accessToken: user.userInfo.tokens.accessToken,
        refreshToken: user.userInfo.tokens.refreshToken,
        userEmail: userInfo.email,
        totpEnabled: userInfo.totpEnabled as boolean,
      };

      const kolektSuperAdminLoginInfo: KolektSuperAdminLoginInfoInterface = {
        name: userInfo.firstName + " " + userInfo.lastName,
        role: rolesArray,
        permissions: {
          menus: menusArray,
          actions: actionsArray,
        },
        accessToken: user.userInfo.tokens.accessToken,
        refreshToken: user.userInfo.tokens.refreshToken,
        userEmail: userInfo.email,
        totpEnabled: userInfo.totpEnabled as boolean,
      };

      if (isUserKolektSuperAdmin) {
        return successResponse(
          res,
          "login successful",
          kolektSuperAdminLoginInfo,
        );
      }

      return successResponse(res, "login successful", userLoginInfo);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid login details";

      const statusCode = message.includes("Account blocked") ? 403 : 401;

      return errorResponse(res, message, statusCode);
    }
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generates a new access and refresh token using a valid refresh token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Tokens generated successfully.
 *       401:
 *         description: Refresh token is missing, invalid or revoked.
 *     security: []
 */
export const authenticateRefreshTokenHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return errorResponse(res, "No refresh token!", 401);
    }

    const verification = await TokenManager.verifyRefreshToken(
      refreshToken,
      "refresh",
    );

    if (verification.tokenData.revoked) {
      return errorResponse(res, "Token revoked!", 401);
    }

    if (!verification.tokenData.userId) {
      return errorResponse(res, "Invalid refresh token!", 401);
    }

    const newTokens: TokenPair = await TokenManager.generateTokens(
      verification.decoded.userId as string,
    );

    return successResponse(res, "Tokens generated successfully!", newTokens);
  } catch {
    return errorResponse(res, "Invalid refresh token!", 401);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/logout:
 *   post:
 *     summary: Logout user
 *     description: Revokes all tokens belonging to the authenticated user.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: User logged out successfully.
 *       401:
 *         description: User ID not found.
 *       500:
 *         description: Logout failed.
 *     security:
 *       - bearerAuth: []
 */
export const logoutHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { ip } = extractRequestMetadata(req);
  const userId = req.userId;

  try {
    if (!userId) {
      return errorResponse(res, "No user ID!", 401);
    }

    await TokenManager.revokeAllUserTokens(userId as string);
    await AuditModel.logUserLogout(userId as string, ip);

    return successResponse(res, "User logged out successfully!", 200);
  } catch {
    return errorResponse(res, "Logout failed!", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/setup/2fa:
 *   post:
 *     summary: Setup 2FA
 *     description: Generates a temporary TOTP secret and QR code for the user.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: 2FA setup initiated successfully.
 *       401:
 *         description: Invalid user.
 *       500:
 *         description: Failed to initiate 2FA setup.
 *     security: []
 */
export const setupTwoFactorHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { ip } = extractRequestMetadata(req);
  const { email } = req.body;
  const issuer = "Kolekt";

  try {
    const response = await TotpManager.setup2faData(email, issuer);

    const userInfo = await authenticateUserService(email);

    if (!userInfo) {
      return errorResponse(res, "Invalid login details.", 401);
    }

    await UserModel.saveTempTotpSecret(userInfo.id, response.secret, 10);

    await AuditModel.logSetupTwoFactorOperation(userInfo.id, ip);

    return successResponse(
      res,
      "2FA setup initiated. Please scan the QR code.",
      {
        qr: response.qrCode,
        secret: response.secret,
      },
    );
  } catch {
    return errorResponse(res, "Failed to initiate 2FA setup", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/enable/2fa:
 *   post:
 *     summary: Enable 2FA
 *     description: Verifies the TOTP code and permanently enables 2FA for the user.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA enabled successfully.
 *       400:
 *         description: TOTP has expired.
 *       401:
 *         description: Invalid user.
 *       422:
 *         description: Invalid 2FA code.
 *       500:
 *         description: Failed to enable 2FA.
 *     security: []
 */
export const enableTwoFactorHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, code } = req.body;
  const { ip } = extractRequestMetadata(req);

  try {
    const userInfo = await authenticateUserService(email);

    if (!userInfo) {
      return errorResponse(res, "Invalid login details.", 401);
    }

    if (
      !userInfo.totpTempExpiresAt ||
      getCurrentTimestamp() > userInfo.totpTempExpiresAt
    ) {
      return errorResponse(res, "Totp has expired!", 400);
    }

    const isValid = await TotpManager.verifyToken(
      userInfo.totpTempSecret!,
      code,
    );

    if (!isValid) {
      return errorResponse(res, "Invalid 2FA code", 422);
    }

    await UserModel.enableTotpForUser(userInfo.id, userInfo.totpTempSecret!);

    await UserModel.toggleTotpEnabled(userInfo.id, true);
    await UserModel.changeUserStatusToActive(userInfo.id);

    const finalUserInfo = await authenticateUserService(email);

    const response: FinalUserInfoInterface = {
      id: finalUserInfo!.id,
      firstName: finalUserInfo!.firstName,
      email: finalUserInfo!.email,
      totpEnabled: finalUserInfo!.totpEnabled,
    };

    await AuditModel.logEnableTwoFactorOperation(finalUserInfo!.id, ip);

    return successResponse(res, "2FA enabled successfully", response);
  } catch {
    return errorResponse(res, "Failed to enable 2FA", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/forgot-password:
 *   post:
 *     summary: Forgot password
 *     description: Generates a password reset token and sends reset instructions to the user's email.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset instructions sent.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Failed to reset password.
 *     security: []
 */
export const forgotPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body;
  const { ip } = extractRequestMetadata(req);

  try {
    const userInfo = await authenticateUserService(email);

    if (!userInfo) {
      return errorResponse(res, "User not found.", 404);
    }

    const userToken = await PasswordResetTokenManager.generate();

    await UserPasswordResetModel.createResetToken(
      userInfo.id,
      userToken.token,
      userToken.expiresAt,
    );

    const resetLink = `${process.env.FORGOT_PASSWORD_URL}?whoami=${userToken.token}`;

    await NotificationModel.sendPasswordResetNotification({
      email: userInfo.email,
      fullName: userInfo.firstName,
      resetLink,
    });

    await UserModel.changeUserStatusToPending(userInfo.id);

    await AuditModel.logForgotPaswordOperation(userInfo.id, ip);

    await UserModel.mustChangePasswordSetToTrueToForcePasswordChange(
      userInfo.id,
    );

    return successResponse(res, "check email for password reset instructions");
  } catch {
    return errorResponse(res, "Failed to reset password", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Resets a user's password using a valid password reset token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: 8f7c4c1a...
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *     responses:
 *       200:
 *         description: Password successfully changed.
 *       400:
 *         description: Passwords do not match or invalid user/token association.
 *       404:
 *         description: Password reset token not found.
 *       409:
 *         description: Password has been used before.
 *       410:
 *         description: Password reset token has expired or is invalid.
 *       500:
 *         description: Failed to reset password.
 *     security: []
 */
export const resetPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token, password, confirmPassword } = req.body;
  const { ip } = extractRequestMetadata(req);

  try {
    if (password !== confirmPassword) {
      return errorResponse(res, "Passwords do not match", 400);
    }

    const userTokenInfo = await UserPasswordResetModel.obtainToken(token);

    if (!userTokenInfo) {
      return errorResponse(
        res,
        "Incorect token was provided as user password reset info not found.",
        404,
      );
    }

    if (!userTokenInfo.userId) {
      return errorResponse(
        res,
        "Reset token is not associated with a valid user",
        400,
      );
    }

    const isExpired = await PasswordResetTokenManager.isExpired(
      new Date(userTokenInfo.tokenExpiresAt),
    );

    if (isExpired) {
      return errorResponse(
        res,
        "Password change failed as token has expired!",
        410,
      );
    }

    const isValid = await PasswordResetTokenManager.verify(
      token,
      userTokenInfo.token,
    );

    if (!isValid) {
      return errorResponse(res, "Token is invalid or expired", 410);
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const usedBefore = await passwordHistoryChecker(
      userTokenInfo.userId,
      hashedPassword,
    );

    if (usedBefore.success) {
      return errorResponse(res, "Password has been used before", 409);
    }

    await PasswordHistoryModel.createPasswordHistory(
      userTokenInfo.userId,
      hashedPassword,
    );

    await UserModel.changeUserStatusToActive(userTokenInfo.userId);

    await UserModel.updatePasswordAndResetMustChangeToFalse(
      userTokenInfo.userId,
      hashedPassword,
    );

    await AuditModel.logPasswordChange(userTokenInfo.userId, ip);

    await AuditModel.logResetPaswordOperation(userTokenInfo.userId, ip);

    return successResponse(res, "Password successfully changed", 200);
  } catch {
    return errorResponse(res, "Failed to reset password", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/live-email-check:
 *   get:
 *     summary: Check email availability
 *     description: Checks whether an email address is already registered.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         example: user@example.com
 *         description: Email address to check.
 *     responses:
 *       200:
 *         description: Email availability result.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: email taken
 *                 data:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Internal server error.
 *     security: []
 */
export const emailLiveCheckHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const email = req.query.email as string;

  try {
    let emailCheck: boolean;

    const emailFromDb = await authenticateUserService(email);

    if (emailFromDb) {
      emailCheck = true;

      return successResponse(res, "email taken.", emailCheck);
    }

    emailCheck = false;

    return successResponse(res, "email not taken.", emailCheck);
  } catch (error) {
    console.log(error);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/register:
 *   post:
 *     summary: Register user
 *     description: |
 *       Handles the multi-step user registration process.
 *       step_1 creates the user and sends an OTP.
 *       step_2 creates the business.
 *       step_3 adds the business bank account.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stepper
 *             properties:
 *               stepper:
 *                 type: string
 *                 enum:
 *                   - step_1
 *                   - step_2
 *                   - step_3
 *                 example: step_1
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: Required for step_1.
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *                 description: Required for step_1.
 *               firstName:
 *                 type: string
 *                 example: John
 *                 description: Required for step_1.
 *               lastName:
 *                 type: string
 *                 example: Doe
 *                 description: Required for step_1.
 *               userEmail:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: Required for step_2.
 *               name:
 *                 type: string
 *                 example: Acme Ltd
 *                 description: Business name required for step_2.
 *               rcNumber:
 *                 type: string
 *                 example: RC123456
 *                 description: Business RC number required for step_2.
 *               businessId:
 *                 type: integer
 *                 example: 1
 *                 description: Required for step_3.
 *               walletId:
 *                 type: integer
 *                 example: 1
 *                 description: Required for step_3.
 *               bankName:
 *                 type: string
 *                 example: First Bank
 *                 description: Required for step_3.
 *               accountName:
 *                 type: string
 *                 example: John Doe
 *                 description: Required for step_3.
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *                 description: Required for step_3.
 *     responses:
 *       200:
 *         description: Registration step completed successfully.
 *       400:
 *         description: Invalid request or user already exists.
 *       404:
 *         description: User or required resource not found.
 *       500:
 *         description: Unable to register user.
 *     security: []
 */
export const registerUserWithKolektSuperAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { ip } = extractRequestMetadata(req);

    let request: ICreateUserDTO;
    let serviceResponse: IServiceResponse;

    const businessId = req.body.businessId;
    // const walletId = req.body.walletId;
    const stepper: string = req.body.stepper;

    delete req.body.stepper;

    switch (stepper.toLowerCase()) {
      case "step_2": {
        let request: ICreateBusinessDTO;
        request = req.body;

        const userId = await authenticateUserService(req.body.userEmail);

        const finalRequest = {
          ...request,
          ipAddress: ip,
          stepper: stepper,
        };

        serviceResponse = await createUserBusiness(finalRequest);

        if (!userId) {
          return errorResponse(
            res,
            "no user exists with this email address.",
            404,
          );
        }

        break;
      }

      case "step_3": {
        // const addNewBankToBusinessData: any = {
        //   walletId: Number(walletId),
        //   businessId: Number(businessId),
        //   bankName: req.body.bankName,
        //   accountName: req.body.accountName,
        //   accountNumber: Number(req.body.accountNumber),
        // };

        const fetchedUserId = await UserRoleModel.getUserIdByBusinessId(
          Number(businessId),
        );

        try {
          // await addNewBankToBusiness(addNewBankToBusinessData);

          await UserModel.setOnboardStep(
            fetchedUserId!,
            stepper as onBoardTrackerType,
          );

          await AuditModel.logManagerBusinessBankCreated(fetchedUserId!, ip);

          serviceResponse = {
            success: true,
            code: 200,
            message: "New bank account added for business.",
          };
        } catch {
          serviceResponse = {
            success: false,
            code: 500,
            message: "Unable to add bank account to business.",
          };
        }

        break;
      }

      default: {
        request = req.body;

        const firstCheckUserInfo = await authenticateUserService(request.email);

        if (firstCheckUserInfo) {
          return errorResponse(res, "User already exists on the db", 400);
        }

        try {
          serviceResponse = await createUserBeforeOtpVerify(request);

          interface OtpNotificationData {
            otp: string;
            email: string;
            firstName: string;
            lastName: string;
          }

          const fetchUserInfo = await authenticateUserService(request.email);

          const generatedOtp = await OtpGenerator.generateAndStoreOtp(
            request.email,
          );

          if (fetchUserInfo && generatedOtp) {
            const otpData: OtpNotificationData = {
              otp: generatedOtp,
              email: fetchUserInfo.email,
              firstName: fetchUserInfo.firstName,
              lastName: fetchUserInfo.lastName,
            };

            await NotificationModel.sendOtpNotification(otpData);
          }
        } catch {
          serviceResponse = {
            success: false,
            code: 500,
            message: "Could not create user.",
          };
        }

        break;
      }
    }

    if (serviceResponse.success) {
      return successResponse(
        res,
        serviceResponse.message,
        serviceResponse.code,
      );
    }

    return errorResponse(res, serviceResponse.message, serviceResponse.code);
  } catch (error) {
    console.log(error);

    return errorResponse(res, "unable to register user", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/must-change-password:
 *   post:
 *     summary: Change default password
 *     description: |
 *       Allows a user to replace their default or temporary password
 *       with a new password. The newPassword and confirmNewPassword
 *       fields are validated by middleware before this handler executes.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - defaultPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               defaultPassword:
 *                 type: string
 *                 format: password
 *                 example: Default123!
 *                 description: The temporary/default password provided to the user.
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *                 description: The new password.
 *               confirmNewPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *                 description: Must match newPassword.
 *     responses:
 *       200:
 *         description: Default password changed successfully.
 *       400:
 *         description: Invalid login details, incorrect default password or password reuse.
 *       500:
 *         description: Failed to reset password.
 *     security: []
 */
export const mustChangePasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, defaultPassword, confirmNewPassword } = req.body;

  const { ip } = extractRequestMetadata(req);

  try {
    const userInfo = await authenticateUserService(email);

    if (!userInfo) {
      return errorResponse(res, "Invalid login details", 400);
    }

    const isDefaultPasswordCorrect =
      await TempPasswordTokenManager.verifyPasswordToken(
        defaultPassword,
        userInfo.password,
      );

    if (!isDefaultPasswordCorrect) {
      return errorResponse(res, "Inputed default password is incorrect.", 400);
    }

    const isSameAsOldPasswords = await passwordHistoryChecker(
      userInfo.id,
      confirmNewPassword,
    );

    if (isSameAsOldPasswords.success) {
      return errorResponse(
        res,
        "New password cannot be same as any old passwords",
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(confirmNewPassword, saltRounds);

    await UserModel.updatePasswordAndResetMustChangeToFalse(
      userInfo.id,
      hashedPassword,
    );

    await PasswordHistoryModel.createPasswordHistory(
      userInfo.id,
      hashedPassword,
    );

    await AuditModel.logMustChangePasswordOperation(userInfo.id, ip);

    return successResponse(
      res,
      "Default password has been successfully changed",
      200,
    );
  } catch {
    return errorResponse(res, "Failed to reset password", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/verify-otp:
 *   post:
 *     summary: Verify registration OTP
 *     description: Verifies the OTP sent to the user's email during registration and updates the onboarding step to step_1.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "482910"
 *     responses:
 *       200:
 *         description: OTP verified successfully.
 *       400:
 *         description: OTP verification failed.
 *       404:
 *         description: No user exists with this email.
 *       500:
 *         description: Failed to verify OTP.
 *     security: []
 */
export const otpVerifyHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, otp } = req.body;

  const stepper = "step_1" as onBoardTrackerType;

  try {
    const userInfo = await authenticateUserService(email);

    if (!userInfo) {
      return errorResponse(res, "No user exists with this email", 404);
    }

    const isOtpValid = await OtpGenerator.verify(userInfo.email, otp);

    if (!isOtpValid) {
      return errorResponse(res, "Verification of otp unsuccessful", 400);
    }

    await UserModel.setOnboardStep(userInfo.id, stepper);

    return successResponse(res, "Verification of otp successful", 200);
  } catch {
    return errorResponse(res, "Failed to verify otp", 500);
  }
};

/**
 * @swagger
 * /api/v1/auth/admin/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     description: Retrieves the OTP associated with the provided email address and returns it.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP retrieved successfully.
 *       500:
 *         description: Failed to retrieve OTP.
 *     security: []
 */
export const resendOtpHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body;

  try {
    const retrievedOtp = await NotificationModel.retrieveOtpFromDb(email);

    if (!retrievedOtp) {
      return errorResponse(
        res,
        "Failed to retrieve otp from notifications table on db",
        500,
      );
    }

    return successResponse(res, `${retrievedOtp} is the retrieved otp`, 200);
  } catch {
    return errorResponse(
      res,
      "Failed to retrieve otp from notifications table on db",
      500,
    );
  }
};

/**
 * @swagger
 * /api/v1/admin/business/types:
 *   get:
 *     summary: Get business type list
 *     description: Returns a list of all available business types.
 *     tags:
 *       - Business
 *     responses:
 *       200:
 *         description: Business type list returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Business type list returned successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Private School
 *       500:
 *         description: Failed to fetch business types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to business types list
 *     security: []
 */
export const getBusinessTypeListHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const returnedBusinessTypesAndIds =
      await BusinessTypesModel.getAllBusinessTypes();

    return successResponse(
      res,
      "Business type list returned successfully",
      returnedBusinessTypesAndIds,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to retrieve business types list", 500);
  }
};
