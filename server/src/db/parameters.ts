import { pool } from "./index";

export async function insertParam(
  dev: number,
  name: string,
  unit: string,
  value: number,
  status: string
) {
  await pool.query(
    `INSERT INTO sensor_parameter
       (name, unit, value, status, device_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [name, unit, value, status, dev]
  );
}
