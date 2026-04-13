export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const resolveLiveStreamUrl = () => {
  if (import.meta.env.VITE_LIVE_DATA_WS_URL) {
    return import.meta.env.VITE_LIVE_DATA_WS_URL;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
};

export const LIVE_DATA_WS_URL = resolveLiveStreamUrl();

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  CHANGE_PASSWORD: "/change-password",
  PROFILE: "/profile",
  VALIDATION_SAMPLE: "/validation-sample",
} as const;

export const USER_ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

