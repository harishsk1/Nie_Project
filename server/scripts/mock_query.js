const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sensor_dashboard',
    password: process.env.DB_PASSWORD || '1234',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function testQuery() {
    try {
        const today = new Date();
        const from = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const to = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const query = `
        SELECT 
          date_trunc('hour', sp.created_at) AS time_bucket,
          sp.name,
          AVG(sp.value::numeric)::float AS value,
          MAX(sp.unit) AS unit,
          'aggregated' AS status,
          date_trunc('hour', sp.created_at) AS created_at,
          MAX(sp.device_id) AS device_id,
          COUNT(*) AS sample_count
        FROM sensor_parameter sp
        JOIN sensor_device sd ON sp.device_id = sd.id
        WHERE sd.name = $1 AND sp.name = ANY($2) AND sp.created_at >= $3 AND sp.created_at <= $4
        GROUP BY 1, 2
        ORDER BY 1 DESC, 2
        LIMIT 50
    `;
        const values = ['EE872', ['CO2'], from, to];

        console.log("Executing Query:");
        console.log(query);
        console.log("Values:", values);

        const { rows } = await pool.query(query, values);
        console.log(`Returned ${rows.length} rows.`);

        if (rows.length > 0) {
            console.log("First row:", rows[0]);
            console.log("Time Bucket (raw):", rows[0].time_bucket);
            console.log("Time Bucket (toISOString):", new Date(rows[0].time_bucket).toISOString());
            console.log("Time Bucket (getTime):", new Date(rows[0].time_bucket).getTime());
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

testQuery();
