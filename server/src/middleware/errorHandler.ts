import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";

export const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  const status =
    err instanceof ApiError ? err.statusCode : err?.statusCode || 500;

  const payload = {
    statusCode: status,
    success: false,
    message: err instanceof ApiError ? err.message : err?.message || "Internal Server Error",
    errors: err instanceof ApiError ? err.errors : undefined,
  };

  if (!config.isProduction) {
    // eslint-disable-next-line no-console
    console.error("API Error:", err);
  }

  res.status(status).json(payload);
};

