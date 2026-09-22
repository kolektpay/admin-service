import prisma from "../config/database";
import {
  CreatePaymentItemPayload,
  CreatePaymentItemPayloadWithNullableAccountInfo,
} from "../interfaces/paymentItem.interface";

import { PaymentItemStatus, PaymentType } from "@prisma/client";
import ApiError from "../utils/apiError";

/**
 * Get all users with pagination



/**
 * Get all payment items with pagination
 */
export const getAllPaymentItemsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist =
  async (
    page: number = 1,
    limit: number = 50,
    businessId: bigint,
    search?: string,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    paymentItems: CreatePaymentItemPayloadWithNullableAccountInfo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    try {
      const skip = (page - 1) * limit;

      /**
       * Base where clause
       * Only payment items belonging to this business
       */
      const whereClause: any = {
        deletedAt: null,
        businessId,
      };

      /**
       * Optional status filter
       * Example: active / inactive / pending
       */
      if (status) {
        whereClause.status = status as PaymentItemStatus;
      }

      /**
       * Optional search filter
       * Searches name OR description
       */
      if (search) {
        whereClause.OR = [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      /**
       * Optional date range filter
       * Matches payment items whose fee window overlaps the given range
       */
      if (startDate) {
        whereClause.endDate = { gte: startDate };
      }

      if (endDate) {
        whereClause.startDate = { lte: endDate };
      }

      /**
       * Run both queries together
       */
      const [paymentItems, total] = await Promise.all([
        prisma.paymentItems.findMany({
          skip,
          take: limit,
          where: whereClause,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            amount: true,
            startDate: true,
            endDate: true,
            createdBy: true,
            paymentType: true,
            accountName: true,
            accountNumber: true,
            classId: true,
            class: {
              select: {
                name: true,
              },
            },
            createdAt: true,
          },
        }),

        prisma.paymentItems.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        paymentItems,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      throw new ApiError(500, "Failed to fetch payment items");
    }
  };
/**


/**
 * Create a new student or students (by manager)
 */
/**
 * Create a new payment item (by manager)
 */
export const createNewPaymentItemEntry = async (
  paymentItemData: CreatePaymentItemPayload,
  businessId: bigint,
): Promise<CreatePaymentItemPayloadWithNullableAccountInfo> => {
  try {
    const createdPaymentItem = await prisma.paymentItems.create({
      data: {
        name: paymentItemData.name,
        description: paymentItemData.description,
        status: paymentItemData.status,
        amount: paymentItemData.amount,
        startDate: paymentItemData.startDate,
        endDate: paymentItemData.endDate,
        paymentType: paymentItemData.paymentType as PaymentType[],
        classId: paymentItemData.classId,
        businessId,
        createdBy: paymentItemData.createdBy as string, // Assuming userId is part of the payload
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        amount: true,
        startDate: true,
        endDate: true,
        createdBy: true,
        paymentType: true,
        accountName: true,
        accountNumber: true,
        classId: true,
        class: {
          select: {
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return createdPaymentItem;
  } catch (error) {
    throw new ApiError(500, "Failed to create payment item");
  }
};
