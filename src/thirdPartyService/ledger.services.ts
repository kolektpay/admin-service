import dotenv from "dotenv";

import { BaseProvider } from "../providers/base.provider";
import { LedgerExportQuery, LedgerQuery } from "../validations/ledger.schema";
import { buildQueryString } from "./paymentService.query";
dotenv.config();

// API key is sent as the x-api-key header by BaseProvider on every request
const api_key = process.env.API_KEY;
const payment_service_base_url = process.env.PAYMENT_SERVICE_BASE_URL;

const LEDGER_ENDPOINTS = {
  GET_LEDGER: "/ledger",
  EXPORT_LEDGER: "/ledger/export",
} as const;

class LedgerProvider extends BaseProvider {
  constructor() {
    super("ledger", payment_service_base_url!, api_key!);
  }

  protected getAuthHeader(): string {
    return this.apiKey;
  }

  protected getAccessToken(): string {
    return this.apiKey;
  }

  // GET /ledger?walletId&startDate&endDate&page&limit - paginated ledger entries
  getLedgerEntries(query: LedgerQuery) {
    return this.makeRequest(
      `${LEDGER_ENDPOINTS.GET_LEDGER}${buildQueryString(query)}`,
      undefined,
      "GET",
    );
  }

  // GET /ledger/export?walletId&startDate&endDate - all matching entries, no pagination
  exportLedgerEntries(query: LedgerExportQuery) {
    return this.makeRequest(
      `${LEDGER_ENDPOINTS.EXPORT_LEDGER}${buildQueryString(query)}`,
      undefined,
      "GET",
    );
  }
}

const ledgerProvider = new LedgerProvider();

export const getLedgerEntries = async (query: LedgerQuery) => {
  return ledgerProvider.getLedgerEntries(query);
};

export const exportLedgerEntries = async (query: LedgerExportQuery) => {
  return ledgerProvider.exportLedgerEntries(query);
};
