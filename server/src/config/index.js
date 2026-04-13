"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const env_1 = require("./env");
exports.config = {
    env: env_1.env,
    isProduction: env_1.isProduction,
    server: {
        port: env_1.env.PORT,
    },
    client: {
        url: env_1.env.CLIENT_URL,
    },
    db: {
        connectionString: env_1.env.DATABASE_URL,
        user: env_1.env.DB_USER,
        password: env_1.env.DB_PASSWORD,
        host: env_1.env.DB_HOST,
        port: env_1.env.DB_PORT,
        database: env_1.env.DB_NAME,
    },
    ws: {
        url: env_1.env.WS_URL,
        reconnectDelay: env_1.env.WS_RECONNECT_DELAY,
        maxReconnectAttempts: env_1.env.WS_MAX_RECONNECT_ATTEMPTS,
    },
    auth: {
        accessTokenSecret: env_1.env.ACCESS_TOKEN_SECRET,
        refreshTokenSecret: env_1.env.REFRESH_TOKEN_SECRET,
        accessTokenTTL: env_1.env.ACCESS_TOKEN_EXPIRES_IN,
        refreshTokenTTL: env_1.env.REFRESH_TOKEN_EXPIRES_IN,
    },
};
