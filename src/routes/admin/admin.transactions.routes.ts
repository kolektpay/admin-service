import { Router } from "express";
import {
  getWalletTransactionByReferenceNumberHandler,
  getWalletTransactionHistoryHandler,
} from "../../controllers/admin/transactions.controller";
import {
  transactionQuerySchema,
  transactionReferenceNumberParamsSchema,
  transactionWalletIdParamsSchema,
} from "../../validations/transaction.schema";
import {
  validateUserParams,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import { authenticateJWT } from "../../middleware/auth.middleware";

const router = Router();

router.get(
  "/wallets/:walletid",
  validateUserQueryParams(transactionQuerySchema),
  validateUserParams(transactionWalletIdParamsSchema),
  authenticateJWT,
  getWalletTransactionHistoryHandler,
);

router.get(
  "/reference/:referencenumber",
  validateUserParams(transactionReferenceNumberParamsSchema),
  authenticateJWT,
  getWalletTransactionByReferenceNumberHandler,
);

export default router;
