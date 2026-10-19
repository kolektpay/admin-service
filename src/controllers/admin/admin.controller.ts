import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import { AuditModel } from "../../models/audit.model";
import {
  assignAdminRoles,
  createAdmin,
  deleteAdmin,
  getAdminById,
  listAdmins,
  reactivateAdmin,
  unassignAdminRoles,
  updateAdmin,
  updateAdminStatus,
} from "../../services/admin.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  CreateAdminInput,
  ListAdminsQuery,
  SetAdminRolesInput,
  UpdateAdminInput,
  UpdateAdminStatusInput,
} from "../../validations/adminManagement.schema";

// Business and actor come from the JWT (requirePermission guarantees both are present)
const getActor = (req: Request): AdminActor => ({
  userId: req.userId as string,
  businessId: BigInt(req.businessId!),
  ip: extractRequestMetadata(req).ip,
});

const getAdminId = (req: Request): string => req.params.id as string;

/**
 * @swagger
 * components:
 *   schemas:
 *     Administrator:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, example: 321d02df-abcf-4ca7-a53d-75c2858633c0 }
 *         email: { type: string, format: email, example: jane.smith@example.com }
 *         firstName: { type: string, example: jane }
 *         lastName: { type: string, example: smith }
 *         phoneNumber: { type: string, nullable: true, example: "+2348031110021" }
 *         status: { type: string, enum: [active, inactive, blocked, suspended, pending, otp_verify, on_leave, blocked_by_admin], example: active }
 *         blockReason: { type: string, nullable: true }
 *         leaveReason: { type: string, nullable: true, example: Annual leave }
 *         expectedReturnDate: { type: string, format: date, nullable: true, example: "2026-11-02" }
 *         mustChangePassword: { type: boolean, nullable: true }
 *         totpEnabled: { type: boolean }
 *         failedLoginCount: { type: integer }
 *         lastLoggedInAt: { type: string, format: date-time, nullable: true }
 *         passwordExpiresAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         roles:
 *           type: array
 *           description: The administrator's roles in your business, in the order they were assigned
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer, example: 7 }
 *               name: { type: string, example: Bursar }
 *         role:
 *           type: object
 *           nullable: true
 *           deprecated: true
 *           description: The first of roles, kept for clients of the single-role response shape
 *           properties:
 *             id: { type: integer, example: 7 }
 *             name: { type: string, example: Bursar }
 */

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List administrators with pagination and filters
 *     description: |
 *       Returns the administrators of your business, newest first. Filters are combined with AND.
 *       Requires the admin.user_management.read_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: role, schema: { type: string }, description: Holds a role with this name (case-insensitive exact match), example: Bursar }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive, blocked, suspended, pending, otp_verify, on_leave, blocked_by_admin] } }
 *       - { in: query, name: name, schema: { type: string }, description: Matches first or last name (every word must match), example: jane smith }
 *       - { in: query, name: email, schema: { type: string }, description: Case-insensitive partial match, example: "@example.com" }
 *       - { in: query, name: search, schema: { type: string }, description: Partial match on email, first name or last name }
 *     responses:
 *       200:
 *         description: |
 *           Administrators fetched. Each record also carries userHasRoles
 *           (the roles in the earlier response shape).
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Users retrieved successfully
 *               data:
 *                 users:
 *                   - id: 321d02df-abcf-4ca7-a53d-75c2858633c0
 *                     email: jane.smith@example.com
 *                     firstName: jane
 *                     lastName: smith
 *                     status: on_leave
 *                     leaveReason: Annual leave
 *                     expectedReturnDate: "2026-11-02T00:00:00.000Z"
 *                     roles: [{ id: 7, name: Bursar }, { id: 9, name: Auditor }]
 *                     role: { id: 7, name: Bursar }
 *                     userHasRoles: [{ role: { id: 7, name: Bursar } }, { role: { id: 9, name: Auditor } }]
 *                 pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 */
export const listAdminsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = getActor(req);
  const result = await listAdmins(
    actor.businessId,
    req.query as unknown as ListAdminsQuery,
  );
  await AuditModel.logGottenEveryUser(actor.userId, actor.ip);

  successResponse(
    res,
    result.users.length
      ? "Users retrieved successfully"
      : "No user(s) matching the criteria was found",
    result,
  );
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get an administrator by ID
 *     description: Requires the admin.user_management.read_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Administrator fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User retrieved successfully }
 *                 data: { $ref: '#/components/schemas/Administrator' }
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 */
export const getAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = getActor(req);
  const admin = await getAdminById(getAdminId(req), actor.businessId);
  await AuditModel.logGottenUniqueUserById(actor.userId, actor.ip);

  successResponse(res, "User retrieved successfully", admin);
};

/**
 * @swagger
 * /api/v1/admin/users:
 *   post:
 *     summary: Create an administrator with one or more roles
 *     description: |
 *       Creates an administrator in your business with the given roles (up to 10), and emails
 *       them a temporary password they must change on first login. The account, role
 *       assignments and email are saved in one transaction. The administrator gets the combined
 *       permissions of all their roles. The manager role cannot be assigned, and you cannot
 *       assign roles with permissions you do not hold.
 *       Requires the admin.user_management.create_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, roleIds]
 *             properties:
 *               email: { type: string, format: email, example: jane.smith@example.com }
 *               firstName: { type: string, example: Jane }
 *               lastName: { type: string, example: Smith }
 *               phoneNumber: { type: string, example: "+2348031110021" }
 *               roleIds: { type: array, items: { type: integer }, minItems: 1, maxItems: 10, example: [7, 9], description: Duplicates are ignored }
 *               roleId:
 *                 deprecated: true
 *                 description: Accepted instead of roleIds for existing clients. Send one or the other.
 *                 oneOf:
 *                   - { type: integer, example: 7 }
 *                   - { type: array, items: { type: integer }, example: [7] }
 *     responses:
 *       200:
 *         description: Administrator created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: User created successfully
 *               data:
 *                 id: 321d02df-abcf-4ca7-a53d-75c2858633c0
 *                 email: jane.smith@example.com
 *                 firstName: jane
 *                 lastName: smith
 *                 phoneNumber: "+2348031110021"
 *                 status: inactive
 *                 mustChangePassword: true
 *                 roles: [{ id: 7, name: Bursar }, { id: 9, name: Auditor }]
 *                 role: { id: 7, name: Bursar }
 *       400:
 *         description: Validation failed (VALIDATION_ERROR) or a role does not exist (INVALID_ROLE)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, manager role (MANAGER_ROLE_NOT_ASSIGNABLE), or the roles grant permissions you do not hold (PERMISSION_ESCALATION)
 *       409:
 *         description: Email already in use (EMAIL_TAKEN)
 */
export const createAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const admin = await createAdmin(req.body as CreateAdminInput, getActor(req));
  successResponse(res, "User created successfully", admin);
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   patch:
 *     summary: Update an administrator's details or roles
 *     description: |
 *       Send only the fields to change. roleIds is the complete set of roles the administrator
 *       should hold, as with PUT /api/v1/admin/users/{id}/roles. You can update your own details
 *       but not your own roles, and nobody else can update the business manager.
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               email: { type: string, format: email, example: jane.s@example.com }
 *               firstName: { type: string, example: Jane }
 *               lastName: { type: string, example: Smith }
 *               phoneNumber: { type: string, nullable: true, example: "+2348031110021" }
 *               roleIds: { type: array, items: { type: integer }, minItems: 1, maxItems: 10, example: [7, 8] }
 *               roleId: { type: integer, example: 8, deprecated: true, description: Replaces all roles with this one. Send roleIds or roleId, not both. }
 *     responses:
 *       200:
 *         description: Administrator updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User updated successfully }
 *                 data: { $ref: '#/components/schemas/Administrator' }
 *       400:
 *         description: Validation failed or role does not exist (INVALID_ROLE)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, changing your own roles (CANNOT_MANAGE_SELF), the business manager (MANAGER_PROTECTED), manager role (MANAGER_ROLE_NOT_ASSIGNABLE) or PERMISSION_ESCALATION
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 *       409:
 *         description: Email already in use (EMAIL_TAKEN)
 */
export const updateAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const admin = await updateAdmin(
    getAdminId(req),
    req.body as UpdateAdminInput,
    getActor(req),
  );
  successResponse(res, "User updated successfully", admin);
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/roles:
 *   put:
 *     summary: Reassign an administrator's roles
 *     description: |
 *       Send the complete set of roles the administrator should hold. Roles not in the list are
 *       removed and new ones are added, in one transaction, and the change is audited.
 *       To add a role, send the current roles plus the new one; to remove one, leave it out.
 *       Only added roles are checked: you cannot add the manager role or a role granting
 *       permissions you do not hold, but you can remove any role. You cannot change your own
 *       roles or the business manager's.
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleIds]
 *             properties:
 *               roleIds: { type: array, items: { type: integer }, minItems: 1, maxItems: 10, example: [7, 9], description: Duplicates are ignored }
 *     responses:
 *       200:
 *         description: Roles updated (or unchanged when the set is the same)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User roles updated successfully }
 *                 data: { $ref: '#/components/schemas/Administrator' }
 *       400:
 *         description: Validation failed or a role does not exist (INVALID_ROLE)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF, MANAGER_PROTECTED, MANAGER_ROLE_NOT_ASSIGNABLE or PERMISSION_ESCALATION
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 */
export const setAdminRolesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { roleIds } = req.body as SetAdminRolesInput;
  const admin = await updateAdmin(getAdminId(req), { roleIds }, getActor(req));
  successResponse(res, "User roles updated successfully", admin);
};

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Delete an administrator
 *     description: |
 *       Soft deletes the administrator and revokes their sessions. You cannot delete yourself or
 *       the business manager. Requires the admin.user_management.delete_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Administrator deleted
 *         content:
 *           application/json:
 *             example: { success: true, message: User deleted successfully }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF or MANAGER_PROTECTED
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 */
export const deleteAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await deleteAdmin(getAdminId(req), getActor(req));
  successResponse(res, "User deleted successfully");
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     summary: Block an administrator or place them on leave
 *     description: |
 *       Both statuses revoke the administrator's sessions and stop them logging in until they
 *       are reactivated with PATCH /api/v1/admin/users/{id}/unblock.
 *
 *       - **blocked**: reason is optional. Stored as status blocked_by_admin, which (unlike the
 *         automatic "blocked" after failed logins) a password reset cannot clear. Blocking an
 *         administrator already blocked by an admin changes nothing.
 *       - **on_leave**: reason and expectedReturnDate (YYYY-MM-DD, after today) are required.
 *         Only active administrators (or ones already on leave, to update the details) can be placed on leave.
 *
 *       You cannot change your own status or the business manager's.
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [status]
 *                 properties:
 *                   status: { type: string, enum: [blocked] }
 *                   reason: { type: string, minLength: 3, maxLength: 255 }
 *               - type: object
 *                 required: [status, reason, expectedReturnDate]
 *                 properties:
 *                   status: { type: string, enum: [on_leave] }
 *                   reason: { type: string, minLength: 3, maxLength: 255 }
 *                   expectedReturnDate: { type: string, format: date }
 *           examples:
 *             onLeave:
 *               summary: Place on leave
 *               value: { status: on_leave, reason: Annual leave, expectedReturnDate: "2026-11-02" }
 *             blocked:
 *               summary: Block
 *               value: { status: blocked, reason: Repeated policy violations }
 *     responses:
 *       200:
 *         description: Status updated (or unchanged when already blocked)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Administrator placed on leave
 *               data:
 *                 id: 321d02df-abcf-4ca7-a53d-75c2858633c0
 *                 status: on_leave
 *                 leaveReason: Annual leave
 *                 expectedReturnDate: "2026-11-02T00:00:00.000Z"
 *                 role: { id: 7, name: Bursar }
 *       400:
 *         description: Validation failed, e.g. on_leave without reason or with a past expectedReturnDate
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: VALIDATION_ERROR
 *               message: Request validation failed
 *               details:
 *                 - { field: expectedReturnDate, message: expectedReturnDate must be a future date }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF or MANAGER_PROTECTED
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 *       409:
 *         description: Status cannot change from the current one (INVALID_STATUS_TRANSITION) or changed concurrently
 */
export const updateAdminStatusHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = req.body as UpdateAdminStatusInput;
  const { admin, changed } = await updateAdminStatus(getAdminId(req), input, getActor(req));

  const message = !changed
    ? "Administrator is already blocked"
    : input.status === "blocked"
      ? "Administrator blocked"
      : "Administrator placed on leave";
  successResponse(res, message, admin);
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/block:
 *   post:
 *     summary: Block an administrator
 *     description: |
 *       Same as PATCH /api/v1/admin/users/{id}/status with status "blocked".
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: Repeated policy violations }
 *     responses:
 *       200:
 *         description: Administrator blocked
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF or MANAGER_PROTECTED
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 */
export const blockAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await updateAdminStatus(
    getAdminId(req),
    { status: "blocked", reason: req.body.reason },
    getActor(req),
  );
  successResponse(
    res,
    "Your user account has been blocked. Please contact the system administrator.",
  );
};

/**
 * @swagger
 * /api/v1/admin/users/{id}/unblock:
 *   patch:
 *     summary: Reactivate a blocked or on-leave administrator
 *     description: |
 *       Restores a blocked (by an admin or automatically) or on-leave administrator to active, clearing the block and leave
 *       details. Administrators with any other status are left unchanged.
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Administrator reactivated (or unchanged)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF or MANAGER_PROTECTED
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 *       409:
 *         description: Status changed concurrently
 */
export const unblockAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { changed } = await reactivateAdmin(getAdminId(req), getActor(req));
  successResponse(
    res,
    changed
      ? "Your user account has been unblocked."
      : "User account is not blocked or on leave.",
  );
};

/**
 * @swagger
 * /api/v1/admin/users/roles/assign:
 *   post:
 *     summary: Assign or unassign roles
 *     description: |
 *       "assign" adds the roles in roleIds to the ones the administrator already holds.
 *       "unassign" removes the roles in roleIds, or every role when roleIds is omitted.
 *       PUT /api/v1/admin/users/{id}/roles sets the complete list in one call instead.
 *       Requires the admin.user_management.update_user permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, userId]
 *             properties:
 *               action: { type: string, enum: [assign, unassign], example: assign }
 *               userId: { type: string, format: uuid }
 *               roleIds: { type: array, items: { type: integer }, minItems: 1, maxItems: 10, example: [7, 9], description: Required for assign }
 *     responses:
 *       200:
 *         description: Roles assigned or unassigned
 *       400:
 *         description: Validation failed or role does not exist (INVALID_ROLE)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, CANNOT_MANAGE_SELF, MANAGER_PROTECTED, MANAGER_ROLE_NOT_ASSIGNABLE or PERMISSION_ESCALATION
 *       404:
 *         description: No administrator with this ID in your business (ADMIN_NOT_FOUND)
 */
export const assignRoleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = getActor(req);
  const { action, userId, roleIds } = req.body;

  if (action === "assign") {
    await assignAdminRoles(userId, roleIds, actor);
    return successResponse(res, "User role has been assigned");
  }

  await unassignAdminRoles(userId, roleIds, actor);
  successResponse(res, "User role has been unassigned");
};
