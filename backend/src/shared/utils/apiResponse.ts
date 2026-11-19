import { Response } from "express";

interface ApiResponseOptions {
  statusCode: number;
  message: string;
  data?: unknown;
  meta?: Record<string, unknown>;
}

export const sendSuccess = (res: Response, options: ApiResponseOptions) => {
  return res.status(options.statusCode).json({
    success: true,
    message: options.message,
    data: options.data,
    meta: options.meta,
  });
};

export const sendError = (res: Response, statusCode: number, message: string, errors?: unknown) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
