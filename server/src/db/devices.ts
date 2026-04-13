import { pool } from "./index";

export async function getDeviceId(name: string) {
  const {
    rows: [{ id }],
  } = await pool.query(
    `INSERT INTO sensor_device(name)
     VALUES($1)
     ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return id;
}
