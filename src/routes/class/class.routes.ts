import { Router } from "express";

import {
  createClassHandler,
  deleteClassHandler,
  getClassHandler,
  listClassesHandler,
  updateClassHandler,
} from "../../controllers/admin/class.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  classIdParamsSchema,
  createClassSchema,
  listClassesQuerySchema,
  updateClassSchema,
} from "../../validations/classManagement.schema";
import {
  canCreateClasses,
  canDeleteClasses,
  canReadClasses,
  canUpdateClasses,
} from "./classPermissions";

const router = Router();

// ==========================================
// Class Management Routes
// ==========================================

router.get(
  "/",
  authenticateJWT,
  canReadClasses,
  validateRequest("query", listClassesQuerySchema),
  asyncHandler(listClassesHandler),
);

router.post(
  "/",
  authenticateJWT,
  canCreateClasses,
  validateRequest("body", createClassSchema),
  asyncHandler(createClassHandler),
);

router.get(
  "/:classId",
  authenticateJWT,
  canReadClasses,
  validateRequest("params", classIdParamsSchema),
  asyncHandler(getClassHandler),
);

router.patch(
  "/:classId",
  authenticateJWT,
  canUpdateClasses,
  validateRequest("params", classIdParamsSchema),
  validateRequest("body", updateClassSchema),
  asyncHandler(updateClassHandler),
);

router.delete(
  "/:classId",
  authenticateJWT,
  canDeleteClasses,
  validateRequest("params", classIdParamsSchema),
  asyncHandler(deleteClassHandler),
);

export default router;
