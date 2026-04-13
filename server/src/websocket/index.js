"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastError = exports.lastMessage = exports.reconnectAttempts = exports.errorCount = exports.successCount = exports.messageCount = exports.connectionStatus = exports.ws = void 0;
exports.isConnected = isConnected;
exports.getConnectionStatus = getConnectionStatus;
exports.connectWebSocket = connectWebSocket;
const ws_1 = __importDefault(require("ws"));
const devices_1 = require("../db/devices");
const parameters_1 = require("../db/parameters");
const config_1 = require("../config");
const dateTime_1 = require("../utils/dateTime");
const db_1 = require("../db");
// Use config values instead of hardcoded ones
const wsUrl = config_1.config.ws.url;
const reconnectDelay = config_1.config.ws.reconnectDelay;
const maxReconnectAttempts = config_1.config.ws.maxReconnectAttempts;
// WebSocket state variables
exports.ws = null;
exports.connectionStatus = "DISCONNECTED";
exports.messageCount = 0;
exports.successCount = 0;
exports.errorCount = 0;
exports.reconnectAttempts = 0;
exports.lastMessage = "No messages received yet";
exports.lastError = "No errors";
// Helper functions
function isConnected() {
    return exports.ws !== null && exports.ws.readyState === ws_1.default.OPEN;
}
function getConnectionStatus() {
    if (!exports.ws)
        return "NOT_INITIALIZED";
    switch (exports.ws.readyState) {
        case ws_1.default.CONNECTING:
            return "CONNECTING";
        case ws_1.default.OPEN:
            return "CONNECTED";
        case ws_1.default.CLOSING:
            return "CLOSING";
        case ws_1.default.CLOSED:
            return "DISCONNECTED";
        default:
            return "UNKNOWN";
    }
}
// Connect and manage WebSocket
function connectWebSocket() {
    try {
        console.log(`🔄 Connecting to ${wsUrl}...`);
        exports.ws = new ws_1.default(wsUrl);
        exports.connectionStatus = "CONNECTING";
    }
    catch (error) {
        // If connection creation fails, schedule a retry
        exports.connectionStatus = "ERROR";
        exports.lastError = `Connection creation error: ${error.message}`;
        console.error(`❌ Failed to create WebSocket connection:`, error.message);
        console.log(`🔄 Retrying in ${reconnectDelay / 1000}s...`);
        setTimeout(connectWebSocket, reconnectDelay);
        return;
    }
    // At this point, ws is guaranteed to be non-null
    if (!exports.ws) {
        console.error("❌ WebSocket creation failed unexpectedly");
        setTimeout(connectWebSocket, reconnectDelay);
        return;
    }
    exports.ws.on("open", () => {
        exports.connectionStatus = "CONNECTED";
        exports.reconnectAttempts = 0;
        console.log("✅ WebSocket connected!");
    });
    exports.ws.on("message", async (raw) => {
        exports.messageCount++;
        const timestamp = (0, dateTime_1.formatTime)(new Date());
        exports.lastMessage = `Message #${exports.messageCount} at ${timestamp}`;
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
                    if (!paramData || typeof paramData !== 'object')
                        continue;
                    // 1. Get or create the device ID
                    const id = await (0, devices_1.getDeviceId)(devName);
                    // 2. Fetch configured parameters for this device from DB
                    const { rows: configuredParams } = await db_1.pool.query("SELECT DISTINCT name, unit FROM sensor_parameter WHERE device_id = $1 AND name IS NOT NULL", [id]);
                    // If this is a completely new device, configuredParams will simply be empty
                    // and all parameters will fall into the auto-register block below.
                    const DEFAULT_UNITS = {
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
                        if (value === undefined || value === null || isNaN(Number(value)))
                            continue;
                        // Normalize the incoming key: remove spaces/special chars, lowercase
                        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                        // Find a matched configured parameter
                        const matchedConf = configuredParams.find((conf) => {
                            const confNormalized = conf.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return confNormalized === normalizedKey;
                        });
                        if (matchedConf) {
                            // Parameter is configured, so insert it
                            await (0, parameters_1.insertParam)(id, matchedConf.name, matchedConf.unit, Number(value), "normal");
                            totalInserted++;
                        }
                        else {
                            // Auto-register unrecognized parameter from payload
                            // Format nice name: "sensor_resistance" -> "Sensor Resistance", "co2" -> "CO2"
                            const COMMON_ABBREVIATIONS = ['co2', 'o2', 'no2', 'so2', 'nh3', 'ch4', 'pm25', 'pm10', 'uv'];
                            const niceName = key
                                .split(/[_\s]+/)
                                .map(word => {
                                const w = word.toLowerCase();
                                if (COMMON_ABBREVIATIONS.includes(w))
                                    return w.toUpperCase();
                                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                            })
                                .join(' ');
                            const unit = DEFAULT_UNITS[normalizedKey] || "";
                            await (0, parameters_1.insertParam)(id, niceName, unit, Number(value), "normal");
                            totalInserted++;
                            // Push to configuredParams so we don't keep analyzing it poorly within the same loop
                            configuredParams.push({ name: niceName, unit });
                        }
                    }
                }
                exports.successCount++;
                console.log(`✅ Inserted ${totalInserted} parameters successfully`);
            }
            catch (error) {
                exports.errorCount++;
                exports.lastError = `Error at ${timestamp}: ${error.message}`;
                console.error(`❌ Processing error:`, error.message);
                // Don't throw - just log the error and continue
            }
        })().catch((err) => {
            // Catch any unhandled errors from the async IIFE
            exports.errorCount++;
            exports.lastError = `Unhandled error at ${timestamp}: ${err.message}`;
            console.error(`❌ Unhandled processing error:`, err.message);
        });
    });
    exports.ws.on("error", (error) => {
        exports.connectionStatus = "ERROR";
        exports.lastError = `Connection error: ${error.message}`;
        console.error(`❌ WebSocket error:`, error.message);
        // Don't throw or propagate the error - let the close handler handle reconnection
    });
    exports.ws.on("close", () => {
        exports.connectionStatus = "DISCONNECTED";
        // Continue reconnecting indefinitely - never give up
        exports.reconnectAttempts++;
        console.log(`🔄 Reconnecting in ${reconnectDelay / 1000}s... (Attempt ${exports.reconnectAttempts})`);
        setTimeout(connectWebSocket, reconnectDelay);
    });
}
