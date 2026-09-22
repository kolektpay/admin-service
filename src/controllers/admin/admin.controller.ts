import { NextFunction, Request, Response } from "express";
import { successResponse, errorResponse } from "../../utils/response.util";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { AuditModel } from "../../models/audit.model";
import {
  createNewStudentEntry,
  deleteStudentInfo,
  getAllStudentsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist,
  updateStudentInfo,
} from "../../services/student.service";
import { IStudentFormData } from "../../interfaces/student.interfaces";
import { PasswordHistoryModel } from "../../models/passwordHistory.model";
import { IGuardianFormData } from "../../interfaces/guardian.interfaces";
import {
  createNewGuardianEntry,
  deleteGuardianInfo,
  getAllGuardiansAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist,
  updateGuardianInfo,
} from "../../services/guardian.service";
import { generateNextInvoiceNumber } from "../../helpers/invoiceNumber.helper";
// import { extractRequestMetadata } from "../utils/request.metadata";
import { UserModel } from "../../models/user.model";
import {
  createNewPaymentItemEntry,
  getAllPaymentItemsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist,
} from "../../services/paymentitem.service";
import { CreatePaymentItemPayload } from "../../interfaces/paymentItem.interface";
import { PaymentItemStatus } from "@prisma/client";
import { NotificationModel } from "../../models/notifications.model";
// import { createPaymentItemWallet } from "../thirdPartyService/wallet.services";
import { Emails } from "../../utils/emailTemplate";
import { parseDateRange } from "../../helpers/date.helper";
import bcrypt from "bcrypt";
import {
  getUserByUniqueId,
  createUser,
  updateUser,
  deleteUser,
  getUserByEmail,
  blockUser,
  unblockUser,
  getAllUsersAndCheckIfSearchAndStatusCriteriaexist,
} from "../../services/user.service";
import dotenv from "dotenv";
import prisma from "../../config/database";
import { UserRoleModel } from "../../models/userHasRole.model";
import { userHasRoleData } from "../../interfaces/userRole.interfaces";
import { TempPasswordTokenManager } from "../../utils/tempPasswordTokenManager";
import { RoleHasPermissionsModel } from "../../models/rolesHasPermissions.model";
import { passwordHistoryChecker } from "../../utils/passwordHistoryChecker";
import { passwordValidatorService } from "../../services/auth.service";
import { UserToBusinessModel } from "../../models/userIdToBusiness.model";
import { PaymentItemModel } from "../../models/paymentItem.model";
import { PaymentItemData } from "../../interfaces/paymentitemwalletcreationdatainterface";
import { createPaymentItemWallet } from "../../thirdPartyService/wallet.services";

dotenv.config();

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;

//for user crud

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: "Enter JWT token only. Swagger UI will automatically send it as Authorization: Bearer <token>"
 */

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     description: Returns a paginated list of all users in the system. Supports search by name/email and filtering by status. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page (max 100)
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter users by email, first name or last name
 *         example: john
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, blocked, suspended, pending, otp_verify]
 *         description: Filter users by their account status
 *         example: active
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       400:
 *         description: Bad request - Invalid pagination parameters
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const getEveryUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { ip } = extractRequestMetadata(req);
  const userId = req.userId;
  const businessId = req.businessId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search || null;
  const status = req.query.status || null;

  if (!businessId) {
    return errorResponse(res, "Business ID is required", 400);
  }

  if (page < 1) {
    return errorResponse(res, "Page must be greater than 0", 400);
  }
  if (limit < 1 || limit > 100) {
    return errorResponse(res, "Limit must be between 1 and 100", 400);
  }

  try {
    const result = await getAllUsersAndCheckIfSearchAndStatusCriteriaexist(
      page,
      limit,
      BigInt(businessId),
      search as string,
      status as string,
    );

    await AuditModel.logGottenEveryUser(userId as string, ip);

    if (result.users.length === 0) {
      return successResponse(
        res,
        "No user(s) matching the criteria was found",
        {
          users: result.users,
          pagination: result.pagination,
        },
      );
    }
    return successResponse(res, "Users retrieved successfully", {
      users: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Takes user ID from request params, passes it to getUserByUniqueId service function, and returns the user data. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique user ID
 *         example: user-123
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const getUserByIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await getUserByUniqueId(id as string);
    const managerUserId = req.userId;
    const { ip } = extractRequestMetadata(req);

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const { password, ...safeUser } = user;

    await AuditModel.logGottenUniqueUserById(managerUserId! as string, ip);
    return successResponse(res, "User retrieved successfully", safeUser);
  } catch (error) {
    return errorResponse(res, "User could not be obtained by userid", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Gets user data from request body, generates a temporary password, hashes it, checks if user already exists, creates new user if not, assigns a role, and sends a temp password email notification. Manager only.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - roleId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               firstName:
 *                 type: string
 *                 example: Jane
 *               lastName:
 *                 type: string
 *                 example: Smith
 *               roleId:
 *                 oneOf:
 *                   - type: integer
 *                     example: 1
 *                   - type: array
 *                     items:
 *                       type: integer
 *                     example: [1, 2]
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: User with this email already exists
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const createNewUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userData = req.body;
    const { ip } = extractRequestMetadata(req);
    const managerBusinessId = req.businessId!;
    const managerUserId = req.userId!;
    let userRoleIdArray: bigint[] = [];
    const value = Number(req.body.roleId);

    if (typeof value === "number") {
      userRoleIdArray.push(BigInt(value));
    } else if (Array.isArray(value)) {
      userRoleIdArray = [...value];
    } else {
      return errorResponse(res, "invalid role id type", 400);
    }

    const temp_password = await TempPasswordTokenManager.generateToken();

    const hashedPassword = await bcrypt.hash(temp_password, saltRounds);

    const existingUser = await getUserByEmail(userData.email);
    if (existingUser) {
      return errorResponse(res, "User with this email already exists", 400);
    }

    const { roleId, ...newUserData } = userData;
    const user = await createUser(
      { ...newUserData, password: hashedPassword },
      managerUserId! as string,
    );

    const userDataForChangingPassword = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      generatedPassword: temp_password,
      resetLink: `${process.env.MUST_CHANGE_PASSWORD_LINK_URL}/change-password?email=${user.email}`,
    };
    await NotificationModel.sendTempPasswordNotification(
      userDataForChangingPassword,
    );

    let userRoleData: userHasRoleData = {
      userRoleId: userRoleIdArray,
      userId: user.id,
      businessId: BigInt(managerBusinessId),
    };

    await UserRoleModel.assignSubsequentUserRole(userRoleData);
    await UserToBusinessModel.mapUserToBusiness(
      user.id,
      BigInt(managerBusinessId),
    );

    await PasswordHistoryModel.createPasswordHistory(user.id, hashedPassword);
    await AuditModel.logCreatedNewUser(managerUserId as string, ip);

    return successResponse(res, "User created successfully", user);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to create user", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   patch:
 *     summary: Update existing user
 *     description: Gets the ID of the existing user from path params and updated user data from request body, calls updateUser service, and returns the updated user. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: user-123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: updated@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Updated
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const updateExistingUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const managerUserId = req.userId;

    const userData = req.body;
    const { ip } = extractRequestMetadata(req);

    const user = await updateUser(id as string, userData);

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }
    await AuditModel.logUpdateNewUser(managerUserId! as string, ip);
    return successResponse(res, "User updated successfully", user);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to update user", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Takes the ID of the user to be deleted from path params, calls deleteUser service, and returns a success response. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: user-123
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const deleteAUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { ip } = extractRequestMetadata(req);
    const managerUserId = req.userId;

    if (managerUserId === id) {
      return errorResponse(res, "Manager accounts cannot be deleted", 403);
    }

    await deleteUser(id as string);
    await AuditModel.logDeletedNewUser(managerUserId! as string, ip);
    return successResponse(res, "User deleted successfully");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to delete user", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/block:
 *   post:
 *     summary: Block a user
 *     description: Blocks a user account by their ID. An optional reason can be supplied in the request body. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: user-123
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Repeated policy violations
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const blockExistingUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { ip } = extractRequestMetadata(req);
    const managerUserId = req.userId;

    if (managerUserId === id) {
      return errorResponse(res, "Manager accounts cannot be blocked", 403);
    }

    await blockUser(id as string, reason);
    await AuditModel.logBlockedAccount(managerUserId! as string, ip, reason);
    return successResponse(
      res,
      "Your user account has been blocked. Please contact system administrator.",
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to block user", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/unblock:
 *   patch:
 *     summary: Unblock a user
 *     description: Unblocks a previously blocked user account by their ID. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: user-123
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const unblockExistingUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { ip } = extractRequestMetadata(req);
    const managerUserId = req.userId;

    await unblockUser(id as string);
    await AuditModel.logUnblockedAccount(managerUserId! as string, ip);
    return successResponse(res, "Your user account has been unblocked.");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to unblock user", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/audit-logs/{userId}:
 *   get:
 *     summary: View audit logs
 *     description: Managers can view all audit logs. If a userId path param is provided, only that user's logs are returned. If omitted, all logs are returned. Manager only.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         example: user-123
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const viewAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const managerUserId = req.userId!;

    const { userId } = req.params;

    const { ip } = extractRequestMetadata(req);

    let auditLogs;

    if (!userId) {
      auditLogs = await prisma.auditLogs.findMany();
    } else {
      auditLogs = await prisma.auditLogs.findMany({
        where: { userId: userId as string },
      });
    }
    await AuditModel.logAuditLogsViewed(managerUserId! as string, ip);
    return successResponse(res, "Audit logs retrieved successfully", auditLogs);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to fetch audit logs", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/roles/assign:
 *   post:
 *     summary: Assign or unassign role to user
 *     description: Assigns or unassigns one or more roles to a user. Business ID is derived automatically from the logged-in manager's JWT token. Manager only.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - userId
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [assign, unassign]
 *                 example: assign
 *               userId:
 *                 type: string
 *                 example: user-123
 *               roleId:
 *                 oneOf:
 *                   - type: integer
 *                     example: 1
 *                   - type: array
 *                     items:
 *                       type: integer
 *                     example: [1, 2]
 *     responses:
 *       200:
 *         description: Role assigned or unassigned successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const assignRoleToUserHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let roleId: bigint[] = req.body.roleId;
    let action = req.body.action;
    const userId = req.body.userId!;
    const managerUserId = req.userId!;
    const userBusinessId = req.businessId!;
    const { ip } = extractRequestMetadata(req);

    if (action === "assign") {
      let userRoleData: userHasRoleData = {
        userRoleId: roleId,
        userId: userId,
        businessId: BigInt(userBusinessId),
      };
      await AuditModel.logAssignRoleToUser(managerUserId! as string, ip);
      await UserRoleModel.assignSubsequentUserRole(userRoleData);

      return successResponse(res, "User role has been assigned");
    } else {
      await UserRoleModel.unassignSubsequentUserRole(userId);
      return successResponse(res, "User role has been unassigned");
    }
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to fetch audit logs", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/roles-and-permissions:
 *   get:
 *     summary: Get roles and permissions
 *     description: Retrieves all roles and their associated permissions grouped by role. Manager only.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Roles and permissions returned successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const fetchRolesAndPermissionsHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await RoleHasPermissionsModel.getRoleAndPermissions();
    return successResponse(
      res,
      "Roles and permissions returned successfully.",
      result,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to roles and permissions", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/password/enforce-rotation:
 *   post:
 *     summary: Enforce password rotation
 *     description: Forces a specific user to change their password on next login by setting mustChangePassword to true. Manager only.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 example: 321d02df-abcf-4ca7-a53d-75c2858633c0
 *     responses:
 *       200:
 *         description: Password rotation enforced successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Forbidden - managers only
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
export const enforcePasswordRotationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.body;
    const managerUserId = req.userId;
    const { ip } = extractRequestMetadata(req);

    await UserModel.mustChangePasswordSetToTrueToForcePasswordChange(userId);
    await AuditModel.logPasswordRotationEnforcementOperation(
      managerUserId as string,
      ip,
    );
    return successResponse(res, "Password rotation enforced successfully.");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to enforce password rotation", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/users/password/change:
 *   post:
 *     summary: Change user password
 *     description: Allows a logged-in user to voluntarily change their own password. Validates the old password, checks against password history to prevent reuse, then updates to the new password. The match check between newPassword and confirmNewPassword is handled in middleware — only send one of them here.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - oldPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 example: 321d02df-abcf-4ca7-a53d-75c2858633c0
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 example: OldPassword123!
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *               confirmNewPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *     responses:
 *       200:
 *         description: User password changed successfully
 *       400:
 *         description: New password cannot be the same as any previously used password
 *       401:
 *         description: Unauthorized - Invalid or missing access token, or old password does not match
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to change user password
 *     security:
 *       - bearerAuth: []
 */
export const changeAnyUserPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, oldPassword, confirmNewPassword } = req.body;

    await UserModel.mustChangePasswordSetToTrueToForcePasswordChange(userId);

    const { ip } = extractRequestMetadata(req);

    const response = await getUserByUniqueId(userId);

    if (!response) {
      return errorResponse(
        res,
        "This userId does not correspond to any user",
        404,
      );
    }

    const passwordCheck = await passwordValidatorService(
      response.password,
      oldPassword,
    );

    if (!passwordCheck) {
      return errorResponse(
        res,
        "Inputed password does not match user password",
      );
    }

    const isSameAsOldPasswords = await passwordHistoryChecker(
      userId,
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
      userId,
      hashedPassword,
    );

    await PasswordHistoryModel.createPasswordHistory(userId, hashedPassword);

    await AuditModel.logUserChangedPasswordOperation(userId as string, ip);
    return successResponse(res, "User password changed successfully.");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to change user password", 500);
  }
};

//for payment items

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   get:
 *     summary: Get all payment items for a business
 *     description: |
 *       Returns paginated payment item records belonging to the authenticated
 *       user's business. Supports optional search, status, and date-range
 *       filters (startDate/endDate).
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *           example: Tuition Fee
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - approved
 *             - inactive
 *             - rejected
 *             - cancelled
 *             - pending
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-01"
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-12-31"
 *     responses:
 *       200:
 *         description: Payment items fetched successfully
 *       400:
 *         description: Invalid request parameters (bad pagination or date range)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to fetch payment item(s)
 */
export const getAllPaymentItemsGeneratedAccordingToBusinessIdAndClassIdHandler =
  async (req: Request, res: Response): Promise<any> => {
    const businessId = req.businessId;

    const {
      page = 1,
      limit = 50,
      search,
      status,
      startDate,
      endDate,
    } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    if (isNaN(pageNumber) || pageNumber < 1) {
      return errorResponse(res, "Page must be greater than 0", 400);
    }

    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      return errorResponse(res, "Limit must be between 1 and 100", 400);
    }

    const {
      parsedStartDate,
      parsedEndDate,
      error: dateRangeError,
    } = parseDateRange(
      startDate as string | undefined,
      endDate as string | undefined,
    );

    if (dateRangeError) {
      return errorResponse(res, dateRangeError, 400);
    }

    try {
      const listOfAllPaymentItems =
        await getAllPaymentItemsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist(
          pageNumber,
          limitNumber,
          businessId as bigint,
          search as string | undefined,
          status as string | undefined,
          parsedStartDate,
          parsedEndDate,
        );
      return successResponse(
        res,
        "Payment items have been fetched successfully",
        listOfAllPaymentItems,
      );
    } catch (error) {
      console.log(error);
      return errorResponse(res, "Failed to fetch payment item(s).", 500);
    }
  };

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   post:
 *     summary: Create a new payment item
 *     description: |
 *       Creates a payment item for the authenticated user's business. The
 *       businessId is extracted from the JWT token. A unique invoice number
 *       is generated, the item is created with status "pending", and everyone
 *       with payment-approval privilege for the business is notified by email.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - amount
 *               - startDate
 *               - endDate
 *               - classId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Tuition Fee
 *               description:
 *                 type: string
 *                 example: First term tuition fee
 *               amount:
 *                 type: number
 *                 example: 150000
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-10"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               classId:
 *                 type: integer
 *                 example: 9
 *     responses:
 *       200:
 *         description: Payment item created successfully
 *       404:
 *         description: Payment item creator not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to create new payment item
 */
export const createNewPaymentItemsAccordingToBusinessIdAndClassIdHandler =
  async (req: Request, res: Response): Promise<any> => {
    const beforeInvoiceNumberPaymentItemInfo: CreatePaymentItemPayload =
      req.body;
    const userId = req.userId!;
    const { ip } = extractRequestMetadata(req);
    const businessId = req.businessId;

    try {
      const getInvoiceNumber = await generateNextInvoiceNumber();

      const paymentItemCreator = await UserModel.getNameFromUserId(
        userId as string,
      );

      if (!paymentItemCreator) {
        return errorResponse(res, "Payment item creator not found", 404);
      }

      const afterInvoicenumberPaymentItemInfo = {
        ...beforeInvoiceNumberPaymentItemInfo,
        invoiceNumber: getInvoiceNumber,
        status: "pending" as PaymentItemStatus,
        userId,
        createdBy: paymentItemCreator,
      };
      const createdPaymentItem = await createNewPaymentItemEntry(
        afterInvoicenumberPaymentItemInfo,
        businessId as bigint,
      );

      const listOfEveryoneWhoCanApprovePaymentItem =
        await NotificationModel.getAllPersonnelWhoCanApprovePaymentItemsByBusinessId(
          businessId as bigint,
        );
      const email = Emails.getEmail("PAYMENT_ITEMS_NEED_APPROVAL");

      await NotificationModel.notifyUsersWithPaymentApprovalPrivilege(
        email?.content as string,
        email?.subject as string,
        listOfEveryoneWhoCanApprovePaymentItem,
      );

      await AuditModel.logPaymentItemCreation(
        userId as string,
        ip,
        businessId as bigint,
      );

      return successResponse(
        res,
        "payment item info has been created on platform",
        createdPaymentItem,
      );
    } catch (error) {
      console.log(error);
      return errorResponse(res, "Failed to create new payment item", 500);
    }
  };

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   patch:
 *     summary: Update an existing payment item
 *     description: |
 *       Updates a payment item's name and/or description for the
 *       authenticated user's business. Payment items that have already
 *       been approved cannot be edited.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentItemId
 *             properties:
 *               paymentItemId:
 *                 type: integer
 *                 example: 10
 *               title:
 *                 type: string
 *                 example: Second Term Tuition Fee
 *               description:
 *                 type: string
 *                 example: Updated description
 *     responses:
 *       200:
 *         description: Payment item updated successfully
 *       400:
 *         description: Payment item has already been approved and cannot be edited
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to update payment item
 */
export const updatePaymentItemsAccordingToBusinessIdAndClassIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = req.userId;
  const businessId = req.businessId;

  const { description, title, paymentItemId } = req.body;

  try {
    const nameOfPaymentItemUpdateInitiator = await UserModel.getNameFromUserId(
      userId as string,
    );
    const isPaymentItemApproved =
      await PaymentItemModel.isPaymentItemApproved(paymentItemId);

    if (isPaymentItemApproved) {
      return errorResponse(
        res,
        "Payment item has already been approved and cannot be edited.",
      );
    }

    const paymentItemUpdateInfo = { name: title, description: description };

    const updatePaymentItem = await PaymentItemModel.updatePaymentItem(
      businessId as bigint,
      paymentItemId,
      nameOfPaymentItemUpdateInitiator as string,
      paymentItemUpdateInfo,
    );

    return successResponse(
      res,
      "Payment item updated successfully",
      updatePaymentItem,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to update payment item", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/payment-items/approve:
 *   patch:
 *     summary: Approve a payment item
 *     description: |
 *       Approves a payment item by requesting a virtual wallet/account for
 *       it from the third-party wallet service, then stores the returned
 *       bank, account number, and account name on the payment item. If
 *       wallet creation fails, the payment item is deleted and an error is
 *       returned.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentItemId
 *               - action
 *             properties:
 *               paymentItemId:
 *                 type: integer
 *                 example: 10
 *               action:
 *                 type: string
 *                 example: approve
 *     responses:
 *       200:
 *         description: Payment item approved successfully
 *       400:
 *         description: Payment item could not be approved (wallet creation failed)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to approve payment item
 */
export const approvePaymentItemsAccordingToBusinessIdAndClassIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const { action, paymentItemId } = req.body;
  const userId = req.userId!;
  const { ip } = extractRequestMetadata(req);
  const businessId = req.businessId;

  try {
    const paymentItemName =
      await PaymentItemModel.getPaymentItemName(paymentItemId);

    const walletCreationInfo: PaymentItemData = {
      businessId: businessId as bigint,
      paymentItemId: paymentItemId,
      paymentItemName: paymentItemName as string,
    };

    const getPaymentItemWallet =
      await createPaymentItemWallet(walletCreationInfo);

    if (!getPaymentItemWallet) {
      await PaymentItemModel.deletePaymentItem(
        paymentItemId,
        businessId as bigint,
      );
      return errorResponse(res, "Payment item could not be approved");
    }

    await PaymentItemModel.updatePaymentItemBankDetails(
      businessId as bigint,
      action,
      paymentItemId,
      getPaymentItemWallet.data.accountName,
      getPaymentItemWallet.data.accountNo,
      getPaymentItemWallet.data.bank,
    );

    await AuditModel.logPaymentItemApproval(
      userId as string,
      ip,
      businessId as bigint,
    );

    return successResponse(res, "Payment item has been approved successfully");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to create new payment item", 500);
  }
};

//for guardians for crud

/**
 * @swagger
 * /api/v1/admin/guardians:
 *   get:
 *     summary: Get all guardians for a business
 *     description: |
 *       Returns paginated guardian records belonging to the authenticated user's business.
 *       Supports optional search and status filters.
 *     tags:
 *       - Guardians
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *           example: Chidinma
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *     responses:
 *       200:
 *         description: Guardian records fetched successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to fetch guardians
 */
export const getAllGuardianInfoAccordingToBusinessIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const businessId = req.businessId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || undefined;
  const status = (req.query.status as string) || undefined;

  if (!businessId) {
    return errorResponse(res, "Business ID is required", 400);
  }

  if (page < 1) {
    return errorResponse(res, "Page must be greater than 0", 400);
  }

  if (limit < 1 || limit > 100) {
    return errorResponse(res, "Limit must be between 1 and 100", 400);
  }

  try {
    const fetchedGuardians =
      await getAllGuardiansAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist(
        page,
        limit,
        BigInt(businessId),
        search,
        status,
      );

    if (fetchedGuardians.guardians.length === 0) {
      return successResponse(
        res,
        "No guardians have been created on the platform or your search entry does not exist.",
      );
    }

    return successResponse(
      res,
      "guardian info has been fetched successfully",
      fetchedGuardians,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to fetch guardian(s).", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/guardians:
 *   post:
 *     summary: Create guardian entries for a business
 *     description: |
 *       Creates one or multiple guardian records linked to the authenticated
 *       user's business. The businessId is extracted from the authenticated
 *       JWT token and is not required in the request body. Accepts either a
 *       single guardian object or an array of guardian objects.
 *     tags:
 *       - Guardians
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - email
 *                   - phoneNumber
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: Chidinma
 *                   lastName:
 *                     type: string
 *                     example: Adetunji
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: chidinma.adetunji@example.com
 *                   phoneNumber:
 *                     type: string
 *                     example: "+2348031110016"
 *                   address:
 *                     type: string
 *                     example: Ikeja, Lagos
 *               - type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - firstName
 *                     - lastName
 *                     - email
 *                     - phoneNumber
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Chidinma
 *                     lastName:
 *                       type: string
 *                       example: Adetunji
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: chidinma.adetunji@example.com
 *                     phoneNumber:
 *                       type: string
 *                       example: "+2348031110016"
 *                     address:
 *                       type: string
 *                       example: Ikeja, Lagos
 *     responses:
 *       200:
 *         description: Guardian records created successfully
 *       400:
 *         description: Invalid guardian data
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       404:
 *         description: Business ID not found
 *       500:
 *         description: Failed to create guardian entry
 */
export const createNewGuardianAccordingToBusinessIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userBusinessId = req.businessId;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;

  const guardianDataEntry: IGuardianFormData[] = req.body;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }

    const createdGuardians = await createNewGuardianEntry(
      guardianDataEntry,
      BigInt(userBusinessId),
    );

    for (const eachGuardian of createdGuardians) {
      await PasswordHistoryModel.createPasswordHistory(
        eachGuardian.id,
        eachGuardian.password as string,
      );
    }

    await AuditModel.logUserCreatedNewGuardianEntry(userId as string, ip);

    return successResponse(
      res,
      "guardian(s) info has been created on platform",
      createdGuardians,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to create new guardian entry", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/guardians/{guardianid}:
 *   patch:
 *     summary: Update guardian information
 *     description: |
 *       Updates a guardian record belonging to the authenticated user's business.
 *       Only fields supplied in the request body will be updated.
 *     tags:
 *       - Guardians
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guardianid
 *         required: true
 *         description: Unique ID of the guardian
 *         schema:
 *           type: string
 *           example: "42"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Chidinma
 *               lastName:
 *                 type: string
 *                 example: Adetunji
 *               email:
 *                 type: string
 *                 format: email
 *                 example: chidinma.adetunji@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348031110016"
 *               address:
 *                 type: string
 *                 example: Ikeja, Lagos
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - inactive
 *                   - suspended
 *                 example: active
 *     responses:
 *       200:
 *         description: Guardian information updated successfully
 *       400:
 *         description: Invalid guardian information
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       404:
 *         description: Business ID or guardian not found
 *       500:
 *         description: Failed to update guardian information
 */
export const updateGuardianInfoHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userBusinessId = req.businessId;
  const { guardianid } = req.params;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;
  const guardianInfoToUpdate = req.body;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }

    const fetchedGuardianInfo = await updateGuardianInfo(
      BigInt(userBusinessId),
      guardianid as string,
      guardianInfoToUpdate,
    );

    await AuditModel.logUpdatedGuardianInfoForAParticlarBusinessId(
      userId as string,
      ip,
    );

    return successResponse(
      res,
      "Guardian info updated successfully",
      fetchedGuardianInfo,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to update guardian info", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/guardians/{guardianid}:
 *   delete:
 *     summary: Delete a guardian
 *     description: |
 *       Soft deletes a guardian record belonging to the authenticated user's business.
 *       The businessId is extracted from the authenticated JWT token.
 *     tags:
 *       - Guardians
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guardianid
 *         required: true
 *         description: Unique ID of the guardian to delete
 *         schema:
 *           type: string
 *           example: "42"
 *     responses:
 *       200:
 *         description: Guardian deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       404:
 *         description: Business ID or guardian not found
 *       500:
 *         description: Failed to delete guardian
 */
export const deleteGuardianInfoHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userBusinessId = req.businessId;
  const { guardianid } = req.params;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }

    await deleteGuardianInfo(BigInt(userBusinessId), guardianid as string);

    await AuditModel.logDeletedGuardianInfoForAParticlarBusinessId(
      userId as string,
      ip,
    );

    return successResponse(res, "Guardian info deleted successfully", 200);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to delete guardian", 500);
  }
};

//for students for crud

/**
 * @swagger
 * /api/v1/admin/tudents:
 *   get:
 *     summary: Get all students for a business
 *     description: |
 *       Returns paginated student records belonging to the authenticated user's business.
 *       Supports optional search and status filters.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *             - graduated
 *             - withdrawn
 *     responses:
 *       200:
 *         description: Student records fetched successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to fetch students
 */
export const getAllStudentInfoAccordingToBusinessIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const businessId = req.businessId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || undefined;
  const status = (req.query.status as string) || undefined;

  if (!businessId) {
    return errorResponse(res, "Business ID is required", 400);
  }

  if (page < 1) {
    return errorResponse(res, "Page must be greater than 0", 400);
  }

  if (limit < 1 || limit > 100) {
    return errorResponse(res, "Limit must be between 1 and 100", 400);
  }

  try {
    const fetchedStudents =
      await getAllStudentsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist(
        page,
        limit,
        BigInt(businessId),
        search,
        status,
      );

    if (fetchedStudents.students.length === 0) {
      return successResponse(
        res,
        "No students have been created on the platform or your search entry does not exist.",
      );
    }

    return successResponse(
      res,
      "student info has been fetched successfully",
      fetchedStudents,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to fetch student(s).", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/students:
 *   post:
 *     summary: Create student entries for a business
 *     description: |
 *       Creates one or multiple student records linked to the authenticated user's business.
 *       The businessId is extracted from the authenticated JWT token and not from the request body.
 *       Accepts either a single student object or an array of student objects.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 $ref: '#/components/schemas/StudentFormData'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/StudentFormData'
 *     responses:
 *       200:
 *         description: Student records created successfully
 *       404:
 *         description: Business ID not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to create new student entry
 */
export const createNewStudentAccordingToBusinessIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userBusinessId = req.businessId;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;
  const studentDataEntry: IStudentFormData[] = req.body;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }

    const createdStudents = await createNewStudentEntry(
      studentDataEntry,
      BigInt(userBusinessId),
    );
    for (const eachStudent of createdStudents) {
      await PasswordHistoryModel.createPasswordHistory(
        eachStudent.id,
        eachStudent.password,
      );
    }

    await AuditModel.logUserCreatedNewStudentEntry(userId as string, ip);

    return successResponse(
      res,
      "student(s) info has been created on platform",
      createdStudents,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to create new student entry", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/students/{registrationnumber}:
 *   patch:
 *     summary: Update student information
 *     description: |
 *       Updates a student record by registration number.
 *       The businessId is extracted from the authenticated JWT token.
 *       Only fields provided in the request body will be updated.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationnumber
 *         required: true
 *         description: The unique registration number of the student
 *         schema:
 *           type: string
 *           example: REG-3016
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Ngozi
 *               lastName:
 *                 type: string
 *                 example: Adetunji
 *               middleName:
 *                 type: string
 *                 nullable: true
 *                 example: L
 *               email:
 *                 type: string
 *                 format: email
 *                 example: ngozi.adetunji@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348031110021"
 *               classId:
 *                 type: integer
 *                 example: 10
 *               age:
 *                 type: integer
 *                 example: 13
 *               gender:
 *                 type: string
 *                 example: Female
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "2013-09-14"
 *               address:
 *                 type: string
 *                 example: Ikeja, Lagos
 *               parentPhoneNumber:
 *                 type: string
 *                 example: "08011110016"
 *               parentEmail:
 *                 type: string
 *                 nullable: true
 *                 example: adetunji@example.com
 *               parentName:
 *                 type: string
 *                 example: Mrs Adetunji
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - inactive
 *                   - suspended
 *                   - graduated
 *                   - withdrawn
 *                 example: active
 *     responses:
 *       200:
 *         description: Student info updated successfully
 *       404:
 *         description: Business ID not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Internal server error
 */
export const updateStudentInfoHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userBusinessId = req.businessId;
  const { registrationnumber } = req.params;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;
  const studentInfoToUpdate = req.body;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }

    const fetchedStudentInfo = await updateStudentInfo(
      BigInt(userBusinessId),
      registrationnumber as string,
      studentInfoToUpdate,
    );

    await AuditModel.logUpdatedStudentInfoForAParticlarBusinessId(
      userId as string,
      ip,
    );

    return successResponse(
      res,
      "Student info updated successfully",
      fetchedStudentInfo,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to update student info", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/students/{registrationnumber}:
 *   delete:
 *     summary: Delete a student
 *     description: |
 *       Soft deletes a student record by registration number.
 *       The businessId is extracted from the authenticated JWT token.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationnumber
 *         required: true
 *         description: The unique registration number of the student to delete
 *         schema:
 *           type: string
 *           example: REG-3016
 *     responses:
 *       200:
 *         description: Student deleted successfully
 *       404:
 *         description: Business ID not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Internal server error
 */
export const deleteStudentInfoHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userBusinessId = req.businessId;
  const { registrationnumber } = req.params;

  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "No user business id found", 404);
    }
    await deleteStudentInfo(
      BigInt(userBusinessId),
      registrationnumber as string,
    );

    await AuditModel.logDeletedStudentInfoForAParticlarBusinessId(
      userId as string,
      ip,
    );

    return successResponse(res, "Student info deleted successfully", 200);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to delete student", 500);
  }
};
