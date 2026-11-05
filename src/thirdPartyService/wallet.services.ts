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
import { WalletTransactionHistoryQuery } from "../validations/transaction.schema";
import { buildQueryString } from "./paymentService.query";
import { getTransactionByReference, getWalletTransactions } from "./transactions.services";
dotenv.config();

const api_key = process.env.API_KEY;
const payment_service_base_url = process.env.PAYMENT_SERVICE_BASE_URL;

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

  // GET /wallet/payment-wallet/{businessId}/{paymentItemId}
  getPaymentItemWallet(
    businessId: string | number | bigint,
    paymentItemId: string | number | bigint,
  ) {
    return this.makeRequest(
      `${PaymentServiceEndpoints.CREATE_A_PAYMENT_ITEM_WALLET}/${encodeURIComponent(String(businessId))}/${encodeURIComponent(String(paymentItemId))}`,
      undefined,
      "GET",
    );
  }

  // GET /wallet/search?q - matches wallet_name, account_no or wallet_id (max 20 results)
  searchWallets(searchTerm: string) {
    return this.makeRequest(
      `${PaymentServiceEndpoints.GET_WALLET_DETAILS}/search${buildQueryString({ q: searchTerm })}`,
      undefined,
      "GET",
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

// Both calls go through TransactionsProvider, which uses PAYMENT_SERVICE_BASE_URL + API_KEY.
// Query names are mapped to what the payment service expects (page, limit, transaction_type, ...).
export const getWalletTransactionHistoryForOneBusiness = async (
  walletTransactionHistoryInfo: TransactionData,
) => {
  const { walletId, pageInteger, limitInteger, type, status, fromDate, toDate } =
    walletTransactionHistoryInfo;

  return getWalletTransactions(walletId, {
    page: pageInteger,
    limit: limitInteger,
    transaction_type: type as WalletTransactionHistoryQuery["transaction_type"],
    status: status as WalletTransactionHistoryQuery["status"],
    from_date: fromDate,
    to_date: toDate,
  });
};

export const getSpecificWalletTransactionHistoryByReferenceNumber = async (
  referenceNumber: string,
) => {
  return getTransactionByReference(referenceNumber);
};

export const getPaymentItemWallet = async (
  businessId: string | number | bigint,
  paymentItemId: string | number | bigint,
) => {
  return walletProvider.getPaymentItemWallet(businessId, paymentItemId);
};

export const searchWallets = async (searchTerm: string) => {
  return walletProvider.searchWallets(searchTerm);
};
