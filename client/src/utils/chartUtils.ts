// Chart utilities shared across graph pages

export const CHART_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1",
  "#d084d0", "#ffb347", "#87ceeb", "#98fb98", "#f0e68c",
];

export interface ChartDataPoint {
  date: number;
  value: number;
}

/**
 * Aggregates a sorted array of data points into fixed-size time buckets,
 * averaging values that fall within each bucket.
 * Uses reduce instead of Math.min/max spread to avoid RangeError on large arrays.
 */
export function aggregateDataIntoBuckets(
  data: ChartDataPoint[],
  bucketSizeSeconds: number
): ChartDataPoint[] {
  if (data.length === 0) return [];

  const sorted = [...data].sort((a, b) => a.date - b.date);
  const bucketSizeMs = bucketSizeSeconds * 1000;
  const buckets = new Map<number, number[]>();

  sorted.forEach((point) => {
    const key = Math.floor(point.date / bucketSizeMs) * bucketSizeMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(point.value);
  });

  const result: ChartDataPoint[] = [];
  buckets.forEach((values, key) => {
    if (values.length > 0) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      result.push({ date: Math.floor(key), value: avg });
    }
  });

  return result.sort((a, b) => a.date - b.date);
}

/** Safely compute min over an array (avoids spread RangeError on large arrays). */
export function safeMin(values: number[], fallback = 0): number {
  return values.length > 0
    ? values.reduce((a, b) => (a < b ? a : b), values[0])
    : fallback;
}

/** Safely compute max over an array (avoids spread RangeError on large arrays). */
export function safeMax(values: number[], fallback = 100): number {
  return values.length > 0
    ? values.reduce((a, b) => (a > b ? a : b), values[0])
    : fallback;
}
