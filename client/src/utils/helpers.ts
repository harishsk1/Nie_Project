import { formatDate as formatDateStandard } from "./dateTime";

export const formatDate = (dateString: string): string => {
  return formatDateStandard(dateString);
};

export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return "An unexpected error occurred";
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

export const validateUsername = (
  username: string
): { valid: boolean; message: string } => {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 25) {
    return {
      valid: false,
      message: "Username must be between 3 and 25 characters",
    };
  }
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  if (!alphanumericRegex.test(trimmed)) {
    return {
      valid: false,
      message: "Username must be alphanumeric",
    };
  }
  return { valid: true, message: "" };
};

export const validatePassword = (
  password: string
): { valid: boolean; message: string } => {
  if (!password) {
    return { valid: false, message: "Password is required" };
  }
  return { valid: true, message: "" };
};

export const validatePasswordStrength = (
  password: string
): { valid: boolean; message: string; missing: string[] } => {
  const missing: string[] = [];

  if (!password) {
    return { valid: false, message: "Password is required", missing: ["Password is required"] };
  }
  if (password.length < 8) missing.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) missing.push("an uppercase letter");
  if (!/[a-z]/.test(password)) missing.push("a lowercase letter");
  if (!/[0-9]/.test(password)) missing.push("a number");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) missing.push("a special character");

  if (missing.length > 0) {
    return {
      valid: false,
      message: `Password must include: ${missing.join(", ")}.`,
      missing,
    };
  }
  return { valid: true, message: "", missing: [] };
};
