import { Request, Response } from "express";

import { exportLedgerEntries, getLedgerEntries } from "../thirdPartyService/ledger.services";
import { sendPaymentServiceResult } from "../utils/paymentServiceResponse.util";
import { LedgerExportQuery, LedgerQuery } from "../validations/ledger.schema";

/**
 * @swagger
 * /api/v1/admin/ledger:
 *   get:
 *     summary: Get paginated ledger entries
 *     description: Returns ledger entries for a wallet from the wallet service.
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-04-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-04-30"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Ledger entries retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Missing admin.transaction_details.view permission
 *       502:
 *         description: Wallet service request failed
 */
export const getLedgerEntriesHandler = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as LedgerQuery;
  const result = await getLedgerEntries(query);

  return sendPaymentServiceResult(
    res,
    result,
    "Ledger entries retrieved successfully",
    "Could not retrieve ledger entries",
  );
};

/**
 * @swagger
 * /api/v1/admin/ledger/export:
 *   get:
 *     summary: Export ledger entries
 *     description: Returns every matching ledger entry for a wallet, without pagination.
 *     tags:
 *       - Ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-04-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-04-30"
 *     responses:
 *       200:
 *         description: Ledger entries exported successfully
 *       400:
 *         description: Invalid query parameters
 *       403:
 *         description: Missing admin.transaction_details.export permission
 *       502:
 *         description: Wallet service request failed
 */
export const exportLedgerEntriesHandler = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as LedgerExportQuery;
  const result = await exportLedgerEntries(query);

  return sendPaymentServiceResult(
    res,
    result,
    "Ledger entries exported successfully",
    "Could not export ledger entries",
  );
};
