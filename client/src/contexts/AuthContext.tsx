import {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { User, LoginFormData, RegisterFormData } from "../types/auth.types";
import { authApi } from "../api/authApi";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!isInitialMount.current) return;

    const checkAuth = async () => {
      try {
        const response = await authApi.getCurrentUser();
        setUser(response.data);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };

    checkAuth();
  }, []);

  const register = async (data: RegisterFormData) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authApi.register(data);
      setUser(response.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Registration failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginFormData) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authApi.login(data);
      setUser(response.data.user);
      navigate("/dashboard");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Login failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      navigate("/login");
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      setUser(response.data);
    } catch (err) {
      console.error("Error refreshing user:", err);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

