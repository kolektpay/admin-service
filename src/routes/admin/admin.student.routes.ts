import {
  createNewStudentAccordingToBusinessIdHandler,
  deleteStudentInfoHandler,
  getAllStudentInfoAccordingToBusinessIdHandler,
  updateStudentInfoHandler,
} from "../../controllers/admin/admin.controller";
import { createStudentsSchema } from "../../validations/studentCreationInfoValidation.schema";
import { Router } from "express";
import {
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
} from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";

const router = Router();

// ==========================================
// Student Management Routes
// ==========================================

router.get(
  "/",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  getAllStudentInfoAccordingToBusinessIdHandler,
);

router.post(
  "/",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  validate(createStudentsSchema),
  createNewStudentAccordingToBusinessIdHandler,
);

router.patch(
  "/:registrationnumber",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  updateStudentInfoHandler,
);

router.delete(
  "/:registrationnumber",
  authenticateJWT,
  checkIfStaffHasStudentGuardianPermission,
  deleteStudentInfoHandler,
);


export default router;
