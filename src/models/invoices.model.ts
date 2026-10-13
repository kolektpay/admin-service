import prisma from "../config/database";

export class InvoiceModel {
  static async createInvoiceUsingPaymentItemIdInfo(paymentItemId: bigint) {
    const paymentItemInfo = await prisma.paymentItems.findUnique({
      where: {
        id: paymentItemId,
      },
    });

    return paymentItemInfo;
  }
}
