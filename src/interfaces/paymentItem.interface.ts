import { PaymentItemStatus, PaymentType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

export interface CreatePaymentItemPayload {
  classId: number;
  name: string;
  description: string;
  amount: Decimal;
  status?: PaymentItemStatus;
  startDate: string; // ISO 8601 date string
  endDate: string; // ISO 8601 date string
  paymentType: string[]; // e.g. ["wallet"]
  createdBy?: string;

}




export interface CreatePaymentItemPayloadWithNullableAccountInfo {
  id: bigint;
  classId: bigint;
  name: string;
  description: string;
  status: PaymentItemStatus;
  amount: Decimal;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  paymentType: PaymentType[];
  accountName: string | null;
  accountNumber: string | null;
  class: {
    name: string;
  };
  createdAt: Date;
}



export interface PaymentItemWalletData {
  walletId: string;
  paymentItemId: number;
  businessId: number;
  bank: string;
  accountNo: string;
  accountName: string;
  balance: number;
}

export interface CreatePaymentItemWalletResponse {
  success: boolean;
  message: string;
  data: PaymentItemWalletData;
}

