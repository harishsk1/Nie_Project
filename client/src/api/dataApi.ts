import axiosInstance from "./axiosInstance";

// Time interval options for aggregation
export type TimeInterval = "1m" | "30m" | "1h" | "12h" | "1d" | "1M";

export interface SensorQueryParams {
  page?: number;
  limit?: number;
  names?: string[];
  from?: string;
  to?: string;
  interval?: TimeInterval;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

export interface AggregationInfo {
  interval: TimeInterval | null;
  isAggregated: boolean;
}

export interface SensorDataResponse {
  parameters: any[];
  /** Per-parameter record counts keyed by parameter name */
  parameterCounts?: Record<string, number>;
  pagination: PaginationInfo;
  aggregation?: AggregationInfo;
}

export const dataApi = {
  async fetchSensorData(device: string, params: SensorQueryParams = {}): Promise<SensorDataResponse> {
    const { page, limit, names, from, to, interval } = params;
    const qs = new URLSearchParams();

    if (page) qs.append("page", String(page));
    if (limit) qs.append("limit", String(limit));

    if (names && names.length) {
      names.forEach((name) => qs.append("name", name));
    }
    if (from) qs.append("from", from);
    if (to) qs.append("to", to);
    if (interval) qs.append("interval", interval);

    const url = qs.toString()
      ? `/data/${encodeURIComponent(device)}?${qs.toString()}`
      : `/data/${encodeURIComponent(device)}`;

    const { data } = await axiosInstance.get(url);
    // Handle ApiResponse format: { statusCode, data, message }
    if (data?.data) {
      return data.data;
    }
    return data;
  },
};

