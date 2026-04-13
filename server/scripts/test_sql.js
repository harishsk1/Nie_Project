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
    const truncExpr = "date_trunc('hour', sp.created_at) + INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM sp.created_at) / 30)";
    const where = "sd.name = $1 AND sp.name = ANY($2)";
    const values = ['EE895', ['Pressure']];

    try {
        console.log("Testing Count Query...");
        const countQuery = `
        SELECT COUNT(DISTINCT (${truncExpr}, sp.name))::int AS total
        FROM sensor_parameter sp
        JOIN sensor_device sd ON sp.device_id = sd.id
        WHERE ${where}
    `;
        console.log(countQuery);
        const res1 = await pool.query(countQuery, values);
        console.log("Count Success:", res1.rows[0]);
    } catch (e) {
        console.error("Count Query Failed:", e.message);
    }

    try {
        console.log("\nTesting Aggregate Query...");
        const aggQuery = `
        SELECT 
          ${truncExpr} AS time_bucket,
          sp.name,
          AVG(sp.value::numeric)::float AS value
        FROM sensor_parameter sp
        JOIN sensor_device sd ON sp.device_id = sd.id
        WHERE ${where}
        GROUP BY ${truncExpr}, sp.name
        LIMIT 5
    `;
        console.log(aggQuery);
        const res2 = await pool.query(aggQuery, values);
        console.log("Aggregate Success:", res2.rows.length, "rows");
    } catch (e) {
        console.error("Aggregate Query Failed:", e.message);
    }

    pool.end();
}

testQuery();
