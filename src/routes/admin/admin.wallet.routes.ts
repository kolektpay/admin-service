import { Router } from "express";
import {
  createStudentWalletHandler,
  generatePaymentLinkHandler,
  getAllPaymentLinksForOneBusinessHandler,
  getSpecificStudentWalletAccordingToBusinessIdHandler,
  getWalletDetailsonLoginHandler,
} from "../../controllers/admin/wallet.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { createStudentWalletSchema } from "../../validations/createStudentWallet.schema";

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



router.get(
  "/:walletid",
  authenticateJWT,
  getSpecificStudentWalletAccordingToBusinessIdHandler,
);
export default router;
