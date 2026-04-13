import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../api/authApi";
import { User, Lock, Save, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";

import { formatDate } from "../utils/dateTime";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Individual show/hide states for each password field
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  useEffect(() => {
    refreshUser();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      );
      setMessage({ type: "success", text: "Password changed successfully" });
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordFields(false);
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to change password",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-5 lg:py-6 space-y-4 sm:space-y-5 lg:space-y-6 overflow-x-hidden box-border">
      <header className="space-y-2 mb-4 sm:mb-5 lg:mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your account settings and preferences
        </p>
      </header>

      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/20 dark:bg-green-500/30 text-green-600 dark:text-green-400 border border-green-500/50"
              : "bg-destructive/20 text-destructive border border-destructive/50"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6 overflow-x-hidden box-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-semibold flex-shrink-0">
              {user?.username?.[0]?.toUpperCase() || <User className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Profile Information</h2>
              <p className="text-sm text-muted-foreground">Your account details</p>
            </div>
          </div>
          {user?.createdAt && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Account Created</p>
              <p className="text-sm font-medium text-foreground">{formatDate(user.createdAt)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Username
            </label>
            <input
              type="text"
              value={user?.username || ""}
              disabled
              className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Role
            </label>
            <input
              type="text"
              value={user?.role || ""}
              disabled
              className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Login Type
            </label>
            <input
              type="text"
              value={user?.loginType || ""}
              disabled
              className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6 overflow-x-hidden box-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
              <p className="text-sm text-muted-foreground">Update your account password</p>
            </div>
          </div>
          {!showPasswordFields && (
            <button
              onClick={() => setShowPasswordFields(true)}
              className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 border border-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordFields && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? "text" : "password"}
                  value={passwordForm.oldPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                  tabIndex={-1}
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter new password (min 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.newPassword &&
                passwordForm.confirmPassword &&
                passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Passwords do not match
                  </p>
                )}

            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : "Save Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordFields(false);
                  setPasswordForm({
                    oldPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setShowOldPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                  setMessage(null);
                }}

                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
