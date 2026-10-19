import { Router } from "express";

import {
  assignRoleHandler,
  blockAdminHandler,
  createAdminHandler,
  deleteAdminHandler,
  getAdminHandler,
  listAdminsHandler,
  setAdminRolesHandler,
  unblockAdminHandler,
  updateAdminHandler,
  updateAdminStatusHandler,
} from "../controllers/admin/admin.controller";
import {
  viewAuditLogsHandler,
  fetchRolesAndPermissionsHandler,
  enforcePasswordRotationHandler,
  changeAnyUserPasswordHandler,
} from "../controllers/guardian/guardian.controller";
import {
  getAllPaymentItemsGeneratedAccordingToBusinessIdAndClassIdHandler,
  createNewPaymentItemsAccordingToBusinessIdAndClassIdHandler,
  updatePaymentItemsAccordingToBusinessIdAndClassIdHandler,
  approvePaymentItemsAccordingToBusinessIdAndClassIdHandler,
} from "../controllers/paymentItem.controller";
import {
  authenticateJWT,
  checkIfStaffHasPaymentItemApprovalPermission,
  requireManager,
  requirePermission,
} from "../middleware/auth.middleware";
import { validate, validateRequest } from "../middleware/validation.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  adminIdParamsSchema,
  createAdminSchema,
  listAdminsQuerySchema,
  roleAssignmentSchema,
  setAdminRolesSchema,
  updateAdminSchema,
  updateAdminStatusSchema,
} from "../validations/adminManagement.schema";
import { paymentItemGeneratorSchema } from "../validations/paymentItemGenerator.schema";
import {
  blockUserValidationSchema,
  getUserValidationSchemaForReqBodyUuid,
  changeUserPasswordVoluntarilyValidationSchema,
} from "../validations/uservalidation.schema";

const router = Router();

const canReadAdmins = requirePermission("admin.user_management.read_user");
const canCreateAdmins = requirePermission("admin.user_management.create_user");
const canUpdateAdmins = requirePermission("admin.user_management.update_user");
const canDeleteAdmins = requirePermission("admin.user_management.delete_user");

// ==========================================
// Payment Items Routes
// ==========================================
router.get(
  "/payment-items",
  authenticateJWT,
  getAllPaymentItemsGeneratedAccordingToBusinessIdAndClassIdHandler,
);

router.post(
  "/payment-items",
  authenticateJWT,
  validate(paymentItemGeneratorSchema),
  createNewPaymentItemsAccordingToBusinessIdAndClassIdHandler,
);

// TODO: this currently reuses the CREATE handler (generates a new invoice
// number, inserts a new row, fires the approval notification) rather than
// updating an existing payment item. Point this at a real update handler
// once one exists.
router.patch(
  "/payment-items",
  authenticateJWT,
  updatePaymentItemsAccordingToBusinessIdAndClassIdHandler,
);

router.patch(
  "/payment-items/approve",
  authenticateJWT,
  checkIfStaffHasPaymentItemApprovalPermission,
  approvePaymentItemsAccordingToBusinessIdAndClassIdHandler,
);

// ==========================================
// Admin & User Management Routes
// ==========================================

// Audit logs
router.get(
  "/audit-logs/:userId?",
  authenticateJWT,
  requireManager,
  viewAuditLogsHandler,
);

// Roles and permissions
router.get(
  "/roles-and-permissions",
  authenticateJWT,
  requireManager,
  fetchRolesAndPermissionsHandler,
);

router.get(
  "/users",
  authenticateJWT,
  canReadAdmins,
  validateRequest("query", listAdminsQuerySchema),
  asyncHandler(listAdminsHandler),
);

router.post(
  "/users",
  authenticateJWT,
  canCreateAdmins,
  validateRequest("body", createAdminSchema),
  asyncHandler(createAdminHandler),
);

router.post(
  "/users/roles/assign",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("body", roleAssignmentSchema),
  asyncHandler(assignRoleHandler),
);

// Password rotation
router.post(
  "/users/password/enforce-rotation",
  authenticateJWT,
  requireManager,
  validate(getUserValidationSchemaForReqBodyUuid),
  enforcePasswordRotationHandler,
);

// Password change
router.post(
  "/users/password/change",
  authenticateJWT,
  validate(changeUserPasswordVoluntarilyValidationSchema),
  changeAnyUserPasswordHandler,
);

router.get(
  "/users/:id",
  authenticateJWT,
  canReadAdmins,
  validateRequest("params", adminIdParamsSchema),
  asyncHandler(getAdminHandler),
);

router.patch(
  "/users/:id",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("params", adminIdParamsSchema),
  validateRequest("body", updateAdminSchema),
  asyncHandler(updateAdminHandler),
);

router.delete(
  "/users/:id",
  authenticateJWT,
  canDeleteAdmins,
  validateRequest("params", adminIdParamsSchema),
  asyncHandler(deleteAdminHandler),
);

router.put(
  "/users/:id/roles",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("params", adminIdParamsSchema),
  validateRequest("body", setAdminRolesSchema),
  asyncHandler(setAdminRolesHandler),
);

router.patch(
  "/users/:id/status",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("params", adminIdParamsSchema),
  validateRequest("body", updateAdminStatusSchema),
  asyncHandler(updateAdminStatusHandler),
);

router.post(
  "/users/:id/block",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("params", adminIdParamsSchema),
  validateRequest("body", blockUserValidationSchema),
  asyncHandler(blockAdminHandler),
);

router.patch(
  "/users/:id/unblock",
  authenticateJWT,
  canUpdateAdmins,
  validateRequest("params", adminIdParamsSchema),
  asyncHandler(unblockAdminHandler),
);

export default router;
