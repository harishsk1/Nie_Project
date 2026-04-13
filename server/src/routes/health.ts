import { Router } from "express";
import {
  getConnectionStatus,
  isConnected,
  ws,
  messageCount,
  successCount,
  errorCount,
  reconnectAttempts,
  lastMessage,
  lastError,
} from "../websocket";

const router = Router();

router.get("/", (req, res) => {
  const timestamp = new Date().toISOString();
  res.json({
    status: "ok",
    timestamp,
    websocket: {
      status: getConnectionStatus(),
      connected: isConnected(),
      messages_received: messageCount,
      successful_parses: successCount,
      parsing_errors: errorCount,
      success_rate:
        messageCount > 0
          ? `${((successCount / messageCount) * 100).toFixed(1)}%`
          : "0%",
      reconnect_attempts: reconnectAttempts,
      last_message: lastMessage,
      last_error: errorCount > 0 ? lastError : null,
    },
    database: "connected",
  });
});

export default router;
