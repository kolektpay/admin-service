import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRolePermissions,
} from "../../services/role.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  CreateRoleInput,
  ListPermissionsQuery,
  ListRolesQuery,
  UpdateRolePermissionsInput,
} from "../../validations/roleManagement.schema";

// Business and actor come from the JWT (requirePermission guarantees both are present)
const getActor = (req: Request): AdminActor => ({
  userId: req.userId as string,
  businessId: BigInt(req.businessId!),
  ip: extractRequestMetadata(req).ip,
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 61 }
 *         name: { type: string, example: admin.user_management.read_user }
 *         description: { type: string, example: Read user }
 *         type: { type: string, enum: [action, menu], example: action }
 *     Role:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 7 }
 *         name: { type: string, example: Bursar }
 *         type: { type: string, enum: [fixed, custom], example: custom }
 *         scope:
 *           type: string
 *           enum: [system, business]
 *           description: system roles are built in and shared by every business; business roles belong to yours
 *           example: business
 *         assignedAdminsCount: { type: integer, description: Administrators in your business holding this role, example: 2 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         permissions:
 *           type: array
 *           items: { $ref: '#/components/schemas/Permission' }
 *     Pagination:
 *       type: object
 *       properties:
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         total: { type: integer, example: 23 }
 *         totalPages: { type: integer, example: 3 }
 *     ValidationError:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         code: { type: string, example: VALIDATION_ERROR }
 *         message: { type: string, example: Request validation failed }
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string, example: name }
 *               message: { type: string, example: Role name must be at least 2 characters }
 *         requestId: { type: string }
 */

/**
 * @swagger
 * /api/v1/admin/permissions:
 *   get:
 *     summary: List the permissions that can be granted to a role
 *     description: |
 *       Returns admin permissions (student and guardian permissions are not
 *       assignable to staff roles). Blacklisted permissions are excluded.
 *       Requires the admin.role_management.read_role permission.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 200, default: 200 } }
 *       - { in: query, name: type, schema: { type: string, enum: [action, menu] } }
 *       - { in: query, name: search, schema: { type: string }, description: Partial match on name or description, example: user_management }
 *     responses:
 *       200:
 *         description: Permissions fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Permissions fetched successfully
 *               data:
 *                 permissions:
 *                   - { id: 61, name: admin.user_management.read_user, description: Read user, type: action }
 *                   - { id: 10, name: admin.menu.usermanagement, description: User management, type: menu }
 *                 pagination: { page: 1, limit: 200, total: 2, totalPages: 1 }
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
export const listPermissionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listPermissions(req.query as unknown as ListPermissionsQuery);
  successResponse(res, "Permissions fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/roles:
 *   get:
 *     summary: List roles with their permissions
 *     description: |
 *       Returns the built-in roles plus your business's custom roles, sorted by name,
 *       each with its permissions. Requires the admin.role_management.read_role permission.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: search, schema: { type: string }, description: Case-insensitive partial match on role name, example: burs }
 *     responses:
 *       200:
 *         description: Roles fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Roles fetched successfully
 *               data:
 *                 roles:
 *                   - id: 7
 *                     name: Bursar
 *                     type: custom
 *                     scope: business
 *                     assignedAdminsCount: 2
 *                     createdAt: "2026-10-16T09:12:44.000Z"
 *                     updatedAt: "2026-10-16T09:12:44.000Z"
 *                     permissions:
 *                       - { id: 61, name: admin.user_management.read_user, description: Read user, type: action }
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
export const listRolesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listRoles(
    getActor(req).businessId,
    req.query as unknown as ListRolesQuery,
  );
  successResponse(res, "Roles fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/roles:
 *   post:
 *     summary: Create a custom role and assign permissions to it
 *     description: |
 *       Creates a role owned by your business. The name must not match (case-insensitively)
 *       a built-in role or another of your business's roles. Every permission must exist,
 *       be an admin permission, and be one you hold yourself. The role and its permissions
 *       are saved in one transaction. Requires the admin.role_management.create_role permission.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, permissionIds]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50, example: Bursar }
 *               permissionIds:
 *                 type: array
 *                 items: { type: integer }
 *                 minItems: 1
 *                 description: Duplicates are ignored
 *                 example: [61, 62]
 *     responses:
 *       201:
 *         description: Role created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Role created successfully
 *               data:
 *                 id: 7
 *                 name: Bursar
 *                 type: custom
 *                 scope: business
 *                 assignedAdminsCount: 0
 *                 createdAt: "2026-10-16T09:12:44.000Z"
 *                 updatedAt: "2026-10-16T09:12:44.000Z"
 *                 permissions:
 *                   - { id: 61, name: admin.user_management.read_user, description: Read user, type: action }
 *                   - { id: 62, name: admin.user_management.search_user, description: Search user, type: action }
 *       400:
 *         description: Validation failed (VALIDATION_ERROR) or unknown / non-assignable permission IDs (INVALID_PERMISSION)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: INVALID_PERMISSION
 *               message: One or more permissions do not exist or cannot be assigned to a role
 *               details:
 *                 - { field: permissionIds, message: Permission 999 does not exist or cannot be assigned to a role }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, or granting a permission you do not hold (PERMISSION_ESCALATION)
 *       409:
 *         description: Role name already in use (ROLE_NAME_TAKEN)
 */
export const createRoleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const role = await createRole(req.body as CreateRoleInput, getActor(req));
  successResponse(res, "Role created successfully", role, 201);
};

/**
 * @swagger
 * /api/v1/admin/roles/{roleId}:
 *   delete:
 *     summary: Delete a custom role
 *     description: |
 *       Deletes one of your business's custom roles and its permission assignments.
 *       Built-in roles cannot be deleted, and a role cannot be deleted while any
 *       administrator holds it: reassign them first.
 *       Requires the admin.role_management.delete_role permission.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: roleId, required: true, schema: { type: integer }, example: 7 }
 *     responses:
 *       200:
 *         description: Role deleted
 *         content:
 *           application/json:
 *             example: { success: true, message: Role deleted successfully }
 *       400:
 *         description: Invalid roleId
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, or the role is built in (SYSTEM_ROLE)
 *       404:
 *         description: Role not found in your business (ROLE_NOT_FOUND)
 *       409:
 *         description: Role is assigned to administrators (ROLE_IN_USE)
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: ROLE_IN_USE
 *               message: This role is assigned to 2 administrator(s). Reassign them before deleting it.
 */
export const deleteRoleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await deleteRole(req.params.roleId as unknown as bigint, getActor(req));
  successResponse(res, "Role deleted successfully");
};

/**
 * @swagger
 * /api/v1/admin/roles/{roleId}/permissions:
 *   put:
 *     summary: Replace a role's permissions
 *     description: |
 *       Sets the full list of permissions on one of your business's custom roles:
 *       IDs not in the list are removed, new ones are granted, and the change is
 *       saved in one transaction. Every ID must be a valid admin permission, and
 *       any permission being newly granted must be one you hold yourself.
 *       Requires the admin.role_management.update_role permission.
 *     tags:
 *       - Roles & Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: roleId, required: true, schema: { type: integer }, example: 7 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissionIds]
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items: { type: integer }
 *                 minItems: 1
 *                 description: The complete set the role should have. Duplicates are ignored
 *                 example: [61, 62]
 *     responses:
 *       200:
 *         description: Permissions updated — returns the updated role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Role permissions updated successfully }
 *                 data: { $ref: '#/components/schemas/Role' }
 *       400:
 *         description: Validation error or unknown / non-assignable permission IDs (INVALID_PERMISSION)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission, built-in role (SYSTEM_ROLE), or granting a permission you do not hold (PERMISSION_ESCALATION)
 *       404:
 *         description: Role not found in your business (ROLE_NOT_FOUND)
 */
export const updateRolePermissionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const role = await updateRolePermissions(
    req.params.roleId as unknown as bigint,
    req.body as UpdateRolePermissionsInput,
    getActor(req),
  );
  successResponse(res, "Role permissions updated successfully", role);
};
