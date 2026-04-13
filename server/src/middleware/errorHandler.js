"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const ApiError_1 = require("../utils/ApiError");
const config_1 = require("../config");
const errorHandler = (err, _req, res, _next) => {
    const status = err instanceof ApiError_1.ApiError ? err.statusCode : err?.statusCode || 500;
    const payload = {
        statusCode: status,
        success: false,
        message: err instanceof ApiError_1.ApiError ? err.message : err?.message || "Internal Server Error",
        errors: err instanceof ApiError_1.ApiError ? err.errors : undefined,
    };
    if (!config_1.config.isProduction) {
        // eslint-disable-next-line no-console
        console.error("API Error:", err);
    }
    res.status(status).json(payload);
};
exports.errorHandler = errorHandler;
