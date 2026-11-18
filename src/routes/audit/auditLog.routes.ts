import { Router } from "express";

import {
  listAdminsAuditLogsHandler,
  listAuditLogsHandler,
  listGuardiansAuditLogsHandler,
  listOwnAuditLogsHandler,
  listStudentsAuditLogsHandler,
} from "../../controllers/admin/auditLog.controller";
import {
  authenticateJWT,
  requireBusinessContext,
  requirePermission,
} from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listAdminsAuditLogsQuerySchema,
  listAuditLogsQuerySchema,
  listGuardiansAuditLogsQuerySchema,
  listOwnAuditLogsQuerySchema,
  listStudentsAuditLogsQuerySchema,
} from "../../validations/auditLog.schema";

const router = Router();

const canViewAllAuditLogs = requirePermission("admin.audit_logs.view_all");
const canViewOwnAuditLogs = requirePermission("admin.audit_logs.view_own");

// ==========================================
// Audit Log Routes
// The business is always taken from the token, never from the request.
// ==========================================

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

// One administrator with ?userId=, otherwise every administrator
router.get(
  "/admins",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("query", listAdminsAuditLogsQuerySchema),
  asyncHandler(listAdminsAuditLogsHandler),
);

// One student with ?studentId=, otherwise every student
router.get(
  "/students",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("query", listStudentsAuditLogsQuerySchema),
  asyncHandler(listStudentsAuditLogsHandler),
);

// One guardian with ?guardianId=, otherwise every guardian
router.get(
  "/guardians",
  authenticateJWT,
  requireBusinessContext,
  canViewAllAuditLogs,
  validateRequest("query", listGuardiansAuditLogsQuerySchema),
  asyncHandler(listGuardiansAuditLogsHandler),
);

export default router;
