"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
router.get("/", (req, res) => {
    const timestamp = new Date().toISOString();
    res.json({
        status: "ok",
        timestamp,
        websocket: {
            status: (0, websocket_1.getConnectionStatus)(),
            connected: (0, websocket_1.isConnected)(),
            messages_received: websocket_1.messageCount,
            successful_parses: websocket_1.successCount,
            parsing_errors: websocket_1.errorCount,
            success_rate: websocket_1.messageCount > 0
                ? `${((websocket_1.successCount / websocket_1.messageCount) * 100).toFixed(1)}%`
                : "0%",
            reconnect_attempts: websocket_1.reconnectAttempts,
            last_message: websocket_1.lastMessage,
            last_error: websocket_1.errorCount > 0 ? websocket_1.lastError : null,
        },
        database: "connected",
    });
});
exports.default = router;
