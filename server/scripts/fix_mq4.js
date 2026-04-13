const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function fix() {
  // Fix "Sensor_resistance" -> "Sensor Resistance" and unit "m" -> "Ω"
  // for device id=83559 (MQ4)
  const { rowCount } = await pool.query(
    `UPDATE sensor_parameter 
     SET name = 'Sensor Resistance', unit = $1
     WHERE device_id = 83559 AND LOWER(name) = 'sensor_resistance'`,
    ['Ω']
  );
  console.log(`Updated ${rowCount} rows: Sensor_resistance -> Sensor Resistance (unit: Ω)`);

  // Verify result
  const { rows } = await pool.query(
    "SELECT DISTINCT name, unit, COUNT(*) as cnt FROM sensor_parameter WHERE device_id = 83559 GROUP BY name, unit ORDER BY name"
  );
  console.log('\n=== MQ4 parameters after fix ===');
  console.log(rows);

  await pool.end();
}

fix().catch(console.error);
