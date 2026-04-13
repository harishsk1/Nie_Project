import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "USER" | "ADMIN";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

