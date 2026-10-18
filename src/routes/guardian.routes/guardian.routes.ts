import { Router } from "express";

import {
  createNewGuardianAccordingToBusinessIdHandler,
  deleteGuardianInfoHandler,
  getAllGuardianInfoAccordingToBusinessIdHandler,
  updateGuardianInfoHandler,
} from "../../controllers/guardian/guardian.controller";
import {
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
} from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createGuardianSchema } from "../../validations/guardianCreationInfoValidation.schema";

const router = Router();

router.get(
  "/",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  getAllGuardianInfoAccordingToBusinessIdHandler,
);

router.post(
  "/",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  validate(createGuardianSchema),
  createNewGuardianAccordingToBusinessIdHandler,
);

router.patch(
  "/:guardianid",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  updateGuardianInfoHandler,
);

router.delete(
  "/:guardianid",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  deleteGuardianInfoHandler,
);

export default router;
