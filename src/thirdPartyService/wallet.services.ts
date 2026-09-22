import dotenv from "dotenv";
import {
  GeneratePaymentLinkRequestBody,
  GetAllPaymentLinksParamsBody,
} from "../interfaces/wallet.interfaces";
import { PaymentItemData } from "../interfaces/paymentitemwalletcreationdatainterface";
import { CreatePaymentItemWalletResponse } from "../interfaces/paymentItem.interface";
dotenv.config();

const api_key = process.env.API_KEY;
const create_wallet_url = process.env.CREATE_WALLET_API_URL;
const create_student_wallet_url = process.env.CREATE_STUDENT_WALLET_API_URL;
const get_wallet_details_url = process.env.GET_WALLET_DETAILS_API_URL;
const generate_payment_link_url = process.env.GENERATE_PAYMENT_LINK_URL;
const create_payment_item_wallet_url = process.env.CREATE_A_PAYMENT_ITEM_WALLET;

export const createWallet = async (userId: string, businessId: number) => {
  const response = await fetch(create_wallet_url!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api_key!,
    },
    body: JSON.stringify({ userId, businessId }),
  });

  return response.json();
};

export const createStudentWallet = async (
  studentWalletCreationInfo: object,
) => {
  const response = await fetch(create_student_wallet_url!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api_key!,
    },
    body: JSON.stringify(studentWalletCreationInfo),
  });

  return response.json();
};

export const getSpecificStudentWallet = async (
  studentId: bigint,
  businessId: bigint,
) => {
  const response = await fetch(
    `${create_student_wallet_url!}/${businessId}/${studentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": api_key!,
      },
    },
  );

  return response.json();
};

export const getWalletDetailsAfterLogin = async (businessId: number) => {
  const response = await fetch(`${get_wallet_details_url}/${businessId}`, {
    method: "GET",
    headers: {
      "x-api-key": api_key!,
    },
  });

  return response.json();
};

export const generatePaymentLink = async (
  paymentLinkData: GeneratePaymentLinkRequestBody,
) => {
  const response = await fetch(generate_payment_link_url!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api_key!,
    },
    body: JSON.stringify(paymentLinkData),
  });

  return response.json();
};

export const getAllPaymentLinksOfOneBusinessByBusinessId = async (
  allPaymentLinksData: GetAllPaymentLinksParamsBody,
) => {
  const response = await fetch(
    `${generate_payment_link_url}?businessId=${allPaymentLinksData.businessId}&page=${allPaymentLinksData.page}&limit=${allPaymentLinksData.limit}&startDate=${allPaymentLinksData.startDate}&endDate=${allPaymentLinksData.endDate}`,
    {
      method: "GET",
      headers: {
        "x-api-key": api_key!,
      },
    },
  );

  return response.json();
};

export const createPaymentItemWallet = async (
  paymentItemWalletCreationInfo: PaymentItemData,
): Promise<CreatePaymentItemWalletResponse> => {
  console.log(
    "Payment Item Wallet Creation Info:",
    paymentItemWalletCreationInfo,
  );
  const response = await fetch(create_payment_item_wallet_url!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": api_key!,
    },
    body: JSON.stringify(paymentItemWalletCreationInfo),
  });

  return response.json() as Promise<CreatePaymentItemWalletResponse>;
};
