import { Request, Response } from "express";

import { isValidDate, subtractDays } from "../helpers/date.helper";
import { TransactionData } from "../interfaces/transactions.interfaces";
import {
  getSpecificWalletTransactionHistoryByReferenceNumber,
  getWalletTransactionHistoryForOneBusiness,
} from "../thirdPartyService/wallet.services";
import { errorResponse } from "../utils/response.util";
import { config } from "../config/app";
import {
  getTransactionByReference,
  getWalletActivity,
  getWalletTransactions,
  simulateWalletInflow,
} from "../thirdPartyService/transactions.services";
import { sendPaymentServiceResult } from "../utils/paymentServiceResponse.util";
import {
  SimulateInflowBody,
  WalletActivityQuery,
  WalletTransactionHistoryQuery,
} from "../validations/transaction.schema";

/**
 * @swagger
 * /api/v1/admin/transactions/wallets/{walletid}:
 *   get:
 *     summary: Get wallet transaction history
 *     description: Retrieves paginated transaction history for a specific wallet. Defaults to the last 7 days if no date range is provided.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The wallet ID (UUID)
 *         example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
 *       - in: query
 *         name: pageInteger
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limitInteger
 *         schema:
 *           type: integer
 *         description: Number of records per page
 *         example: 10
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Transaction type filter
 *         example: credit
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Transaction status filter (pending, paid, completed, cancelled)
 *         example: completed
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering transactions (defaults to 7 days ago)
 *         example: "2026-04-01"
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering transactions (defaults to today)
 *         example: "2026-04-07"
 *     responses:
 *       200:
 *         description: Wallet transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: wallet transaction history retrieved successfully
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Failed to retrieve wallet transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to retrieve wallet transaction history
 */
export const getWalletTransactionHistoryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { walletid } = req.params;
  const { pageInteger, limitInteger, type, status, fromDate, toDate } =
    req.query;
  try {
    const todaysDate = new Date();
    const weekVariable = 7;
    let startAndEndDate;
    let transactionDataInfo: TransactionData;
    if (!fromDate && !toDate) {
      startAndEndDate = subtractDays(todaysDate, weekVariable);

      transactionDataInfo = {
        walletId: walletid as string,
        pageInteger: Number(pageInteger) || 1,
        limitInteger: Number(limitInteger) || 10,
        type: type as string,
        status: status as string,
        fromDate: startAndEndDate.aWeekAgo as string,
        toDate: startAndEndDate.todaysDate as string,
      };
    } else {
      const isValidFromDate = isValidDate(fromDate as string);
      const isValidToDate = isValidDate(toDate as string);

      if (!isValidFromDate || !isValidToDate) {
        return errorResponse(res, "Invalid date provided");
      }

      transactionDataInfo = {
        walletId: walletid as string,
        pageInteger: Number(pageInteger) || 1,
        limitInteger: Number(limitInteger) || 10,
        type: type as string,
        status: status as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      };
    }
    const response =
      await getWalletTransactionHistoryForOneBusiness(transactionDataInfo);

    return sendPaymentServiceResult(
      res,
      response,
      "wallet transaction history retrieved successfully",
      "Failed to retrieve wallet transaction history",
    );
  } catch (error) {
    console.log(error);
    return errorResponse(
      res,
      "Failed to retrieve wallet transaction history",
      500,
    );
  }
};

/**
 * @swagger
 * /api/v1/admin/transactions/reference/{referencenumber}:
 *   get:
 *     summary: Get wallet transaction by reference number
 *     description: Retrieves a specific wallet transaction using its reference number.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referencenumber
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction reference
 *         example: TXN-987654321
 *     responses:
 *       200:
 *         description: Wallet transaction fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Wallet transaction with reference number fetched successfully
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Failed to retrieve specific wallet transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to retrieve specific wallet transaction
 */
export const getWalletTransactionByReferenceNumberHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { referencenumber } = req.params;

  try {
    const response = await getSpecificWalletTransactionHistoryByReferenceNumber(
      referencenumber as string,
    );

    return sendPaymentServiceResult(
      res,
      response,
      "Wallet transaction with reference number fetched successfully",
      "Failed to retrieve specific wallet transaction",
    );
  } catch (error) {
    console.log(error);
    return errorResponse(
      res,
      "Failed to retrieve specific wallet transaction",
      500,
    );
  }
};
// ==========================================
// Wallet service transaction handlers
// ==========================================

/**
 * @swagger
 * /api/v1/admin/transactions/history/{walletId}:
 *   get:
 *     summary: Get transaction history for a wallet
 *     description: Paginated transaction history for a wallet, with optional filters.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *       - in: query
 *         name: transaction_type
 *         schema:
 *           type: string
 *           enum: [credit, debit]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Missing admin.recent_transactions.view permission
 *       502:
 *         description: Wallet service request failed
 */
export const getWalletTransactionsHandler = async (req: Request, res: Response): Promise<void> => {
  const walletId = req.params.walletId as string;
  const query = req.query as unknown as WalletTransactionHistoryQuery;
  const result = await getWalletTransactions(walletId, query);

  return sendPaymentServiceResult(
    res,
    result,
    "Transactions retrieved successfully",
    "Could not retrieve transactions",
  );
};

/**
 * @swagger
 * /api/v1/admin/transactions/{reference}:
 *   get:
 *     summary: Get transaction by reference
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *           example: TXN_1234567890
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 *       403:
 *         description: Missing admin.transaction_details.view permission
 *       502:
 *         description: Wallet service request failed (including transaction not found)
 */
export const getTransactionByReferenceHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reference = req.params.reference as string;
  const result = await getTransactionByReference(reference);

  return sendPaymentServiceResult(
    res,
    result,
    "Transaction retrieved successfully",
    "Could not retrieve transaction",
  );
};

/**
 * @swagger
 * /api/v1/admin/transactions/wallet-activity:
 *   get:
 *     summary: Get wallet activity
 *     description: Wallet transaction history fetched from Embeddly through the wallet service.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: From
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: To
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: PageNumber
 *         schema:
 *           type: integer
 *       - in: query
 *         name: PageSize
 *         schema:
 *           type: integer
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Wallet activity retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Missing admin.recent_transactions.view permission
 *       502:
 *         description: Wallet service request failed
 */
export const getWalletActivityHandler = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as WalletActivityQuery;
  const result = await getWalletActivity(query);

  return sendPaymentServiceResult(
    res,
    result,
    "Wallet activity retrieved successfully",
    "Could not retrieve wallet activity",
  );
};

/**
 * @swagger
 * /api/v1/admin/transactions/simulate-inflow:
 *   post:
 *     summary: Simulate wallet inflow (development/sandbox only)
 *     description: Simulates funds landing in a beneficiary wallet. Disabled when NODE_ENV is production.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [beneficiaryAccountName, beneficiaryAccountNumber, amount, narration]
 *             properties:
 *               beneficiaryAccountName:
 *                 type: string
 *                 example: Dataseed's Wallet
 *               beneficiaryAccountNumber:
 *                 type: string
 *                 example: "9710005607"
 *               amount:
 *                 type: string
 *                 example: "10000000"
 *               narration:
 *                 type: string
 *                 example: December Party Sweep
 *     responses:
 *       200:
 *         description: Inflow simulated successfully
 *       400:
 *         description: Validation failed
 *       403:
 *         description: Not allowed in production, or missing admin.initiate_payment.create permission
 *       502:
 *         description: Wallet service request failed
 */
export const simulateWalletInflowHandler = async (req: Request, res: Response): Promise<void> => {
  if (config.nodeEnv === "production") {
    return errorResponse(res, "Simulating inflow is not allowed in production", 403);
  }

  const inflowData = req.body as SimulateInflowBody;
  const result = await simulateWalletInflow(inflowData);

  return sendPaymentServiceResult(
    res,
    result,
    "Inflow simulated successfully",
    "Could not simulate inflow",
  );
};
