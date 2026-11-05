import dotenv from "dotenv";

import { BaseProvider } from "../providers/base.provider";
import {
  SimulateInflowBody,
  WalletActivityQuery,
  WalletTransactionHistoryQuery,
} from "../validations/transaction.schema";
import { buildQueryString } from "./paymentService.query";
dotenv.config();

// API key is sent as the x-api-key header by BaseProvider on every request
const api_key = process.env.API_KEY;
const payment_service_base_url = process.env.PAYMENT_SERVICE_BASE_URL;

const TRANSACTION_ENDPOINTS = {
  WALLETS: "/wallets",
  TRANSACTIONS: "/transactions",
  WALLET_ACTIVITY: "/transactions/wallet-activity",
  SIMULATE_INFLOW: "/transactions/simulate-inflow",
} as const;

class TransactionsProvider extends BaseProvider {
  constructor() {
    super("transactions", payment_service_base_url!, api_key!);
  }

  protected getAuthHeader(): string {
    return this.apiKey;
  }

  protected getAccessToken(): string {
    return this.apiKey;
  }

  // GET /wallets/{walletId}/transactions?page&limit&transaction_type&status&from_date&to_date
  getWalletTransactions(walletId: string, query: WalletTransactionHistoryQuery) {
    return this.makeRequest(
      `${TRANSACTION_ENDPOINTS.WALLETS}/${encodeURIComponent(walletId)}/transactions${buildQueryString(query)}`,
      undefined,
      "GET",
    );
  }

  // GET /transactions/{reference}
  getTransactionByReference(reference: string) {
    return this.makeRequest(
      `${TRANSACTION_ENDPOINTS.TRANSACTIONS}/${encodeURIComponent(reference)}`,
      undefined,
      "GET",
    );
  }

  // GET /transactions/wallet-activity?walletId&From&To&PageNumber&PageSize (Embeddly history)
  getWalletActivity(query: WalletActivityQuery) {
    return this.makeRequest(
      `${TRANSACTION_ENDPOINTS.WALLET_ACTIVITY}${buildQueryString(query)}`,
      undefined,
      "GET",
    );
  }

  // POST /transactions/simulate-inflow - development/sandbox only
  simulateWalletInflow(inflowData: SimulateInflowBody) {
    return this.makeRequest(TRANSACTION_ENDPOINTS.SIMULATE_INFLOW, inflowData);
  }
}

const transactionsProvider = new TransactionsProvider();

export const getWalletTransactions = async (
  walletId: string,
  query: WalletTransactionHistoryQuery,
) => {
  return transactionsProvider.getWalletTransactions(walletId, query);
};

export const getTransactionByReference = async (reference: string) => {
  return transactionsProvider.getTransactionByReference(reference);
};

export const getWalletActivity = async (query: WalletActivityQuery) => {
  return transactionsProvider.getWalletActivity(query);
};

export const simulateWalletInflow = async (inflowData: SimulateInflowBody) => {
  return transactionsProvider.simulateWalletInflow(inflowData);
};
