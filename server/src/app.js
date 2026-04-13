"use strict";
// import express from "express";
// import cors from "cors";
// import healthRouter from "./routes/health";
// import statusRouter from "./routes/status";
// import dataRouter from "./routes/data";
// import deviceRouter from "./routes/devices";
// import cookieParser from "cookie-parser";
// import authRoutes from "./routes/auth.routes";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const app = express();
// // app.use(cors());
// app.use(
//   cors({
//     // origin: ["http://localhost:5173"],
//     origin: "*",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser()); // Add this for cookie support
// // Modular routes
// app.use("/health", healthRouter);
// app.use("/connection-status", statusRouter);
// // app.use("/data", dataRouter);
// app.use("/device", deviceRouter);
// app.use("/api/data", dataRouter);
// // // ----------------users-----------------
// // app.use("/api/v1/users", userRouter);
// app.use("/api/v1/users", authRoutes);
// app.get("/health", (_req, res) => res.status(200).send("ok"));
// app.use((err: any, _req: any, res: any, _next: any) => {
//   const status = err?.statusCode || 500;
//   res.status(status).json({
//     statusCode: status,
//     message: err?.message || "Internal Server Error",
//   });
// });
// export default app;
// // // http://localhost:3000/device  -Get devices
// // // http://localhost:3000/device/1 - Get By Id
// // // http://localhost:3000/api/v1/users/register
// // // http://localhost:3000/api/v1/users/login
// // //
// // ===================================
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const health_1 = __importDefault(require("./routes/health"));
const status_1 = __importDefault(require("./routes/status"));
const data_1 = __importDefault(require("./routes/data"));
const devices_1 = __importDefault(require("./routes/devices"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const config_1 = require("./config");
const notFound_1 = require("./middleware/notFound");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
app.set("trust proxy", 1);
const allowedOrigins = config_1.config.client.url
    .split(",")
    .map((origin) => origin.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        console.log("CORS origin check:", origin);
        // CRITICAL: When credentials: true, we MUST return a specific origin string, NEVER true/*
        // In development mode
        if (!config_1.config.isProduction) {
            // Allow requests without origin header (Postman, curl, etc.)
            // Return the default client URL as the allowed origin
            if (!origin) {
                const defaultOrigin = config_1.config.client.url || "http://localhost:5173";
                console.log("No origin header, allowing:", defaultOrigin);
                return callback(null, defaultOrigin);
            }
            // Allow any localhost origin in development
            if (origin.startsWith("http://localhost:") ||
                origin.startsWith("http://127.0.0.1:") ||
                allowedOrigins.includes(origin)) {
                console.log("Allowing origin:", origin);
                return callback(null, origin); // Return the exact origin string
            }
            // Reject unknown origins
            console.log("Rejecting origin:", origin);
            return callback(new Error(`Not allowed by CORS: ${origin}`));
        }
        // Production mode: only allow configured origins
        if (!origin) {
            return callback(new Error("Origin header is required in production"));
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, origin);
        }
        return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type"],
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)(config_1.config.isProduction ? "combined" : "dev"));
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Health + status
app.get("/health", (_req, res) => res.status(200).send("ok"));
app.use("/health", health_1.default);
app.use("/connection-status", status_1.default);
// API routes
app.use("/api/v1/users", auth_routes_1.default);
app.use("/api/v1/devices", devices_1.default);
app.use("/api/v1/data", data_1.default);
// Fallbacks
app.use(notFound_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
exports.default = app;
