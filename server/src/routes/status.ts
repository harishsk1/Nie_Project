import { Router } from "express";
import { getConnectionStatus, isConnected, ws } from "../websocket";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    connected: isConnected(),
    status: getConnectionStatus(),
    readyState: ws?.readyState ?? null,
    timestamp: new Date().toISOString(),
  });
});

export default router;
