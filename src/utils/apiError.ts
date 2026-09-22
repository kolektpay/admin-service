import { Request } from "express";
import { logExceptionToTelegram } from "../services/telegramLogger.service";

class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    isOperational: boolean = true,
    stack: string = "",
    req?: Request,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    void logExceptionToTelegram(this, req).catch((error) => {
      console.error("Failed to log ApiError to Telegram:", error);
    });
  }
}

export default ApiError;
