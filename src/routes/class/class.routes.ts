import { Router } from "express";

import { getClassHandler, listClassesHandler } from "../../controllers/admin/class.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  classIdParamsSchema,
  listClassesQuerySchema,
} from "../../validations/classManagement.schema";
import { canReadClasses } from "./classPermissions";

const router = Router();

// ==========================================
// Class Management Routes
// ==========================================

// Classes are a global catalogue managed by the seeder, so they are read-only here

router.get(
  "/",
  authenticateJWT,
  canReadClasses,
  validateRequest("query", listClassesQuerySchema),
  asyncHandler(listClassesHandler),
);

router.get(
  "/:classId",
  authenticateJWT,
  canReadClasses,
  validateRequest("params", classIdParamsSchema),
  asyncHandler(getClassHandler),
);

export default router;
