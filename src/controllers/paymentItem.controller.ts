import { Request, Response } from "express";
import { PaymentItemStatus } from "@prisma/client";
import { successResponse, errorResponse } from "../utils/response.util";
import { extractRequestMetadata } from "../utils/request.metadata";
import { AuditModel } from "../models/audit.model";
import { generateNextInvoiceNumber } from "../helpers/invoiceNumber.helper";
import { UserModel } from "../models/user.model";
import {
  createNewPaymentItemEntry,
  getAllPaymentItemsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist,
} from "../services/admin.paymentitem.service";
import { CreatePaymentItemPayload } from "../interfaces/paymentItem.interface";
import { NotificationModel } from "../models/notifications.model";
import { Emails } from "../utils/emailTemplate";
import { parseDateRange } from "../helpers/date.helper";
import { PaymentItemModel } from "../models/paymentItem.model";
import { PaymentItemData } from "../interfaces/paymentitemwalletcreationdatainterface";
import { createPaymentItemWallet } from "../thirdPartyService/wallet.services";
import { InvoiceModel } from "../models/invoices.model";

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   get:
 *     summary: Get all payment items for a business
 *     description: |
 *       Returns paginated payment item records belonging to the authenticated
 *       user's business. Supports optional search, status, and date-range
 *       filters (startDate/endDate).
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *           example: Tuition Fee
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum:
 *             - approved
 *             - inactive
 *             - rejected
 *             - cancelled
 *             - pending
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-01"
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-12-31"
 *     responses:
 *       200:
 *         description: Payment items fetched successfully
 *       400:
 *         description: Invalid request parameters (bad pagination or date range)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to fetch payment item(s)
 */
export const getAllPaymentItemsGeneratedAccordingToBusinessIdAndClassIdHandler =
  async (req: Request, res: Response): Promise<any> => {
    const businessId = req.businessId;

    const {
      page = 1,
      limit = 50,
      search,
      status,
      startDate,
      endDate,
    } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);

    if (isNaN(pageNumber) || pageNumber < 1) {
      return errorResponse(res, "Page must be greater than 0", 400);
    }

    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      return errorResponse(res, "Limit must be between 1 and 100", 400);
    }

    const {
      parsedStartDate,
      parsedEndDate,
      error: dateRangeError,
    } = parseDateRange(
      startDate as string | undefined,
      endDate as string | undefined,
    );

    if (dateRangeError) {
      return errorResponse(res, dateRangeError, 400);
    }

    try {
      const listOfAllPaymentItems =
        await getAllPaymentItemsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist(
          pageNumber,
          limitNumber,
          businessId as bigint,
          search as string | undefined,
          status as string | undefined,
          parsedStartDate,
          parsedEndDate,
        );
      return successResponse(
        res,
        "Payment items have been fetched successfully",
        listOfAllPaymentItems,
      );
    } catch (error) {
      console.log(error);
      return errorResponse(res, "Failed to fetch payment item(s).", 500);
    }
  };

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   post:
 *     summary: Create a new payment item
 *     description: |
 *       Creates a payment item for the authenticated user's business. The
 *       businessId is extracted from the JWT token. A unique invoice number
 *       is generated, the item is created with status "pending", and everyone
 *       with payment-approval privilege for the business is notified by email.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - amount
 *               - startDate
 *               - endDate
 *               - classId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Tuition Fee
 *               description:
 *                 type: string
 *                 example: First term tuition fee
 *               amount:
 *                 type: number
 *                 example: 150000
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-10"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               classId:
 *                 type: integer
 *                 example: 9
 *     responses:
 *       200:
 *         description: Payment item created successfully
 *       404:
 *         description: Payment item creator not found
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to create new payment item
 */
export const createNewPaymentItemsAccordingToBusinessIdAndClassIdHandler =
  async (req: Request, res: Response): Promise<any> => {
    const beforeInvoiceNumberPaymentItemInfo: CreatePaymentItemPayload =
      req.body;
    const userId = req.userId!;
    const { ip } = extractRequestMetadata(req);
    const businessId = req.businessId;

    try {
      const getInvoiceNumber = await generateNextInvoiceNumber();

      const paymentItemCreator = await UserModel.getNameFromUserId(
        userId as string,
      );

      if (!paymentItemCreator) {
        return errorResponse(res, "Payment item creator not found", 404);
      }

      const afterInvoicenumberPaymentItemInfo = {
        ...beforeInvoiceNumberPaymentItemInfo,
        invoiceNumber: getInvoiceNumber,
        status: "pending" as PaymentItemStatus,
        userId,
        createdBy: paymentItemCreator,
      };
      const createdPaymentItem = await createNewPaymentItemEntry(
        afterInvoicenumberPaymentItemInfo,
        businessId as bigint,
      );

      const listOfEveryoneWhoCanApprovePaymentItem =
        await NotificationModel.getAllPersonnelWhoCanApprovePaymentItemsByBusinessId(
          businessId as bigint,
        );
      const email = Emails.getEmail("PAYMENT_ITEMS_NEED_APPROVAL");

      await NotificationModel.notifyUsersWithPaymentApprovalPrivilege(
        email?.content as string,
        email?.subject as string,
        listOfEveryoneWhoCanApprovePaymentItem,
      );

      await AuditModel.logPaymentItemCreation(
        userId as string,
        ip,
        businessId as bigint,
      );

      return successResponse(
        res,
        "payment item info has been created on platform",
        createdPaymentItem,
      );
    } catch (error) {
      console.log(error);
      return errorResponse(res, "Failed to create new payment item", 500);
    }
  };

/**
 * @swagger
 * /api/v1/admin/payment-items:
 *   patch:
 *     summary: Update an existing payment item
 *     description: |
 *       Updates a payment item's name and/or description for the
 *       authenticated user's business. Payment items that have already
 *       been approved cannot be edited.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentItemId
 *             properties:
 *               paymentItemId:
 *                 type: integer
 *                 example: 10
 *               title:
 *                 type: string
 *                 example: Second Term Tuition Fee
 *               description:
 *                 type: string
 *                 example: Updated description
 *     responses:
 *       200:
 *         description: Payment item updated successfully
 *       400:
 *         description: Payment item has already been approved and cannot be edited
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to update payment item
 */
export const updatePaymentItemsAccordingToBusinessIdAndClassIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = req.userId;
  const businessId = req.businessId;

  const { description, title, paymentItemId } = req.body;

  try {
    const nameOfPaymentItemUpdateInitiator = await UserModel.getNameFromUserId(
      userId as string,
    );
    const isPaymentItemApproved =
      await PaymentItemModel.isPaymentItemApproved(paymentItemId);

    if (isPaymentItemApproved) {
      return errorResponse(
        res,
        "Payment item has already been approved and cannot be edited.",
      );
    }

    const paymentItemUpdateInfo = { name: title, description: description };

    const updatePaymentItem = await PaymentItemModel.updatePaymentItem(
      businessId as bigint,
      paymentItemId,
      nameOfPaymentItemUpdateInitiator as string,
      paymentItemUpdateInfo,
    );

    return successResponse(
      res,
      "Payment item updated successfully",
      updatePaymentItem,
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to update payment item", 500);
  }
};

/**
 * @swagger
 * /api/v1/admin/payment-items/approve:
 *   patch:
 *     summary: Approve a payment item
 *     description: |
 *       Approves a payment item by requesting a virtual wallet/account for
 *       it from the third-party wallet service, then stores the returned
 *       bank, account number, and account name on the payment item. If
 *       wallet creation fails, the payment item is deleted and an error is
 *       returned.
 *     tags:
 *       - Payment Items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentItemId
 *               - action
 *             properties:
 *               paymentItemId:
 *                 type: integer
 *                 example: 10
 *               action:
 *                 type: string
 *                 example: approve
 *     responses:
 *       200:
 *         description: Payment item approved successfully
 *       400:
 *         description: Payment item could not be approved (wallet creation failed)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       500:
 *         description: Failed to approve payment item
 */
export const approvePaymentItemsAccordingToBusinessIdAndClassIdHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const { action, paymentItemId } = req.body;
  const userId = req.userId!;
  const { ip } = extractRequestMetadata(req);
  const businessId = req.businessId;

  try {
    const paymentItemName =
      await PaymentItemModel.getPaymentItemName(paymentItemId);

    const walletCreationInfo: PaymentItemData = {
      businessId: businessId as bigint,
      paymentItemId: paymentItemId,
      paymentItemName: paymentItemName as string,
    };


//action check with switch case . if reject , update status on payment item table to reject and alert user that his wallet creation request was rejected
    const response =
      await createPaymentItemWallet(walletCreationInfo);



    if (!response) {
      await PaymentItemModel.deletePaymentItem(
        paymentItemId,
        businessId as bigint,
      );
      return errorResponse(res, "Payment item could not be approved");
    }

    await PaymentItemModel.updatePaymentItemBankDetails(
      businessId as bigint,
      action,
      paymentItemId,
      response.data.accountName,
      response.data.accountNo,
      response.data.bank,
    );

    const paymentItemInfo =
      await InvoiceModel.createInvoiceUsingPaymentItemIdInfo(paymentItemId);
    console.log(paymentItemInfo);
    await AuditModel.logPaymentItemApproval(
      userId as string,
      ip,
      businessId as bigint,
    );

    return successResponse(res, "Payment item has been approved successfully");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Failed to approve new payment item", 500);
  }
};
