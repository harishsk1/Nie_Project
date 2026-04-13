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

async function run() {
  // List all devices with MQ in name
  const { rows: devices } = await pool.query(
    "SELECT id, name FROM sensor_device WHERE LOWER(name) LIKE '%mq%' ORDER BY id"
  );
  console.log('\n=== DEVICES WITH MQ ===');
  console.log(devices);

  // For each device, list distinct parameters stored
  for (const dev of devices) {
    const { rows: params } = await pool.query(
      "SELECT DISTINCT name, unit, COUNT(*) as cnt FROM sensor_parameter WHERE device_id = $1 GROUP BY name, unit ORDER BY name",
      [dev.id]
    );
    console.log(`\n=== PARAMETERS FOR "${dev.name}" (id=${dev.id}) ===`);
    console.log(params);
  }

  // Also check ALL device names to see if there's still an old "MQ-4"
  const { rows: allDevices } = await pool.query(
    "SELECT id, name, created_at FROM sensor_device ORDER BY id"
  );
  console.log('\n=== ALL DEVICES ===');
  console.log(allDevices);

  await pool.end();
}

run().catch(console.error);
