import axiosInstance from "./axiosInstance";
import { Device, DeviceFormData } from "../types/device.types";

const BASE_PATH = "/devices";

export interface DeviceParameter {
  name: string;
  unit: string;
}

export interface DeviceParameterPayload {
  name: string;
  unit: string;
}

export const deviceApi = {
  async getAll(): Promise<Device[]> {
    const { data } = await axiosInstance.get(BASE_PATH);
    // Handle ApiResponse format: { statusCode, data, message }
    return Array.isArray(data) ? data : (data?.data || data || []);
  },

  async create(payload: DeviceFormData): Promise<Device> {
    const { data } = await axiosInstance.post(BASE_PATH, payload);
    // Handle ApiResponse format
    return data?.data || data;
  },

  async update(id: number, payload: DeviceFormData): Promise<Device> {
    const { data } = await axiosInstance.put(
      `${BASE_PATH}/${id}`,
      payload
    );
    // Handle ApiResponse format
    return data?.data || data;
  },

  async delete(id: number): Promise<void> {
    await axiosInstance.delete(`${BASE_PATH}/${id}`);
  },

  async getParameters(deviceId: number): Promise<DeviceParameter[]> {
    const { data } = await axiosInstance.get(`${BASE_PATH}/${deviceId}/parameters`);
    return data?.data || data || [];
  },

  async addParameter(deviceId: number, payload: DeviceParameterPayload): Promise<DeviceParameter> {
    const { data } = await axiosInstance.post(`${BASE_PATH}/${deviceId}/parameters`, payload);
    return data?.data || data;
  },

  async removeParameter(deviceId: number, name: string, unit: string): Promise<void> {
    await axiosInstance.delete(`${BASE_PATH}/${deviceId}/parameters`, {
      params: { name, unit },
    });
  },

  /** Fetch distinct parameters for a device looked up by name */
  async getParametersByDeviceName(deviceName: string): Promise<DeviceParameter[]> {
    const all = await deviceApi.getAll();
    const device = all.find(d => d.name === deviceName);
    if (!device) return [];
    return deviceApi.getParameters(device.id);
  },
};
