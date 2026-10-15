import { Request, Response, NextFunction } from "express";
import { logExceptionToTelegram } from "../services/telegramLogger.service";
import { IFieldError } from "../interfaces/common.interface";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: IFieldError[];

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: IFieldError[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = async (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Expected client errors (4xx AppErrors) are not exceptions worth alerting on
  const isClientError = err instanceof AppError && err.statusCode < 500;

  if (!isClientError) {
    // Log exception to Telegram (non-blocking)
    logExceptionToTelegram(err, req).catch((telegramError) => {
      console.error("Failed to log to Telegram:", telegramError);
    });
  }

  if (err instanceof AppError) {
    if (!isClientError) {
      console.error(`[${req.requestId}] ERROR:`, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId: req.requestId,
    });
    return;
  }

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    res.status(400).json({
      success: false,
      message: "Database error occurred",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
    return;
  }

  // Default error
  console.error(`[${req.requestId}] ERROR:`, err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    requestId: req.requestId,
  });

  next(err);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
