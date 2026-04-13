import WebSocket from "ws";
import { getDeviceId } from "../db/devices";
import { insertParam } from "../db/parameters";
import { config } from "../config";
import { formatTime } from "../utils/dateTime";
import { pool } from "../db";

// Use config values instead of hardcoded ones
const wsUrl = config.ws.url;
const reconnectDelay = config.ws.reconnectDelay;
const maxReconnectAttempts = config.ws.maxReconnectAttempts;

// WebSocket state variables
export let ws: WebSocket | null = null;
export let connectionStatus = "DISCONNECTED";
export let messageCount = 0;
export let successCount = 0;
export let errorCount = 0;
export let reconnectAttempts = 0;
export let lastMessage = "No messages received yet";
export let lastError = "No errors";

// Helper functions
export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getConnectionStatus(): string {
  if (!ws) return "NOT_INITIALIZED";
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "CONNECTED";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "DISCONNECTED";
    default:
      return "UNKNOWN";
  }
}

// Connect and manage WebSocket
export function connectWebSocket() {
  try {
    console.log(`🔄 Connecting to ${wsUrl}...`);
    ws = new WebSocket(wsUrl);

    connectionStatus = "CONNECTING";
  } catch (error: any) {
    // If connection creation fails, schedule a retry
    connectionStatus = "ERROR";
    lastError = `Connection creation error: ${error.message}`;
    console.error(`❌ Failed to create WebSocket connection:`, error.message);
    console.log(`🔄 Retrying in ${reconnectDelay / 1000}s...`);
    setTimeout(connectWebSocket, reconnectDelay);
    return;
  }

  // At this point, ws is guaranteed to be non-null
  if (!ws) {
    console.error("❌ WebSocket creation failed unexpectedly");
    setTimeout(connectWebSocket, reconnectDelay);
    return;
  }

  ws.on("open", () => {
    connectionStatus = "CONNECTED";
    reconnectAttempts = 0;
    console.log("✅ WebSocket connected!");
  });

  ws.on("message", async (raw) => {

    messageCount++;
    const timestamp = formatTime(new Date());
    lastMessage = `Message #${messageCount} at ${timestamp}`;

    // Wrap in try-catch to prevent unhandled promise rejections
    (async () => {
      try {
        let cleanString = raw.toString().trim();
        if (cleanString.startsWith('"') && cleanString.endsWith('"')) {
          cleanString = cleanString.slice(1, -1).replace(/\\"/g, '"');
        }
        const p = JSON.parse(cleanString);
        console.log(p);

        let totalInserted = 0;

        // Iterate over devices in the incoming payload dynamically
        for (const [devName, paramData] of Object.entries(p)) {
          if (!paramData || typeof paramData !== 'object') continue;

          // 1. Get or create the device ID
          const id = await getDeviceId(devName);

          // 2. Fetch configured parameters for this device from DB
          const { rows: configuredParams } = await pool.query(
            "SELECT DISTINCT name, unit FROM sensor_parameter WHERE device_id = $1 AND name IS NOT NULL",
            [id]
          );

          // If this is a completely new device, configuredParams will simply be empty
          // and all parameters will fall into the auto-register block below.

          const DEFAULT_UNITS: Record<string, string> = {
            "co2": "ppm",
            "temperature": "°C",
            "humidity": "%",
            "pressure": "hPa",
            "dewpoint": "°C",
            "methane": "ppm",
            "sensorresistance": "Ω",
            "nitrogen": "mg/kg",
            "phosphorus": "mg/kg",
            "potassium": "mg/kg",
            "altitude": "m"
          };

          // 3. Match incoming keys to configured parameters
          for (const [key, value] of Object.entries(paramData)) {
            if (value === undefined || value === null || isNaN(Number(value))) continue;

            // Normalize the incoming key: remove spaces/special chars, lowercase
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Find a matched configured parameter
            const matchedConf = configuredParams.find((conf: any) => {
              const confNormalized = conf.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return confNormalized === normalizedKey;
            });

            if (matchedConf) {
              // Parameter is configured, so insert it
              await insertParam(id, matchedConf.name, matchedConf.unit, Number(value), "normal");
              totalInserted++;
            } else {
              // Auto-register unrecognized parameter from payload
              // Format nice name: "sensor_resistance" -> "Sensor Resistance", "co2" -> "CO2"
              const COMMON_ABBREVIATIONS = ['co2', 'o2', 'no2', 'so2', 'nh3', 'ch4', 'pm25', 'pm10', 'uv'];
              const niceName = key
                .split(/[_\s]+/)
                .map(word => {
                  const w = word.toLowerCase();
                  if (COMMON_ABBREVIATIONS.includes(w)) return w.toUpperCase();
                  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                })
                .join(' ');

              const unit = DEFAULT_UNITS[normalizedKey] || "";
              await insertParam(id, niceName, unit, Number(value), "normal");
              totalInserted++;

              // Push to configuredParams so we don't keep analyzing it poorly within the same loop
              configuredParams.push({ name: niceName, unit });
            }
          }
        }

        successCount++;
        console.log(`✅ Inserted ${totalInserted} parameters successfully`);
      } catch (error: any) {
        errorCount++;
        lastError = `Error at ${timestamp}: ${error.message}`;
        console.error(`❌ Processing error:`, error.message);
        // Don't throw - just log the error and continue
      }
    })().catch((err) => {
      // Catch any unhandled errors from the async IIFE
      errorCount++;
      lastError = `Unhandled error at ${timestamp}: ${err.message}`;
      console.error(`❌ Unhandled processing error:`, err.message);
    });
  });

  ws.on("error", (error) => {
    connectionStatus = "ERROR";
    lastError = `Connection error: ${error.message}`;
    console.error(`❌ WebSocket error:`, error.message);
    // Don't throw or propagate the error - let the close handler handle reconnection
  });

  ws.on("close", () => {
    connectionStatus = "DISCONNECTED";
    // Continue reconnecting indefinitely - never give up
    reconnectAttempts++;
    console.log(
      `🔄 Reconnecting in ${reconnectDelay / 1000
      }s... (Attempt ${reconnectAttempts})`
    );
    setTimeout(connectWebSocket, reconnectDelay);
  });
}
