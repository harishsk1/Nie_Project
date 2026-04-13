"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const notFoundHandler = (_req, res, _next) => {
    res.status(404).json({
        statusCode: 404,
        success: false,
        message: "Resource not found",
    });
};
exports.notFoundHandler = notFoundHandler;
