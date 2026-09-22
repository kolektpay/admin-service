import { Router } from "express";
import { authenticateJWT, checkIfStaffHasStudentGuardianPermission } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createGuardianSchema } from "../../validations/guardianCreationInfoValidation.schema";
import {
  createNewGuardianAccordingToBusinessIdHandler,
  deleteGuardianInfoHandler,
  getAllGuardianInfoAccordingToBusinessIdHandler,
  updateGuardianInfoHandler,
} from "../../controllers/admin/admin.controller";


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
