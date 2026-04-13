"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceController = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiResponse_1 = require("../utils/ApiResponse");
const devicePayloadSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Device name is required").max(120),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.coerce.number().int().positive("Invalid device ID"),
});
// Normalize parameter names to ensure consistent casing
// Common abbreviations are kept in uppercase, other words use title case
function normalizeParameterName(name) {
    const trimmed = name.trim();
    if (!trimmed)
        return trimmed;
    // Common abbreviations that should be uppercase (case-insensitive matching)
    const abbreviations = ['CO2', 'O2', 'NO2', 'SO2', 'PM2.5', 'PM10', 'H2O', 'NH3', 'CH4', 'NOx', 'UV', 'IR'];
    // Normalize the input for comparison (remove extra spaces)
    const normalizedInput = trimmed.replace(/\s+/g, ' ').trim();
    const upperInput = normalizedInput.toUpperCase();
    // Check if the entire name (case-insensitive) matches an abbreviation
    if (abbreviations.includes(upperInput)) {
        return upperInput;
    }
    // Split into words and process each word
    const words = normalizedInput.split(/\s+/);
    const normalizedWords = words.map(word => {
        const upperWord = word.toUpperCase();
        // If word matches an abbreviation, use the standard uppercase form
        if (abbreviations.includes(upperWord)) {
            return upperWord;
        }
        // Special handling for compound abbreviations like "PM2.5"
        // Check if any abbreviation is a substring
        const matchedAbbr = abbreviations.find(abbr => upperWord.includes(abbr) || upperWord.replace(/[^A-Z0-9]/g, '') === abbr.replace(/[^A-Z0-9]/g, ''));
        if (matchedAbbr) {
            return word.replace(new RegExp(matchedAbbr, 'gi'), matchedAbbr);
        }
        // For regular words, use title case (first letter uppercase, rest lowercase)
        if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return word;
    });
    return normalizedWords.join(' ').trim();
}
class DeviceController {
}
exports.DeviceController = DeviceController;
_a = DeviceController;
DeviceController.getAll = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const { rows } = await db_1.pool.query("SELECT id, name, created_at, updated_at FROM sensor_device ORDER BY id");
    // Transform created_at and updated_at to camelCase for frontend
    const devices = rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, devices, "Devices fetched successfully"));
});
DeviceController.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { rows } = await db_1.pool.query("SELECT id, name, created_at, updated_at FROM sensor_device WHERE id = $1", [id]);
    if (!rows[0]) {
        throw new ApiError_1.ApiError(404, "Device not found");
    }
    // Transform created_at and updated_at to camelCase for frontend
    const device = {
        id: rows[0].id,
        name: rows[0].name,
        createdAt: rows[0].created_at ? new Date(rows[0].created_at).toISOString() : null,
        updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    };
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, device, "Device fetched successfully"));
});
DeviceController.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name } = devicePayloadSchema.parse(req.body);
    try {
        const { rows } = await db_1.pool.query("INSERT INTO sensor_device (name) VALUES ($1) RETURNING id, name, created_at, updated_at", [name]);
        // Transform created_at and updated_at to camelCase for frontend
        const device = {
            id: rows[0].id,
            name: rows[0].name,
            createdAt: rows[0].created_at ? new Date(rows[0].created_at).toISOString() : null,
            updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
        };
        return res
            .status(201)
            .json(new ApiResponse_1.ApiResponse(201, device, "Device created successfully"));
    }
    catch (error) {
        if (error.code === "23505") {
            throw new ApiError_1.ApiError(409, "Device name already exists");
        }
        throw error;
    }
});
DeviceController.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { name } = devicePayloadSchema.parse(req.body);
    try {
        const { rows } = await db_1.pool.query("UPDATE sensor_device SET name = $1 WHERE id = $2 RETURNING id, name, created_at, updated_at", [name, id]);
        if (!rows[0]) {
            throw new ApiError_1.ApiError(404, "Device not found");
        }
        // Transform created_at and updated_at to camelCase for frontend
        const device = {
            id: rows[0].id,
            name: rows[0].name,
            createdAt: rows[0].created_at ? new Date(rows[0].created_at).toISOString() : null,
            updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
        };
        return res
            .status(200)
            .json(new ApiResponse_1.ApiResponse(200, device, "Device updated successfully"));
    }
    catch (error) {
        if (error.code === "23505") {
            throw new ApiError_1.ApiError(409, "Device name already exists");
        }
        throw error;
    }
});
DeviceController.delete = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await db_1.pool.query("DELETE FROM sensor_parameter WHERE device_id = $1", [
        id,
    ]);
    const { rows } = await db_1.pool.query("DELETE FROM sensor_device WHERE id = $1 RETURNING id, name, created_at, updated_at", [id]);
    if (!rows[0]) {
        throw new ApiError_1.ApiError(404, "Device not found");
    }
    // Transform created_at and updated_at to camelCase for frontend
    const device = {
        id: rows[0].id,
        name: rows[0].name,
        createdAt: rows[0].created_at ? new Date(rows[0].created_at).toISOString() : null,
        updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    };
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, device, "Device deleted successfully"));
});
// Get distinct parameters (name + unit) for a device
DeviceController.getParameters = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    // Check if device exists
    const deviceCheck = await db_1.pool.query("SELECT id FROM sensor_device WHERE id = $1", [id]);
    if (!deviceCheck.rows[0]) {
        throw new ApiError_1.ApiError(404, "Device not found");
    }
    // Get distinct parameter name and unit combinations for this device
    const { rows } = await db_1.pool.query(`SELECT DISTINCT name, unit 
       FROM sensor_parameter 
       WHERE device_id = $1 AND name IS NOT NULL
       ORDER BY name, unit`, [id]);
    const parameters = rows.map((row) => ({
        name: row.name,
        unit: row.unit || "",
    }));
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, parameters, "Device parameters fetched successfully"));
});
// Add a parameter mapping to a device
DeviceController.addParameter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const parameterSchema = zod_1.z.object({
        name: zod_1.z.string().trim().min(1, "Parameter name is required").max(120),
        unit: zod_1.z.string().trim().max(50).default(""),
    });
    const { name: rawName, unit } = parameterSchema.parse(req.body);
    // Normalize parameter name for consistency (e.g., "Co2" -> "CO2", "temperature" -> "Temperature")
    const normalizedName = normalizeParameterName(rawName);
    // Check if device exists
    const deviceCheck = await db_1.pool.query("SELECT id FROM sensor_device WHERE id = $1", [id]);
    if (!deviceCheck.rows[0]) {
        throw new ApiError_1.ApiError(404, "Device not found");
    }
    // Check if parameter already exists for this device (case-insensitive comparison for name, exact match for unit)
    const existingCheck = await db_1.pool.query(`SELECT id, name FROM sensor_parameter 
       WHERE device_id = $1 AND LOWER(name) = LOWER($2) AND unit = $3
       LIMIT 1`, [id, normalizedName, unit]);
    if (existingCheck.rows.length > 0) {
        // Parameter exists, return the normalized name that's in the database
        return res
            .status(200)
            .json(new ApiResponse_1.ApiResponse(200, { name: existingCheck.rows[0].name, unit: unit }, "Parameter already exists"));
    }
    // Insert a template parameter entry (with null value) to establish the mapping
    await db_1.pool.query(`INSERT INTO sensor_parameter (name, unit, value, status, device_id, created_at)
       VALUES ($1, $2, NULL, 'normal', $3, NOW())`, [normalizedName, unit, id]);
    return res
        .status(201)
        .json(new ApiResponse_1.ApiResponse(201, { name: normalizedName, unit: unit }, "Parameter added successfully"));
});
// Remove a parameter mapping from a device
DeviceController.removeParameter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const parameterSchema = zod_1.z.object({
        name: zod_1.z.string().trim().min(1, "Parameter name is required"),
        unit: zod_1.z.string().trim().default(""),
    });
    // Parse from query params for DELETE request
    const { name, unit } = parameterSchema.parse(req.query);
    // Check if device exists
    const deviceCheck = await db_1.pool.query("SELECT id FROM sensor_device WHERE id = $1", [id]);
    if (!deviceCheck.rows[0]) {
        throw new ApiError_1.ApiError(404, "Device not found");
    }
    // Delete all parameter entries with this name and unit for this device
    // Using LOWER() for case-insensitive matching to ensure we delete even if there are case variations
    const { rowCount } = await db_1.pool.query(`DELETE FROM sensor_parameter 
       WHERE device_id = $1 AND LOWER(name) = LOWER($2) AND unit = $3`, [id, name, unit]);
    if (rowCount === 0) {
        throw new ApiError_1.ApiError(404, "Parameter not found for this device");
    }
    return res
        .status(200)
        .json(new ApiResponse_1.ApiResponse(200, { name, unit }, "Parameter removed successfully"));
});
