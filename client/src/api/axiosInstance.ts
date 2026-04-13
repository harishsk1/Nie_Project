import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosInstance,
} from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/constants";

let navigateCallback: ((path: string) => void) | null = null;

export const setNavigateCallback = (navigate: ReturnType<typeof useNavigate>) => {
  navigateCallback = navigate;
};

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axios.post(
          `${API_BASE_URL}/users/refresh`,
          {},
          { withCredentials: true }
        );
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        if (navigateCallback) {
          navigateCallback("/login");
        } else {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

