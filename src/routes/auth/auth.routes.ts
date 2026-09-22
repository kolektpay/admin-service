import { Router } from "express";
import { UserSchema } from "../../validations/userLogin.schema";
import {
  authenticateRefreshTokenHandler,
  emailLiveCheckHandler,
  enableTwoFactorHandler,
  forgotPasswordHandler,
  getBusinessTypeListHandler,
  loginHandler,
  logoutHandler,
  mustChangePasswordHandler,
  otpVerifyHandler,
  registerUserWithKolektSuperAdminHandler,
  resendOtpHandler,
  resetPasswordHandler,
  setupTwoFactorHandler,
} from "../../controllers/auth/user.auth/auth.controller";
import {
  validate,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import { requestThrottle } from "../../middleware/reqThrottle.middleware";
import {
  authenticateJWT,
  requireKolektSuperAdmin,
} from "../../middleware/auth.middleware";
import { passwordValidationSchema } from "../../validations/uservalidation.schema";
import { liveEmailCheckSchema } from "../../validations/liveCheckEmail.schema";


const router = Router();

// ==========================================
// Admin / Staff Auth Routes
// ==========================================
router.get("/types", getBusinessTypeListHandler);
router.post("/login", validate(UserSchema), loginHandler);
router.post("/refresh", authenticateRefreshTokenHandler);
router.post("/logout", authenticateJWT, logoutHandler);
router.post("/2fa/setup", setupTwoFactorHandler);
router.post("/2fa/enable", enableTwoFactorHandler);
router.post("/forgot-password", requestThrottle(3, 10), forgotPasswordHandler);
router.post("/reset-password", requestThrottle(3, 10), resetPasswordHandler);
router.post(
  "/must-change-password",
  requestThrottle(3, 10),
  validate(passwordValidationSchema),
  mustChangePasswordHandler,
);
router.post("/verify-otp", requestThrottle(3, 10), otpVerifyHandler);
router.post("/resend-otp", requestThrottle(3, 10), resendOtpHandler);
router.post(
  "/register",
  authenticateJWT,
  requireKolektSuperAdmin,
  registerUserWithKolektSuperAdminHandler,
); //only kolekt super admin should be able to access this
router.get(
  "/live-email-check",
  validateUserQueryParams(liveEmailCheckSchema),
  emailLiveCheckHandler,
);



export default router;