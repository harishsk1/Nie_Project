const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sensor_dashboard',
    password: process.env.DB_PASSWORD || '1234',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function checkData() {
    try {
        const devices = await pool.query('SELECT * FROM sensor_device');
        console.log('Devices:', devices.rows);

        if (devices.rows.length > 0) {
            for (const device of devices.rows) {
                const params = await pool.query('SELECT DISTINCT name, unit FROM sensor_parameter WHERE device_id = $1', [device.id]);
                console.log(`Device ${device.name} (ID: ${device.id}) parameters:`, params.rows);

                const recent = await pool.query('SELECT name, value, unit, created_at FROM sensor_parameter WHERE device_id = $1 ORDER BY created_at DESC LIMIT 5', [device.id]);
                console.log(`Recent data for ${device.name}:`, recent.rows);
            }
        } else {
            console.log('No devices found in database.');
        }
    } catch (err) {
        console.error('Error checking data:', err);
    } finally {
        pool.end();
    }
}

checkData();
