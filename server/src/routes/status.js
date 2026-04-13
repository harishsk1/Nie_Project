"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
router.get("/", (req, res) => {
    res.json({
        connected: (0, websocket_1.isConnected)(),
        status: (0, websocket_1.getConnectionStatus)(),
        readyState: websocket_1.ws?.readyState ?? null,
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
