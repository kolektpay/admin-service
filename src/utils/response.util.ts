import { Response } from "express";
import { IApiResponse } from "../interfaces/common.interface";

export const successResponse = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): void => {
  const response: IApiResponse<T> = {
    success: true,
    message,
    data,
  };

  res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: string
): void => {
  const response: IApiResponse = {
    success: false,
    message,
    error,
  };

  res.status(statusCode).json(response);
};

export const badRequest = (
  res: Response,
  message: string,
  error?: string
): void => {
  const response: IApiResponse = {
    success: false,
    message,
    error,
  };

  res.status(400).json(response);
};
