import { Response } from "express";

import { errorResponse, successResponse } from "./response.util";

/**
 * Sends a wallet/payment-service result back to the client.
 * BaseProvider.makeRequest never throws: on failure it returns { success: false, error },
 * so that case is turned into a 502 (the upstream service failed) instead of a fake 200.
 */
export const sendPaymentServiceResult = (
  res: Response,
  result: any,
  successMessage: string,
  failureMessage: string,
): void => {
  if (!result || result.success === false) {
    return errorResponse(res, failureMessage, 502, result?.error ?? result?.message);
  }

  // Wallet service responses look like { success, message, data } - unwrap data
  const data = result.data !== undefined ? result.data : result;
  return successResponse(res, successMessage, data);
};
