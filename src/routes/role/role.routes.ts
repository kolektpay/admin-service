import { Router } from "express";

import {
  createRoleHandler,
  deleteRoleHandler,
  listPermissionsHandler,
  listRolesHandler,
  updateRolePermissionsHandler,
} from "../../controllers/admin/role.controller";
import {
  authenticateJWT,
  requirePermission,
} from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createRoleSchema,
  listPermissionsQuerySchema,
  listRolesQuerySchema,
  roleIdParamsSchema,
  updateRolePermissionsSchema,
} from "../../validations/roleManagement.schema";

const router = Router();

const canReadRoles = requirePermission("admin.role_management.read_role");
const canCreateRoles = requirePermission("admin.role_management.create_role");
const canUpdateRoles = requirePermission("admin.role_management.update_role");
const canDeleteRoles = requirePermission("admin.role_management.delete_role");

// ==========================================
// Role & Permission Management Routes
// ==========================================

router.get(
  "/permissions",
  authenticateJWT,
  canReadRoles,
  validateRequest("query", listPermissionsQuerySchema),
  asyncHandler(listPermissionsHandler),
);

router.get(
  "/roles",
  authenticateJWT,
  canReadRoles,
  validateRequest("query", listRolesQuerySchema),
  asyncHandler(listRolesHandler),
);

router.post(
  "/roles",
  authenticateJWT,
  canCreateRoles,
  validateRequest("body", createRoleSchema),
  asyncHandler(createRoleHandler),
);

router.delete(
  "/roles/:roleId",
  authenticateJWT,
  canDeleteRoles,
  validateRequest("params", roleIdParamsSchema),
  asyncHandler(deleteRoleHandler),
);

router.put(
  "/roles/:roleId/permissions",
  authenticateJWT,
  canUpdateRoles,
  validateRequest("params", roleIdParamsSchema),
  validateRequest("body", updateRolePermissionsSchema),
  asyncHandler(updateRolePermissionsHandler),
);

export default router;
