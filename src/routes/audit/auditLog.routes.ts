import { Router } from "express";

import {
  listAdminAuditLogsHandler,
  listAuditLogsHandler,
  listGuardianAuditLogsHandler,
  listOwnAuditLogsHandler,
  listStudentAuditLogsHandler,
} from "../../controllers/admin/auditLog.controller";
import {
  authenticateJWT,
  requireBusinessContext,
  requirePermission,
} from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  auditLogGuardianParamsSchema,
  auditLogStudentParamsSchema,
  auditLogUserParamsSchema,
  listAccountAuditLogsQuerySchema,
  listAuditLogsQuerySchema,
  listOwnAuditLogsQuerySchema,
} from "../../validations/auditLog.schema";

const router = Router();

const canViewAllAuditLogs = requirePermission("admin.audit_logs.view_all");
const canViewOwnAuditLogs = requirePermission("admin.audit_logs.view_own");

// ==========================================
// Audit Log Routes
// The business is always taken from the token, never from the request.
// ==========================================

// Registered before "/:userId" so "me" is never read as an administrator ID
router.get(
  "/me",
  authenticateJWT,
  requireBusinessContext,
  canViewOwnAuditLogs,
  validateRequest("query", listOwnAuditLogsQuerySchema),
  asyncHandler(listOwnAuditLogsHandler),
);

router.get(
  "/",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("query", listAuditLogsQuerySchema),
  asyncHandler(listAuditLogsHandler),
);

router.get(
  "/students/:studentId",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("params", auditLogStudentParamsSchema),
  validateRequest("query", listAccountAuditLogsQuerySchema),
  asyncHandler(listStudentAuditLogsHandler),
);

router.get(
  "/guardians/:guardianId",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("params", auditLogGuardianParamsSchema),
  validateRequest("query", listAccountAuditLogsQuerySchema),
  asyncHandler(listGuardianAuditLogsHandler),
);

// An administrator's logs; must stay after "/me"
router.get(
  "/:userId",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("params", auditLogUserParamsSchema),
  validateRequest("query", listOwnAuditLogsQuerySchema),
  asyncHandler(listAdminAuditLogsHandler),
);

export default router;
