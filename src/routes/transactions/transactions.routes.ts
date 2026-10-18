import { Router } from "express";

import {
  getWalletTransactionByReferenceNumberHandler,
  getWalletTransactionHistoryHandler,
} from "../../controllers/transactions.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import {
  validateUserParams,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import {
  transactionQuerySchema,
  transactionReferenceNumberParamsSchema,
  transactionWalletIdParamsSchema,
} from "../../validations/transaction.schema";

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
