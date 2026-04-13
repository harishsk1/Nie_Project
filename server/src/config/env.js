"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    PORT: zod_1.z.coerce.number().default(5000),
    CLIENT_URL: zod_1.z
        .string()
        .url()
        .default("http://localhost:5173"),
    DATABASE_URL: zod_1.z.string().optional(),
    DB_USER: zod_1.z.string().default("postgres"),
    DB_PASSWORD: zod_1.z.string().default(""),
    DB_HOST: zod_1.z.string().default("localhost"),
    DB_PORT: zod_1.z.coerce.number().default(5432),
    DB_NAME: zod_1.z.string().default("Sensor_db"),
    WS_URL: zod_1.z.string().url().default("ws://localhost:8081"),
    WS_RECONNECT_DELAY: zod_1.z.coerce.number().default(5000),
    WS_MAX_RECONNECT_ATTEMPTS: zod_1.z.coerce.number().default(10),
    ACCESS_TOKEN_SECRET: zod_1.z
        .string()
        .min(10, "ACCESS_TOKEN_SECRET must be at least 10 characters")
        .default("dev-access-secret"),
    REFRESH_TOKEN_SECRET: zod_1.z
        .string()
        .min(10, "REFRESH_TOKEN_SECRET must be at least 10 characters")
        .default("dev-refresh-secret"),
    ACCESS_TOKEN_EXPIRES_IN: zod_1.z.string().default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default("7d"),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error("❌ Invalid environment configuration", parsedEnv.error.flatten());
    throw new Error("Environment validation failed. Please check your .env file.");
}
exports.env = parsedEnv.data;
exports.isProduction = exports.env.NODE_ENV === "production";
