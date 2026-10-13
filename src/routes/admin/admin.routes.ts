import { Router } from "express";
import {
  authenticateJWT,
  checkIfStaffHasPaymentItemApprovalPermission,
  requireManager,
} from "../../middleware/auth.middleware";
import {
  validate,
  validateUserParams,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import {
  viewAuditLogsHandler,
  fetchRolesAndPermissionsHandler,
  getEveryUserHandler,
  createNewUserHandler,
  updateExistingUserHandler,
  deleteAUserHandler,
  blockExistingUserHandler,
  unblockExistingUserHandler,
  assignRoleToUserHandler,
  enforcePasswordRotationHandler,
  changeAnyUserPasswordHandler,
  getUserByIdHandler,
} from "../../controllers/admin/admin.controller";
import {
  getAllPaymentItemsGeneratedAccordingToBusinessIdAndClassIdHandler,
  createNewPaymentItemsAccordingToBusinessIdAndClassIdHandler,
  updatePaymentItemsAccordingToBusinessIdAndClassIdHandler,
  approvePaymentItemsAccordingToBusinessIdAndClassIdHandler,
} from "../../controllers/paymentItem.controller";

import { paymentItemGeneratorSchema } from "../../validations/paymentItemGenerator.schema";
import {
  createUserValidationSchema,
  updateUserValidationSchema,
  getUserValidationByUuidSchema,
  blockUserValidationSchema,
  roleActionSchema,
  getUserValidationSchemaForReqBodyUuid,
  changeUserPasswordVoluntarilyValidationSchema,
  getUserWithOptionalQueryParamsAndSearch,
} from "../../validations/uservalidation.schema";

const router = Router();

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

// Get all users
router.get(
  "/users",
  validateUserQueryParams(getUserWithOptionalQueryParamsAndSearch),
  authenticateJWT,
  requireManager,
  getEveryUserHandler,
);

// Create a new user
router.post(
  "/users",
  authenticateJWT,
  requireManager,
  validate(createUserValidationSchema),
  createNewUserHandler,
);

// Assign role
router.post(
  "/users/roles/assign",
  authenticateJWT,
  requireManager,
  validate(roleActionSchema),
  assignRoleToUserHandler,
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

// Get user by ID
router.get(
  "/users/:id",
  authenticateJWT,
  requireManager,
  validateUserParams(getUserValidationByUuidSchema),
  getUserByIdHandler,
);

// Update user
router.patch(
  "/users/:id",
  authenticateJWT,
  requireManager,
  validateUserParams(getUserValidationByUuidSchema), //validating for userid
  validate(updateUserValidationSchema), // validating for req.body
  updateExistingUserHandler,
);

// Delete user
router.delete(
  "/users/:id",
  authenticateJWT,
  requireManager,
  validateUserParams(getUserValidationByUuidSchema),
  deleteAUserHandler,
);

// Block user
router.post(
  "/users/:id/block",
  authenticateJWT,
  requireManager,
  validateUserParams(getUserValidationByUuidSchema),
  validate(blockUserValidationSchema),
  blockExistingUserHandler,
);

// Unblock user
router.patch(
  "/users/:id/unblock",
  authenticateJWT,
  requireManager,
  unblockExistingUserHandler,
);

export default router;
