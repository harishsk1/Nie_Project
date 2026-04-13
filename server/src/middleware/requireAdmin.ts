// middleware/requireAdmin.ts
import type { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError";

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "ADMIN") {
    throw new ApiError(403, "Forbidden: Admin access required");
  }
  next();
};
