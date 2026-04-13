import axiosInstance from "./axiosInstance";
import { LoginFormData, RegisterFormData } from "../types/auth.types";

export const authApi = {
  register: async (data: RegisterFormData) => {
    const response = await axiosInstance.post("/users/register", data);
    return response.data;
  },

  login: async (data: LoginFormData) => {
    const response = await axiosInstance.post("/users/login", data);
    return response.data;
  },

  logout: async () => {
    const response = await axiosInstance.post("/users/logout");
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await axiosInstance.get("/users/me");
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await axiosInstance.post("/users/forgot-password", {
      email,
    });
    return response.data;
  },

  resetPassword: async (resetToken: string, newPassword: string) => {
    const response = await axiosInstance.post(
      `/users/reset-password/${resetToken}`,
      {
        newPassword,
      }
    );
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await axiosInstance.post("/users/change-password", {
      oldPassword,
      newPassword,
    });
    return response.data;
  },

  assignRole: async (userId: string, role: string) => {
    const response = await axiosInstance.post(`/users/${userId}`, { role });
    return response.data;
  },

  getAllUsers: async () => {
    const response = await axiosInstance.get("/users/all");
    return response.data;
  },

  deleteUser: async (userId: string) => {
    const response = await axiosInstance.delete(`/users/${userId}`);
    return response.data;
  },
};

