import dotenv from "dotenv";

import { CreatePaymentItemWalletResponse } from "../interfaces/paymentItem.interface";
import { PaymentItemData } from "../interfaces/paymentitemwalletcreationdatainterface";
import { TransactionData } from "../interfaces/transactions.interfaces";
import {
  GeneratePaymentLinkRequestBody,
  GetAllPaymentLinksParamsBody,
} from "../interfaces/wallet.interfaces";
import { BaseProvider} from "../providers/base.provider";
import { PaymentServiceEndpoints } from "../providers/paymentservice.endpoints";
dotenv.config();

const api_key = process.env.API_KEY;
const payment_service_base_url = process.env.PAYMENT_SERVICE_BASE_URL;
const get_wallet_transaction_history_url = process.env.GET_ALL_TRANSACTIONS;
const get_specific_wallet_transaction_history_url =
  process.env.GET_A_SPECIFIC_TRANSACTION;

class WalletProvider extends BaseProvider {
  constructor() {
    super("wallet", payment_service_base_url!, api_key!);
  }

  protected getAuthHeader(): string {
    return this.apiKey;
  }

  protected getAccessToken(): string {
    return this.apiKey;
  }



  createWallet(userId: string, businessId: number) {
    return this.makeRequest(PaymentServiceEndpoints.CREATE_WALLET, { userId, businessId });
  }

  createStudentWallet(studentWalletCreationInfo: object) {
    return this.makeRequest(PaymentServiceEndpoints.CREATE_STUDENT_WALLET, studentWalletCreationInfo);
  }

  getSpecificStudentWallet(studentId: bigint, businessId: bigint) {
    return this.makeRequest(
      `${PaymentServiceEndpoints.CREATE_STUDENT_WALLET}/${businessId}/${studentId}`,
      undefined,
      "GET",
    );
  }

  getWalletDetailsAfterLogin(businessId: number) {
    return this.makeRequest(
      `${PaymentServiceEndpoints.GET_WALLET_DETAILS}/${businessId}`,
      undefined,
      "GET",
    );
  }

  generatePaymentLink(paymentLinkData: GeneratePaymentLinkRequestBody) {
    return this.makeRequest(PaymentServiceEndpoints.GENERATE_PAYMENT_LINK, paymentLinkData);
  }

  getAllPaymentLinksOfOneBusinessByBusinessId(
    allPaymentLinksData: GetAllPaymentLinksParamsBody,
  ) {
    return this.makeRequest(
      `${PaymentServiceEndpoints.GENERATE_PAYMENT_LINK}?businessId=${allPaymentLinksData.businessId}&page=${allPaymentLinksData.page}&limit=${allPaymentLinksData.limit}&startDate=${allPaymentLinksData.startDate}&endDate=${allPaymentLinksData.endDate}`,
      undefined,
      "GET",
    );
  }

  createPaymentItemWallet(
    paymentItemWalletCreationInfo: PaymentItemData,
  ): Promise<CreatePaymentItemWalletResponse> {
    return this.makeRequest(
      PaymentServiceEndpoints.CREATE_A_PAYMENT_ITEM_WALLET,
      paymentItemWalletCreationInfo,
    );
  }
}

const walletProvider = new WalletProvider();

export const createWallet = async (userId: string, businessId: number) => {
  return walletProvider.createWallet(userId, businessId);
};

export const createStudentWallet = async (
  studentWalletCreationInfo: object,
) => {
  return walletProvider.createStudentWallet(studentWalletCreationInfo);
};

export const getSpecificStudentWallet = async (
  studentId: bigint,
  businessId: bigint,
) => {
  return walletProvider.getSpecificStudentWallet(studentId, businessId);
};

export const getWalletDetailsAfterLogin = async (businessId: number) => {
  return walletProvider.getWalletDetailsAfterLogin(businessId);
};

export const generatePaymentLink = async (
  paymentLinkData: GeneratePaymentLinkRequestBody,
) => {
  return walletProvider.generatePaymentLink(paymentLinkData);
};

export const getAllPaymentLinksOfOneBusinessByBusinessId = async (
  allPaymentLinksData: GetAllPaymentLinksParamsBody,
) => {
  return walletProvider.getAllPaymentLinksOfOneBusinessByBusinessId(
    allPaymentLinksData,
  );
};

export const createPaymentItemWallet = async (
  paymentItemWalletCreationInfo: PaymentItemData,
): Promise<CreatePaymentItemWalletResponse> => {
  console.log(
    "Payment Item Wallet Creation Info:",
    paymentItemWalletCreationInfo,
  );
  return walletProvider.createPaymentItemWallet(paymentItemWalletCreationInfo);
};

export const getWalletTransactionHistoryForOneBusiness = async (
  walletTransactionHistoryInfo: TransactionData,
) => {
  const response = await fetch(
    `${get_wallet_transaction_history_url}/${walletTransactionHistoryInfo.walletId}/transactions?pageInteger=${walletTransactionHistoryInfo.pageInteger}&limitInteger=${walletTransactionHistoryInfo.limitInteger}&type=${walletTransactionHistoryInfo.type}&status=${walletTransactionHistoryInfo.status}&fromDate=${walletTransactionHistoryInfo.fromDate}&toDate=${walletTransactionHistoryInfo.toDate}`,
    {
      method: "GET",
      headers: {
        "x-api-key": api_key!,
      },
    },
  );

  return response.json();
};

export const getSpecificWalletTransactionHistoryByReferenceNumber = async (
  referenceNumber: number,
) => {
  const response = await fetch(
    `${get_specific_wallet_transaction_history_url}/${referenceNumber}`,
    {
      method: "GET",
      headers: {
        "x-api-key": api_key!,
      },
    },
  );

  return response.json();
};
