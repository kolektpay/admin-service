import { Request, Response } from "express";
import {
  createStudentWallet,
  generatePaymentLink,
  getAllPaymentLinksOfOneBusinessByBusinessId,
  getSpecificStudentWallet,
  getWalletDetailsAfterLogin,
} from "../../thirdPartyService/wallet.services";
import { successResponse, errorResponse } from "../../utils/response.util";
import {
  GeneratePaymentLinkRequestBody,
  GetAllPaymentLinksParamsBody,
} from "../../interfaces/wallet.interfaces";
import { subtractDays } from "../../helpers/date.helper";
import { AuditModel } from "../../models/audit.model";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { CreateStudentWalletInterface } from "../../interfaces/walletcreationforstudent.interface";
import { isStudentWalletCreated } from "../../models/isStudentWalletCreatedBoolean.model";

/**
 * @swagger
 * /api/v1/wallet:
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
 * /api/v1/admin/wallet/payment-links:
 *   post:
 *     summary: Generate payment link
 *     description: Generates a payment link for the logged in user's business. Business ID is derived automatically from the user's JWT token.
 *     tags:
 *       - Wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The amount to generate the payment link for
 *                 example: 5000
 *               description:
 *                 type: string
 *                 description: Description of the payment
 *                 example: School fees payment
 *               customerEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the customer
 *                 example: customer@gmail.com
 *               customerName:
 *                 type: string
 *                 description: Name of the customer
 *                 example: John Doe
 *     responses:
 *       200:
 *         description: Payment link generated successfully
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
 *         description: Could not generate payment link
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
export const generatePaymentLinkHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userBusinessId = req.businessId;
  const userId = req.userId;
  const { ip } = extractRequestMetadata(req);
  const {
    amount,
    currency,
    description,
    expiresInMinutes,
    customerEmail,
    customerName,
    customerPhone,
  } = req.body;

  let paymentLinkData: GeneratePaymentLinkRequestBody = req.body;

  try {
    if (!userBusinessId) {
      return errorResponse(res, "Business Id not obtained from userId", 500);
    }

    let paymentLinkDataBody = {
      ...paymentLinkData,
      businessId: Number(userBusinessId),
      amount: amount,
      currency: currency,
      description: description,
      expiresInMinutes: expiresInMinutes,
      customerEmail: customerEmail,
      customerName: customerName,
      customerPhone: customerPhone,
    };

    const response = await generatePaymentLink(paymentLinkDataBody);
    await AuditModel.logPaymentLinkGenerated(userId! as string, ip);

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
 * /api/v1/admin/wallet/payment-links:
 *   get:
 *     summary: Get all payment links for one business
 *     description: Returns all payment links for the logged in user's business. Defaults to the last 7 days if no date range is provided. Business ID is derived automatically from the user's JWT token.
 *     tags:
 *       - Wallet
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of records per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-01-01T00:00:00.000Z"
 *         description: Filter records created on or after this date. Defaults to 7 days ago if not provided.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: "2024-01-31T00:00:00.000Z"
 *         description: Filter records created on or before this date. Defaults to today if not provided.
 *     responses:
 *       200:
 *         description: All payment links retrieved successfully
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
 *                   example: All payment links retrieved successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Cannot retrieve payment links without business id
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
 *                   example: Cannot retrieve payment links without business id.
 *       500:
 *         description: Could not return payment links
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
export const getAllPaymentLinksForOneBusinessHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { ip } = extractRequestMetadata(req);
  const userId = req.userId;
  let getAllPaymentLinksData: GetAllPaymentLinksParamsBody;
  const userBusinessId = Number(req.businessId);
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);

  const todaysDate = new Date();
  const weekVariable = 7;
  let startAndEndDate;

  if (!req.query.startDate && !req.query.endDate) {
    startAndEndDate = subtractDays(todaysDate, weekVariable);

    getAllPaymentLinksData = {
      businessId: userBusinessId,
      page: page,
      limit: limit,
      startDate: startAndEndDate?.aWeekAgo,
      endDate: startAndEndDate?.todaysDate,
    };
  } else {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    getAllPaymentLinksData = {
      businessId: userBusinessId,
      page: page,
      limit: limit,
      startDate: startDate,
      endDate: endDate,
    };
  }

  try {
    if (!getAllPaymentLinksData.businessId) {
      return errorResponse(
        res,
        "Cannot retrieve payment links without business id.",
        400,
      );
    }

    const response = await getAllPaymentLinksOfOneBusinessByBusinessId(
      getAllPaymentLinksData,
    );
    await AuditModel.logAllGeneratedPaymentLinksGotten(userId! as string, ip);
    return successResponse(
      res,
      "All payment links retrieved successfully",
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