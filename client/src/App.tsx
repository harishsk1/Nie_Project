import React, { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layout/DashboardLayout";
import { setNavigateCallback } from "./api/axiosInstance";

import LoginForm from "./pages/LoginForm";
import RegisterForm from "./pages/RegisterForm";
import ForgotOrResetPassword from "./pages/ForgotOrResetPassword";
import Dashboard from "./pages/Dashboard";
import SensorPage from "./pages/SensorPage";

import LiveDataPage from "./pages/LiveDataPage";
import LiveGraphPage from "./pages/LiveGraphPage";
import RecordedBarChart from "./pages/RecordedBarChart";
import Reports from "./pages/Reports";
import DeviceList from "./components/DeviceList";
import { ROUTES } from "./utils/constants";

import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import ValidationSample from "./pages/ValidationSample";

const DashboardShell = () => (
  <ProtectedRoute>
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  </ProtectedRoute>
);

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigateCallback(navigate);
  }, [navigate]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path={ROUTES.LOGIN} element={<LoginForm />} />
          <Route path={ROUTES.REGISTER} element={<RegisterForm />} />
          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={<ForgotOrResetPassword />}
          />
          <Route
            path={`${ROUTES.RESET_PASSWORD}/:resetToken`}
            element={<ForgotOrResetPassword />}
          />

          <Route
            path={ROUTES.VALIDATION_SAMPLE}
            element={<ValidationSample />}
          />

          {/* Protected dashboard */}
          <Route element={<DashboardShell />}>
            <Route
              path="/"
              element={<Navigate to={ROUTES.DASHBOARD} replace />}
            />
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
            <Route path="/live-data" element={<LiveDataPage />} />
            <Route path="/live-graph" element={<LiveGraphPage />} />
            <Route path="/sensor" element={<SensorPage />} />

            <Route path="/bar-chart" element={<RecordedBarChart />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/devices" element={<DeviceList />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

