"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const ApiError_1 = require("../utils/ApiError");
const requireAdmin = (req, _res, next) => {
    if (req.user?.role !== "ADMIN") {
        throw new ApiError_1.ApiError(403, "Forbidden: Admin access required");
    }
    next();
};
exports.requireAdmin = requireAdmin;
