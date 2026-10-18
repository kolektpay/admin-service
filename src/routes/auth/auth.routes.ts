import { Router } from "express";

import {
  authenticateRefreshTokenHandler,
  emailLiveCheckHandler,
  enableTwoFactorHandler,
  forgotPasswordHandler,
  getBusinessTypeListHandler,
  loginHandler,
  logoutHandler,
  mustChangePasswordHandler,
  resetPasswordHandler,
  setupTwoFactorHandler,
} from "../../controllers/auth/user.auth/auth.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { requestThrottle } from "../../middleware/reqThrottle.middleware";
import {
  validate,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import { liveEmailCheckSchema } from "../../validations/liveCheckEmail.schema";
import { UserSchema } from "../../validations/userLogin.schema";
import { passwordValidationSchema } from "../../validations/uservalidation.schema";


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
router.get(
  "/live-email-check",
  validateUserQueryParams(liveEmailCheckSchema),
  emailLiveCheckHandler,
);



export default router;