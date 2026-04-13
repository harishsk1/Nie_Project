export interface Device {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceFormData {
  name: string;
}
