// import { Router } from "express";
// import { pool } from "../db";

// const router = Router();

// interface QueryParams {
//   page?: string;
//   limit?: string;
//   name?: string | string[];
//   from?: string;
//   to?: string;
// }

// router.get("/:device", async (req, res) => {
//   try {
//     const { device } = req.params;
//     const query = req.query as QueryParams;

//     const page = Math.max(1, +(query.page ?? 1));
//     const limit = Math.min(1000, Math.max(1, +(query.limit ?? 10)));
//     const names = Array.isArray(query.name)
//       ? query.name
//       : query.name
//       ? [query.name]
//       : [];
//     const from = query.from;
//     const to = query.to;

//     // Build WHERE clause dynamically
//     const vals: any[] = [device];
//     let where = "sd.name = $1";

//     if (names.length) {
//       vals.push(names);
//       where += ` AND sp.name = ANY($${vals.length})`;
//     }
//     if (from) {
//       vals.push(from);
//       where += ` AND sp.created_at >= $${vals.length}`;
//     }
//     if (to) {
//       vals.push(to);
//       where += ` AND sp.created_at <= $${vals.length}`;
//     }

//     // Total count
//     const { rows: countRows } = await pool.query(
//       `SELECT COUNT(*)::int AS total
//        FROM sensor_parameter sp
//        JOIN sensor_device sd ON sp.device_id = sd.id
//        WHERE ${where}`,
//       vals
//     );

//     const total = countRows[0]?.total ?? 0;

//     // Fetch paginated data
//     vals.push(limit, (page - 1) * limit);
//     const { rows } = await pool.query(
//       `SELECT sp.id, sp.name, sp.value, sp.unit, sp.status, sp.created_at, sp.device_id
//        FROM sensor_parameter sp
//        JOIN sensor_device sd ON sp.device_id = sd.id
//        WHERE ${where}
//        ORDER BY sp.created_at DESC
//        LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
//       vals
//     );

//     res.json({
//       parameters: rows,
//       pagination: {
//         page,
//         limit,
//         totalRecords: total,
//         totalPages: Math.max(1, Math.ceil(total / limit)),
//       },
//     });
//   } catch (error) {
//     console.error("❌ API Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// export default router;
// ====================================

import { Router } from "express";
import { DataController } from "../controllers/dataController";
import { requireAuth } from "../middleware/auth";

const router = Router();

// All data routes require authentication
router.use(requireAuth);

// GET /api/data/:device
router.get("/:device", DataController.getByDevice);

export default router;
