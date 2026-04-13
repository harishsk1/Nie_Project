import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";

const paramsSchema = z.object({
  device: z.string().trim().min(1),
});

// Interval options: 1m (1 minute), 30m (30 minutes), 1h (1 hour), 12h (12 hours), 1d (24 hours/1 day), 1M (1 month)
const VALID_INTERVALS = ["1m", "30m", "1h", "12h", "1d", "1M"] as const;
type IntervalType = (typeof VALID_INTERVALS)[number];

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  name: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)),
    ])
    .optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  interval: z.enum(VALID_INTERVALS).optional(),
});

// Helper to get PostgreSQL interval expression
const getIntervalTruncation = (interval: IntervalType): string => {
  switch (interval) {
    case "1m":
      return "date_trunc('minute', sp.created_at)";
    case "30m":
      // Round down to nearest 30-minute interval
      return "date_trunc('hour', sp.created_at) + INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM sp.created_at) / 30)";
    case "1h":
      return "date_trunc('hour', sp.created_at)";
    case "12h":
      // Round down to nearest 12-hour interval (0-11 -> 0, 12-23 -> 12)
      return "date_trunc('day', sp.created_at) + INTERVAL '12 hour' * FLOOR(EXTRACT(HOUR FROM sp.created_at) / 12)";
    case "1d":
      return "date_trunc('day', sp.created_at)";
    case "1M":
      return "date_trunc('month', sp.created_at)";
    default:
      return "date_trunc('minute', sp.created_at)";
  }
};

export class DataController {
  static getByDevice = asyncHandler(async (req: Request, res: Response) => {
    const { device } = paramsSchema.parse(req.params);
    const { page, limit, name, from, to, interval } = querySchema.parse(req.query);

    const names = Array.isArray(name) ? name : name ? [name] : [];

    const values: Array<string | number | string[]> = [device];
    let where = "sd.name = $1";

    if (names.length) {
      values.push(names);
      where += ` AND sp.name = ANY($${values.length})`;
    }

    if (from) {
      values.push(from);
      where += ` AND sp.created_at >= $${values.length}`;
    }

    if (to) {
      values.push(to);
      where += ` AND sp.created_at <= $${values.length}`;
    }

    // If interval is specified, use aggregation query
    if (interval) {
      const truncExpr = getIntervalTruncation(interval);

      // Count unique time buckets for pagination
      const countQuery = `
        SELECT COUNT(*)::int AS total FROM (
          SELECT DISTINCT ${truncExpr}, sp.name
          FROM sensor_parameter sp
          JOIN sensor_device sd ON sp.device_id = sd.id
          WHERE ${where}
        ) AS subquery
      `;

      const { rows: countRows } = await pool.query(countQuery, values);
      const total = countRows[0]?.total ?? 0;

      // Aggregated data query with pagination
      const aggregateValues = [...values, limit, (page - 1) * limit];
      const aggregateQuery = `
        SELECT 
          ${truncExpr} AS time_bucket,
          sp.name,
          AVG(sp.value::numeric)::float AS value,
          MAX(sp.unit) AS unit,
          'aggregated' AS status,
          ${truncExpr} AS created_at,
          MAX(sp.device_id) AS device_id,
          COUNT(*) AS sample_count
        FROM sensor_parameter sp
        JOIN sensor_device sd ON sp.device_id = sd.id
        WHERE ${where}
        GROUP BY ${truncExpr}, sp.name
        ORDER BY ${truncExpr} DESC, sp.name
        LIMIT $${aggregateValues.length - 1} OFFSET $${aggregateValues.length}
      `;

      const { rows } = await pool.query(aggregateQuery, aggregateValues);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            parameters: rows,
            pagination: {
              page,
              limit,
              totalRecords: total,
              totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            aggregation: {
              interval,
              isAggregated: true,
            },
          },
          "Aggregated sensor data fetched successfully"
        )
      );
    }

    // Non-aggregated query — get per-parameter counts in one GROUP BY query
    // (this also gives us the overall total by summing each group)
    const { rows: countRows } = await pool.query(
      `SELECT sp.name, COUNT(*)::int AS cnt
       FROM sensor_parameter sp
       JOIN sensor_device sd ON sp.device_id = sd.id
       WHERE ${where}
       GROUP BY sp.name`,
      values
    );

    // Build the per-parameter counts map and overall total
    const parameterCounts: Record<string, number> = {};
    let total = 0;
    for (const r of countRows) {
      parameterCounts[r.name] = r.cnt as number;
      total += r.cnt as number;
    }

    values.push(limit, (page - 1) * limit);
    const { rows } = await pool.query(
      `SELECT sp.id,
              sp.name,
              sp.value,
              sp.unit,
              sp.status,
              sp.created_at,
              sp.device_id
       FROM sensor_parameter sp
       JOIN sensor_device sd ON sp.device_id = sd.id
       WHERE ${where}
       ORDER BY sp.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          parameters: rows,
          parameterCounts,
          pagination: {
            page,
            limit,
            totalRecords: total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
          aggregation: {
            interval: null,
            isAggregated: false,
          },
        },
        "Sensor data fetched successfully"
      )
    );
  });
}
