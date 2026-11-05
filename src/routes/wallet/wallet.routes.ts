import { Router } from "express";

import {
  createBusinessWalletHandler,
  createStudentWalletHandler,
  generatePaymentLinkHandler,
  getAllPaymentLinksForOneBusinessHandler,
  getPaymentItemWalletHandler,
  getSpecificStudentWalletAccordingToBusinessIdHandler,
  getWalletDetailsonLoginHandler,
  searchWalletsHandler,
} from "../../controllers/wallet.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validate, validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { createStudentWalletSchema } from "../../validations/createStudentWallet.schema";
import {
  paymentItemWalletParamsSchema,
  walletSearchQuerySchema,
} from "../../validations/wallet.schema";
import { canManageWallets } from "./walletServicePermissions";

const router = Router();

// wallet routes

router.get("/", authenticateJWT, getWalletDetailsonLoginHandler);


router.post(
  "/payment-links",
  authenticateJWT,
  generatePaymentLinkHandler,
);

router.post(
  "/student-wallets",
  authenticateJWT,
  validate(createStudentWalletSchema),

  createStudentWalletHandler,
);

router.get(
  "/payment-links",
  authenticateJWT,
  getAllPaymentLinksForOneBusinessHandler,
);

// Wallet service routes - must stay above "/:walletid" or Express treats them as a wallet id
router.post(
  "/create",
  authenticateJWT,
  canManageWallets,
  asyncHandler(createBusinessWalletHandler),
);

router.get(
  "/search",
  authenticateJWT,
  canManageWallets,
  validateRequest("query", walletSearchQuerySchema),
  asyncHandler(searchWalletsHandler),
);

router.get(
  "/payment-wallet/:paymentItemId",
  authenticateJWT,
  canManageWallets,
  validateRequest("params", paymentItemWalletParamsSchema),
  asyncHandler(getPaymentItemWalletHandler),
);

router.get(
  "/:walletid",
  authenticateJWT,
  getSpecificStudentWalletAccordingToBusinessIdHandler,
);
export default router;
