"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertParam = insertParam;
const index_1 = require("./index");
async function insertParam(dev, name, unit, value, status) {
    await index_1.pool.query(`INSERT INTO sensor_parameter
       (name, unit, value, status, device_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`, [name, unit, value, status, dev]);
}
