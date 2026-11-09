import { Request, Response } from "express";

import { CreateStudentWalletInterface } from "../interfaces/walletcreationforstudent.interface";
import { AuditModel } from "../models/audit.model";
import { isStudentWalletCreated } from "../models/isStudentWalletCreatedBoolean.model";
import {
  createStudentWallet,
  getSpecificStudentWallet,
  getWalletDetailsAfterLogin,
} from "../thirdPartyService/wallet.services";
import { extractRequestMetadata } from "../utils/request.metadata";
import { successResponse, errorResponse } from "../utils/response.util";
import {
  createWallet,
  getPaymentItemWallet,
  searchWallets,
} from "../thirdPartyService/wallet.services";
import { sendPaymentServiceResult } from "../utils/paymentServiceResponse.util";
import { PaymentItemWalletParams, WalletSearchQuery } from "../validations/wallet.schema";

/**
 * @swagger
 * /api/v1/admin/wallet:
 *   get:
 *     summary: Get wallet details on login
 *     description: Returns wallet details for the logged in user's business. Business ID is derived automatically from the user's JWT token.
 *     tags:
 *       - Wallet
 *     responses:
 *       200:
 *         description: Wallet details returned successfully
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
 *                   example: Wallet details returned successfully
 *                 data:
 *                   type: object
 *       404:
 *         description: Business ID not found for this user
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
 *                   example: Business Id not obtained from userId
 *       500:
 *         description: Could not return wallet details
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
 *                   example: Could not return wallet details
 *     security:
 *       - bearerAuth: []
 */
export const getWalletDetailsonLoginHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userBusinessId = req.businessId;
  const { ip } = extractRequestMetadata(req);
  const userId = req.userId;

  if (!userBusinessId) {
    return errorResponse(res, "Business Id not obtained from userId", 500);
  }

  try {
    await AuditModel.logGottenAllWalletDetails(userId! as string, ip);
    const response = await getWalletDetailsAfterLogin(Number(userBusinessId));
    return successResponse(
      res,
      "Wallet details returned successfully",
      response,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Could not return wallet details", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/wallet/student-wallets:
 *   post:
 *     summary: Create a wallet for a student
 *     description: |
 *       Creates a wallet for a single student via the external wallet provider.
 *       The businessId is derived automatically from the authenticated user's JWT token
 *       and does not need to be included in the request body.
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - student
 *             properties:
 *               student:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - emailAddress
 *                   - mobileNumber
 *                   - address
 *                   - city
 *                   - studentId
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: Ngozi
 *                   lastName:
 *                     type: string
 *                     example: Adetunji
 *                   middleName:
 *                     type: string
 *                     example: L
 *                   emailAddress:
 *                     type: string
 *                     format: email
 *                     example: ngozi.adetunji@example.com
 *                   mobileNumber:
 *                     type: string
 *                     example: "+2348021110001"
 *                   address:
 *                     type: string
 *                     example: Ikeja, Lagos
 *                   city:
 *                     type: string
 *                     example: Lagos
 *                   alias:
 *                     type: string
 *                     example: ngozi.a
 *                   studentId:
 *                     type: integer
 *                     example: 1
 *     responses:
 *       200:
 *         description: Student wallet created successfully
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
 *                   example: Student wallet created successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid request body
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
 *                   example: Validation failed
 *       401:
 *         description: Unauthorized - Invalid or missing access token
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
 *         description: Could not create student wallet
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
 *                   example: Could not create student wallet
 */
export const createStudentWalletHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { ip } = extractRequestMetadata(req);
  const userId = req.userId!;
  const userBusinessId = req.businessId;

  let businessId = userBusinessId;

  let studentWalletCreationInfo: CreateStudentWalletInterface = {
    ...req.body,
    businessId,
  };

  try {
    const createdWalletForStudent = await createStudentWallet(
      studentWalletCreationInfo,
    );

    await AuditModel.logNewStudentWalletCreation(userId as string, ip);
    await isStudentWalletCreated.changeStudentWalletCreationBooleanToTrue(
      BigInt(studentWalletCreationInfo.student.studentId),
    );

    return successResponse(
      res,
      "Student wallet created successfully",
      createdWalletForStudent,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Could not create student wallet", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/wallet/{walletid}:
 *   get:
 *     summary: Get a specific student's wallet
 *     description: |
 *       Returns wallet details for a single student, scoped to the authenticated user's business.
 *       The businessId is derived automatically from the authenticated user's JWT token.
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletid
 *         required: true
 *         schema:
 *           type: integer
 *         description: The student's ID to fetch wallet information for
 *         example: 1
 *     responses:
 *       200:
 *         description: Student wallet info fetched successfully
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
 *                   example: Student wallet info fetched successfully
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - Invalid or missing access token
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
 *         description: Failed to fetch student wallet info
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
 *                   example: Failed to fetch student wallet info.
 */
export const getSpecificStudentWalletAccordingToBusinessIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const businessId = req.businessId!;

  const { walletid } = req.params;

  let studentId = walletid;

  try {
    const fetchedStudentWallet = await getSpecificStudentWallet(
      BigInt(studentId as string),
      BigInt(businessId),
    );

    return successResponse(
      res,
      "Student wallet info fetched successfully",
      fetchedStudentWallet,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to fetch student wallet info.", 500);
  }
};
// ==========================================
// Wallet service handlers
// ==========================================

/**
 * @swagger
 * /api/v1/admin/wallet/create:
 *   post:
 *     summary: Create the business wallet
 *     description: Creates a wallet for the logged in user's business, or returns the existing one. Business ID comes from the JWT, so no body is needed.
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet created or existing wallet returned
 *       403:
 *         description: Missing admin.menu.wallets permission
 *       502:
 *         description: Wallet service request failed
 */
export const createBusinessWalletHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await createWallet(String(req.userId), Number(req.businessId));

  return sendPaymentServiceResult(
    res,
    result,
    "Wallet created successfully",
    "Could not create wallet",
  );
};

/**
 * @swagger
 * /api/v1/admin/wallet/search:
 *   get:
 *     summary: Search wallets
 *     description: Searches wallet name, account number or wallet ID (exact UUID). Returns at most 20 results.
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           example: "9710005607"
 *     responses:
 *       200:
 *         description: Matching wallets returned
 *       400:
 *         description: Invalid query parameter
 *       403:
 *         description: Missing admin.menu.wallets permission
 *       502:
 *         description: Wallet service request failed
 */
export const searchWalletsHandler = async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query as unknown as WalletSearchQuery;
  const result = await searchWallets(q);

  return sendPaymentServiceResult(
    res,
    result,
    "Wallets retrieved successfully",
    "Could not search wallets",
  );
};

/**
 * @swagger
 * /api/v1/admin/wallet/payment-wallet/{paymentItemId}:
 *   get:
 *     summary: Get a payment item wallet
 *     description: Returns the wallet for a payment item in the logged in user's business. Business ID comes from the JWT.
 *     tags:
 *       - Wallet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentItemId
 *         required: true
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: Payment item wallet retrieved successfully
 *       400:
 *         description: Invalid paymentItemId
 *       403:
 *         description: Missing admin.menu.wallets permission
 *       502:
 *         description: Wallet service request failed (including wallet not found)
 */
export const getPaymentItemWalletHandler = async (req: Request, res: Response): Promise<void> => {
  const { paymentItemId } = req.params as unknown as PaymentItemWalletParams;
  const result = await getPaymentItemWallet(req.businessId!, paymentItemId);

  return sendPaymentServiceResult(
    res,
    result,
    "Payment item wallet retrieved successfully",
    "Could not retrieve payment item wallet",
  );
};
