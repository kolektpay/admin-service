import {
  forgotPasswordValidationSchema,
  studentChangePasswordValidationSchema,
  StudentOrGuardianLoginSchema,
  studentResetPasswordValidationSchema,
} from "../../validations/studentAndGuardianAccountManagementValidation.schema";
import {
  authenticateRefreshTokenForStudentAndGuardianHandler,
  forgotPasswordForStudentAndGuardianHandler,
  mustChangePasswordForStudentAndGuardianHandler,
  resetPasswordHandlerForGuardianAndStudentHandler,
  studentAndGuardianLoginHandler,
  studentAndGuardianLogoutHandler,
} from "../../controllers/auth/student.guardian.auth/auth.controller";
import {
  validate,

} from "../../middleware/validation.middleware";
import { Router } from "express";
import { requestThrottle } from "../../middleware/reqThrottle.middleware";

const router = Router();
// ==========================================
// Student / Guardian Auth Routes
// ==========================================

router.post(
  "/student/login",
  validate(StudentOrGuardianLoginSchema),
  studentAndGuardianLoginHandler,
);

router.post(
  "/student/must-change-password",
  requestThrottle(3, 10),
  validate(studentChangePasswordValidationSchema),
  mustChangePasswordForStudentAndGuardianHandler,
);

router.post(
  "/student/forgot-password",
  requestThrottle(3, 10),
  validate(forgotPasswordValidationSchema),
  forgotPasswordForStudentAndGuardianHandler,
);

router.post(
  "/student/reset-password",
  validate(studentResetPasswordValidationSchema),
  requestThrottle(3, 10),
  resetPasswordHandlerForGuardianAndStudentHandler,
);

router.post(
  "/student/refresh",
  authenticateRefreshTokenForStudentAndGuardianHandler,
);

router.post("/student-guardian/logout", studentAndGuardianLogoutHandler);


export default router;