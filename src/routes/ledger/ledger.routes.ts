import { Router } from "express";

import {
  exportLedgerEntriesHandler,
  getLedgerEntriesHandler,
} from "../../controllers/ledger.controller";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ledgerExportQuerySchema, ledgerQuerySchema } from "../../validations/ledger.schema";
import { canExportLedger, canViewLedger } from "../wallet/walletServicePermissions";

const router = Router();

// ==========================================
// Ledger Routes (proxied to the wallet service)
// ==========================================

router.get(
  "/",
  authenticateJWT,
  canViewLedger,
  validateRequest("query", ledgerQuerySchema),
  asyncHandler(getLedgerEntriesHandler),
);

router.get(
  "/export",
  authenticateJWT,
  canExportLedger,
  validateRequest("query", ledgerExportQuerySchema),
  asyncHandler(exportLedgerEntriesHandler),
);

export default router;
