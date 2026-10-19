import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Request, Response } from "express";

import prisma from "../../config/database";
import { IGuardianFormData } from "../../interfaces/guardian.interfaces";
import { passwordHistoryChecker } from "../../managers/passwordHistoryChecker";
import { AuditModel } from "../../models/audit.model";
import { PasswordHistoryModel } from "../../models/passwordHistory.model";
import { RoleHasPermissionsModel } from "../../models/rolesHasPermissions.model";
import { UserModel } from "../../models/user.model";
import { getUserByUniqueId } from "../../services/admin.service";
import { passwordValidatorService } from "../../services/auth.service";
import {
  createNewGuardianEntry,
  deleteGuardianInfo,
  getAllGuardiansAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist,
  updateGuardianInfo,
} from "../../services/guardian.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse, errorResponse } from "../../utils/response.util";

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
 * /api/v1/admin/roles-and-permissions:
 *   get:
 *     summary: Get roles and permissions
 *     deprecated: true
 *     description: Retrieves the built-in roles and your business's custom roles with permissions grouped by role. Manager only. Use GET /api/v1/admin/roles instead.
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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await RoleHasPermissionsModel.getRoleAndPermissions(
      BigInt(req.businessId!),
    );
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
