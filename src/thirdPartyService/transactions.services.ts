import dotenv from "dotenv";
import { TransactionData } from "../interfaces/transactions.interfaces";

dotenv.config();

const api_key = process.env.API_KEY;
const get_wallet_transaction_history_url = process.env.GET_ALL_TRANSACTIONS;
const get_specific_wallet_transaction_history_url =
  process.env.GET_A_SPECIFIC_TRANSACTION;

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
