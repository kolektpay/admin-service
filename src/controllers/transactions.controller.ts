import { Request, Response } from "express";
import { successResponse, errorResponse } from "../../utils/response.util";
import { TransactionData } from "../../interfaces/transactions.interfaces";
import {
  getSpecificWalletTransactionHistoryByReferenceNumber,
  getWalletTransactionHistoryForOneBusiness,
} from "../../thirdPartyService/transactions.services";
import { subtractDays } from "../../helpers/date.helper";
import { isValidDate } from "../../helpers/date.helper";

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
 *           type: integer
 *         description: The wallet ID
 *         example: 12345
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
 *         description: Transaction status filter
 *         example: successful
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
        walletId: Number(walletid),
        pageInteger: Number(pageInteger),
        limitInteger: Number(limitInteger),
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
        walletId: Number(walletid),
        pageInteger: Number(pageInteger),
        limitInteger: Number(limitInteger),
        type: type as string,
        status: status as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      };
    }
    const response =
      await getWalletTransactionHistoryForOneBusiness(transactionDataInfo);

    return successResponse(
      res,
      "wallet transaction history retrieved successfully",
      response,
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
 *           type: integer
 *         description: The transaction reference number
 *         example: 987654321
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
    const response =
      await getSpecificWalletTransactionHistoryByReferenceNumber(Number(referencenumber));

    return successResponse(
      res,
      "Wallet transaction with reference number fetched successfully",
      response,
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