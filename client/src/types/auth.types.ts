export interface User {
  id: string;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
  isEmailVerified: boolean;
  loginType: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginFormData {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  username: string;
  password: string;
  role?: "USER" | "ADMIN";
}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = any> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}
