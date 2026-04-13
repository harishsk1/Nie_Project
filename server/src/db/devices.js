"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceId = getDeviceId;
const index_1 = require("./index");
async function getDeviceId(name) {
    const { rows: [{ id }], } = await index_1.pool.query(`INSERT INTO sensor_device(name)
     VALUES($1)
     ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`, [name]);
    return id;
}
