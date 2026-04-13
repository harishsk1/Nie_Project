import { useState, useEffect, useCallback } from "react";
import { deviceApi } from "../api/deviceApi";
import { Device } from "../types/device.types";

interface UseDevicesResult {
  devices: Device[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/**
 * Fetches and caches the full list of sensor devices.
 * Replaces duplicated `deviceApi.getAll()` calls across LiveGraphPage,
 * Dashboard, SensorPage, and DeviceList.
 */
export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await deviceApi.getAll();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { devices, loading, error, refetch };
}
