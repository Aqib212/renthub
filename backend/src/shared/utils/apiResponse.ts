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

/** Wraps a service result in the standard envelope. A `{ data, meta }` list result is split into both fields. */
export const sendResult = (res: Response, result: unknown, statusCode = 200, message = "OK") => {
  const r = result as { data?: unknown; meta?: Record<string, unknown> } | null;
  const isList = !!r && typeof r === "object" && !Array.isArray(r) && "data" in r && "meta" in r && Object.keys(r).length === 2;
  return sendSuccess(res, { statusCode, message, data: isList ? r!.data : result, meta: isList ? r!.meta : undefined });
};
