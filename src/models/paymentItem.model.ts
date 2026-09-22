import { PaymentItemStatus } from "@prisma/client";
import prisma from "../config/database";
import { getCurrentTimestamp } from "../helpers/date.helper";


export class PaymentItemModel {
  static async updatePaymentItem(
    businessId: bigint,
    paymentItemId: bigint,
    updatedByName: string,
    updates: { name?: string; description?: string },
  ) {
    const existingPaymentItem = await prisma.paymentItems.findFirst({
      where: {
        id: paymentItemId,
        businessId,
      },
    });

    if (!existingPaymentItem) {
      return null;
    }

    return await prisma.paymentItems.update({
      where: {
        id: paymentItemId,
      },
      data: {
        ...updates,
        updatedBy: updatedByName,
      },
    });
  }

  static async isPaymentItemApproved(paymentItemId: bigint): Promise<boolean> {
    const paymentItem = await prisma.paymentItems.findUnique({
      where: {
        id: paymentItemId,
      },
      select: {
        status: true,
      },
    });

    if (!paymentItem) {
      return false;
    }

    return paymentItem.status === "approved";
  }

  static async getPaymentItemName(
    paymentItemId: bigint,
  ): Promise<string | null> {
    const paymentItem = await prisma.paymentItems.findUnique({
      where: {
        id: paymentItemId,
      },
      select: {
        name: true,
      },
    });

    if (!paymentItem) {
      return null;
    }

    return paymentItem.name;
  }

  static async deletePaymentItem(
    businessId: bigint,
    paymentItemId: bigint,
  ): Promise<void> {
    const existingPaymentItem = await prisma.paymentItems.findFirst({
      where: {
        id: paymentItemId,
        businessId,
      },
    });

    if (!existingPaymentItem) {
      return;
    }

    await prisma.paymentItems.update({
      where: {
        id: paymentItemId,
      },
      data: {
        deletedAt: getCurrentTimestamp(),
      },
    });
  }

  static async updatePaymentItemBankDetails(
    businessId: bigint,
    action: string,
    paymentItemId: bigint,
    accountName: string,
    accountNumber: string,
    bank: string,
  ): Promise<void> {
    const existingPaymentItem = await prisma.paymentItems.findFirst({
      where: {
        id: paymentItemId,
        businessId,
      },
    });

    if (!existingPaymentItem) {
      return;
    }

    await prisma.paymentItems.update({
      where: {
        id: paymentItemId,
      },
      data: {
        status: action as PaymentItemStatus,
        accountName,
        accountNumber,
        bank,
      },
    });
  }
}
