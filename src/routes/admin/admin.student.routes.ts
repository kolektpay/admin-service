import {
  blockStudentHandler,
  bulkCreateStudentsHandler,
  createStudentHandler,
  deleteStudentHandler,
  listStudentsHandler,
  unblockStudentHandler,
  updateStudentHandler,
} from "../../controllers/admin/admin.student.controller";
import {
  blockStudentSchema,
  bulkCreateStudentsSchema,
  bulkStudentRecordSchema,
  listStudentsQuerySchema,
  studentIdParamsSchema,
  unblockStudentSchema,
  updateStudentSchema,
} from "../../validations/studentManagement.schema";
import { Router } from "express";
import { authenticateJWT, requirePermission } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { userActionThrottle } from "../../middleware/reqThrottle.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

const canReadStudents = requirePermission("admin.student_management.read_student");
const canCreateStudents = requirePermission("admin.student_management.create_student");
const canUpdateStudents = requirePermission("admin.student_management.update_student");
const canDeleteStudents = requirePermission("admin.student_management.delete_student");

// ==========================================
// Student Management Routes
// ==========================================

router.get(
  "/",
  authenticateJWT,
  canReadStudents,
  validateRequest("query", listStudentsQuerySchema),
  asyncHandler(listStudentsHandler),
);

router.post(
  "/",
  authenticateJWT,
  canCreateStudents,
  validateRequest("body", bulkStudentRecordSchema),
  asyncHandler(createStudentHandler),
);

router.post(
  "/bulk",
  authenticateJWT,
  canCreateStudents,
  userActionThrottle("students-bulk-create", 10, 60),
  validateRequest("body", bulkCreateStudentsSchema),
  asyncHandler(bulkCreateStudentsHandler),
);

router.patch(
  "/:studentId/block",
  authenticateJWT,
  canUpdateStudents,
  validateRequest("params", studentIdParamsSchema),
  validateRequest("body", blockStudentSchema),
  asyncHandler(blockStudentHandler),
);

router.patch(
  "/:studentId/unblock",
  authenticateJWT,
  canUpdateStudents,
  validateRequest("params", studentIdParamsSchema),
  validateRequest("body", unblockStudentSchema),
  asyncHandler(unblockStudentHandler),
);

router.patch(
  "/:studentId",
  authenticateJWT,
  canUpdateStudents,
  validateRequest("params", studentIdParamsSchema),
  validateRequest("body", updateStudentSchema),
  asyncHandler(updateStudentHandler),
);

router.delete(
  "/:studentId",
  authenticateJWT,
  canDeleteStudents,
  validateRequest("params", studentIdParamsSchema),
  asyncHandler(deleteStudentHandler),
);

export default router;
