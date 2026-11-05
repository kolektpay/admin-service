import { Router } from "express";

import {
  getTransactionByReferenceHandler,
  getWalletActivityHandler,
  getWalletTransactionByReferenceNumberHandler,
  getWalletTransactionHistoryHandler,
  getWalletTransactionsHandler,
  simulateWalletInflowHandler,
} from "../../controllers/transactions.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import {
  validateRequest,
  validateUserParams,
  validateUserQueryParams,
} from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  simulateInflowBodySchema,
  transactionQuerySchema,
  transactionReferenceNumberParamsSchema,
  transactionReferenceParamsSchema,
  transactionWalletIdParamsSchema,
  walletActivityQuerySchema,
  walletTransactionHistoryParamsSchema,
  walletTransactionHistoryQuerySchema,
} from "../../validations/transaction.schema";
import {
  canSimulateInflow,
  canViewTransactionDetails,
  canViewTransactions,
} from "../wallet/walletServicePermissions";

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

// ==========================================
// Wallet service transaction routes
// Fixed paths must stay above "/:reference" or Express treats them as a reference
// ==========================================

router.get(
  "/wallet-activity",
  authenticateJWT,
  canViewTransactions,
  validateRequest("query", walletActivityQuerySchema),
  asyncHandler(getWalletActivityHandler),
);

router.post(
  "/simulate-inflow",
  authenticateJWT,
  canSimulateInflow,
  validateRequest("body", simulateInflowBodySchema),
  asyncHandler(simulateWalletInflowHandler),
);

router.get(
  "/history/:walletId",
  authenticateJWT,
  canViewTransactions,
  validateRequest("params", walletTransactionHistoryParamsSchema),
  validateRequest("query", walletTransactionHistoryQuerySchema),
  asyncHandler(getWalletTransactionsHandler),
);

router.get(
  "/:reference",
  authenticateJWT,
  canViewTransactionDetails,
  validateRequest("params", transactionReferenceParamsSchema),
  asyncHandler(getTransactionByReferenceHandler),
);

export default router;
