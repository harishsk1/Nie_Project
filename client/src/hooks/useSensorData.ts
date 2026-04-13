import { useState, useEffect, useCallback, useRef } from "react";
import { dataApi, SensorQueryParams, SensorDataResponse } from "../api/dataApi";

interface UseSensorDataResult {
  data: SensorDataResponse | null;
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/**
 * Wraps dataApi.fetchSensorData with standard loading / error / data state.
 * Re-fetches automatically when `device` or `params` change.
 * Uses a ref to avoid stale-closure issues on params.
 */
export function useSensorData(
  device: string,
  params: SensorQueryParams = {}
): UseSensorDataResult {
  const [data, setData] = useState<SensorDataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  // Stable params reference to avoid spurious re-runs
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const refetch = useCallback(async () => {
    if (!device) return;
    try {
      setLoading(true);
      setError("");
      const result = await dataApi.fetchSensorData(device, paramsRef.current);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sensor data");
    } finally {
      setLoading(false);
    }
  }, [device]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
