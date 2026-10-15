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

interface StudentInvoiceWithPaymentStatus {
  invoice_number: string;
  description: string;
  end_date: Date;
  start_date: Date;
  payment_item_id: bigint;
  status: string;
  invoice_amount: string; // Prisma returns Decimal as string via $queryRaw
  total_receipt_amount: string;
  payment_status: "Unpaid" | "Part Payment" | "Full Payment";
}

export async function getPendingInvoicesWithPaymentStatusForStudent(
  studentId: bigint,
): Promise<StudentInvoiceWithPaymentStatus[]> {
  return await prisma.$queryRaw<StudentInvoiceWithPaymentStatus[]>`
    SELECT
      i.invoice_number,
      pi.description,
        i.businessId,
      pi.end_date,
      pi.start_date,
      i.payment_item_id,
      i.status,
      i.amount AS invoice_amount,
      COALESCE(SUM(r.amount), 0) AS total_receipt_amount,
      CASE
          WHEN COUNT(r.id) = 0 THEN 'Unpaid'
          WHEN COALESCE(SUM(r.amount), 0) < i.amount THEN 'Part Payment'
          WHEN COALESCE(SUM(r.amount), 0) >= i.amount THEN 'Full Payment'
      END AS payment_status
    FROM invoices i
    LEFT JOIN payment_items pi ON pi.id = i.payment_item_id
    LEFT JOIN receipts r ON r.invoice_id = i.id
    WHERE i.student_id = ${studentId} AND i.status = 'pending'
    GROUP BY
      i.id,
      i.invoice_number,
      i.payment_item_id,
      pi.description,
      pi.end_date,
      i.businessId,
      pi.start_date,
      i.status,
      i.amount;
  `;
}
