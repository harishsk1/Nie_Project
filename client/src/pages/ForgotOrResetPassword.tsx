
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/authApi";
import { ROUTES } from "../utils/constants";
import { ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";

const ForgotOrResetPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "reset">("email"); // step control
  const [email, setEmail] = useState("");
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle email submission
  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) return setError("Email is required");

    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
      setTimeout(() => {
        // Automatically show reset form
        setStep("reset");
        setSuccess(false);
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reset password submission
  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const { oldPassword, newPassword } = formData;

    if (!oldPassword || !newPassword) {
      setError("Both fields are required");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword("dummy-token", newPassword); // update token logic if backend requires
      setSuccess(true);

      setTimeout(() => {
        navigate(ROUTES.LOGIN);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            {step === "email" ? "Forgot Password" : "Reset Password"}
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            {step === "email"
              ? "Enter your email to receive a reset link"
              : "Enter your old and new password"}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 sm:p-8 shadow-lg border border-slate-700">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!success && (
            <form
              onSubmit={step === "email" ? handleForgot : handleReset}
              className="space-y-4"
            >
              {step === "email" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <>
                  {/* Old Password */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Old Password
                    </label>
                    <input
                      type={showPassword.old ? "text" : "password"}
                      name="oldPassword"
                      value={formData.oldPassword}
                      onChange={handleChange}
                      placeholder="Enter old password"
                      className="w-full px-4 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((prev) => ({
                          ...prev,
                          old: !prev.old,
                        }))
                      }
                      className="absolute right-3 top-8 text-slate-400 hover:text-white"
                    >
                      {showPassword.old ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  {/* New Password */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      New Password
                    </label>
                    <input
                      type={showPassword.new ? "text" : "password"}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Enter new password"
                      className="w-full px-4 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((prev) => ({
                          ...prev,
                          new: !prev.new,
                        }))
                      }
                      className="absolute right-3 top-8 text-slate-400 hover:text-white"
                    >
                      {showPassword.new ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {isLoading
                  ? step === "email"
                    ? "Sending..."
                    : "Resetting..."
                  : step === "email"
                    ? "Send Reset Link"
                    : "Reset Password"}
              </button>
            </form>
          )}

          {success && step === "reset" && (
            <p className="text-green-400 text-center mt-4">
              Password reset successful! Redirecting...
            </p>
          )}

          <div className="mt-6 text-center">
            <Link
              to={ROUTES.LOGIN}
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotOrResetPassword;
