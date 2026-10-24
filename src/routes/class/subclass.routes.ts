import { Router } from "express";

import {
  createSubclassHandler,
  deleteSubclassHandler,
  getSubclassHandler,
  listSubclassesHandler,
  listSubclassStudentsHandler,
  updateSubclassHandler,
} from "../../controllers/admin/class.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createSubclassSchema,
  listSubclassesQuerySchema,
  listSubclassStudentsQuerySchema,
  subclassIdParamsSchema,
  updateSubclassSchema,
} from "../../validations/classManagement.schema";
import {
  canCreateClasses,
  canDeleteClasses,
  canReadClasses,
  canReadStudents,
  canUpdateClasses,
} from "./classPermissions";

const router = Router();

// ==========================================
// Subclass Management Routes
// ==========================================

router.get(
  "/",
  authenticateJWT,
  canReadClasses,
  validateRequest("query", listSubclassesQuerySchema),
  asyncHandler(listSubclassesHandler),
);

router.post(
  "/",
  authenticateJWT,
  canCreateClasses,
  validateRequest("body", createSubclassSchema),
  asyncHandler(createSubclassHandler),
);

router.get(
  "/:subclassId",
  authenticateJWT,
  canReadClasses,
  validateRequest("params", subclassIdParamsSchema),
  asyncHandler(getSubclassHandler),
);

router.patch(
  "/:subclassId",
  authenticateJWT,
  canUpdateClasses,
  validateRequest("params", subclassIdParamsSchema),
  validateRequest("body", updateSubclassSchema),
  asyncHandler(updateSubclassHandler),
);

router.delete(
  "/:subclassId",
  authenticateJWT,
  canDeleteClasses,
  validateRequest("params", subclassIdParamsSchema),
  asyncHandler(deleteSubclassHandler),
);

router.get(
  "/:subclassId/students",
  authenticateJWT,
  canReadStudents,
  validateRequest("params", subclassIdParamsSchema),
  validateRequest("query", listSubclassStudentsQuerySchema),
  asyncHandler(listSubclassStudentsHandler),
);

export default router;
