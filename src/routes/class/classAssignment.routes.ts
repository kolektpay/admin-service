import { Router } from "express";

import {
  assignStudentHandler,
  bulkAssignStudentsHandler,
  bulkTransferStudentsHandler,
  getStudentAssignmentHandler,
  unassignStudentHandler,
} from "../../controllers/admin/classAssignment.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { userActionThrottle } from "../../middleware/reqThrottle.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  assignStudentSchema,
  bulkAssignStudentsSchema,
  bulkTransferStudentsSchema,
} from "../../validations/classManagement.schema";
import { studentIdParamsSchema } from "../../validations/studentManagement.schema";
import { canAssignStudents, canReadStudents } from "./classPermissions";

const router = Router();

// ==========================================
// Student Class Assignment Routes
// ==========================================

router.post(
  "/transfers",
  authenticateJWT,
  canAssignStudents,
  userActionThrottle("students-bulk-transfer", 10, 60),
  validateRequest("body", bulkTransferStudentsSchema),
  asyncHandler(bulkTransferStudentsHandler),
);

router.put(
  "/students",
  authenticateJWT,
  canAssignStudents,
  userActionThrottle("students-bulk-assign", 10, 60),
  validateRequest("body", bulkAssignStudentsSchema),
  asyncHandler(bulkAssignStudentsHandler),
);

router.get(
  "/students/:studentId",
  authenticateJWT,
  canReadStudents,
  validateRequest("params", studentIdParamsSchema),
  asyncHandler(getStudentAssignmentHandler),
);

router.put(
  "/students/:studentId",
  authenticateJWT,
  canAssignStudents,
  validateRequest("params", studentIdParamsSchema),
  validateRequest("body", assignStudentSchema),
  asyncHandler(assignStudentHandler),
);

router.delete(
  "/students/:studentId",
  authenticateJWT,
  canAssignStudents,
  validateRequest("params", studentIdParamsSchema),
  asyncHandler(unassignStudentHandler),
);

export default router;
