"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const devices_1 = require("../db/devices");
const SENSOR_DEFINITIONS = {
    EE872: [
        { label: "CO2", unit: "ppm", base: 620, amplitude: 80, noise: 20 },
        { label: "Temperature", unit: "°C", base: 25, amplitude: 5, noise: 1.5 },
        { label: "Humidity", unit: "%", base: 52, amplitude: 8, noise: 2 },
        { label: "Pressure", unit: "hPa", base: 1012, amplitude: 6, noise: 1 },
        { label: "Dew Point", unit: "°C", base: 17, amplitude: 3, noise: 1 },
    ],
    EE895: [
        { label: "CO2", unit: "ppm", base: 640, amplitude: 70, noise: 15, phaseShift: 0.6 },
        { label: "Temperature", unit: "°C", base: 24, amplitude: 4, noise: 1.2 },
        { label: "Pressure", unit: "hPa", base: 1010, amplitude: 5, noise: 1 },
    ],
    "MQ4": [
        { label: "Methane", unit: "ppm", base: 1.8, amplitude: 0.6, noise: 0.2 },
        {
            label: "Sensor Resistance",
            unit: "Ω",
            base: 65,
            amplitude: 6,
            noise: 1.5,
            phaseShift: 1.2,
        },
    ],
    NPK: [
        { label: "Nitrogen", unit: "mg/kg", base: 28, amplitude: 6, noise: 2 },
        { label: "Phosphorus", unit: "mg/kg", base: 22, amplitude: 5, noise: 1.5 },
        { label: "Potassium", unit: "mg/kg", base: 35, amplitude: 7, noise: 2.5 },
    ],
};
const HOURS_TO_SEED = 48;
const INTERVAL_MINUTES = 30;
function generateValue(template, timestampMs) {
    const hours = timestampMs / 3600000;
    const sinusoid = Math.sin((2 * Math.PI * hours) / 24 + (template.phaseShift ?? 0));
    const noise = (Math.random() - 0.5) * template.noise;
    const value = template.base + template.amplitude * sinusoid + noise;
    return Number(value.toFixed(3));
}
async function seedHistoricalData() {
    await (0, db_1.initDB)();
    const now = Date.now();
    const startTime = now - HOURS_TO_SEED * 60 * 60 * 1000;
    await db_1.pool.query("DELETE FROM sensor_parameter WHERE created_at >= $1", [
        new Date(startTime),
    ]);
    let inserted = 0;
    for (const [sensorName, params] of Object.entries(SENSOR_DEFINITIONS)) {
        const deviceId = await (0, devices_1.getDeviceId)(sensorName);
        for (let timestamp = startTime; timestamp <= now; timestamp += INTERVAL_MINUTES * 60 * 1000) {
            for (const template of params) {
                const value = generateValue(template, timestamp);
                await db_1.pool.query(`INSERT INTO sensor_parameter
             (name, unit, value, status, device_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`, [
                    template.label,
                    template.unit,
                    value,
                    template.status ?? "normal",
                    deviceId,
                    new Date(timestamp),
                ]);
                inserted += 1;
            }
        }
    }
    console.log(`✅ Seeded ${inserted} parameter rows between ${new Date(startTime).toISOString()} and ${new Date(now).toISOString()}`);
}
seedHistoricalData()
    .catch((error) => {
    console.error("❌ Failed to seed historical data", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await db_1.pool.end();
});
