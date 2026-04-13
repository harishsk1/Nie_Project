import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { ROUTES } from "../utils/constants";
import { Eye, EyeOff } from "lucide-react";
import { validateEmail, validatePassword } from "../utils/helpers";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { login, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const identifier = formData.identifier.trim();
    const password = formData.password;

    if (!identifier) {
      nextErrors.identifier = "Username or email is required";
    } else if (identifier.includes("@") && !validateEmail(identifier)) {
      nextErrors.identifier = "Enter a valid email address";
    }

    const pass = validatePassword(password);
    if (!password) {
      nextErrors.password = "Password is required";
    } else if (!pass.valid) {
      nextErrors.password = pass.message;
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const identifier = formData.identifier.trim();
      const payload =
        identifier.includes("@")
          ? { email: identifier, password: formData.password }
          : { username: identifier, password: formData.password };
      await login(payload);
    } catch (err) {
      // Error handled by context
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8 lg:py-12 bg-background overflow-x-hidden box-border relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Welcome Back</h1>
          <p className="text-muted-foreground text-base sm:text-lg">Sign in to your account to continue</p>
        </div>

        <div className="bg-card rounded-lg p-4 sm:p-6 lg:p-8 shadow-lg border border-border w-full max-w-full box-border">
          {error && (
            <div className="mb-4 p-4 bg-destructive/20 border border-destructive/50 text-destructive rounded-lg text-sm">
              {error}
              <button onClick={clearError} className="ml-2 text-xs underline">
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Username or Email
              </label>
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="Enter username or email"
                autoComplete="username"
                className={`w-full px-4 py-2 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring ${fieldErrors.identifier ? "border-destructive" : "border-input"
                  }`}
                required
              />
              {fieldErrors.identifier && (
                <p className="mt-1 text-sm text-destructive">{fieldErrors.identifier}</p>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`w-full px-4 py-2 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring pr-10 ${fieldErrors.password ? "border-destructive" : "border-input"
                    }`}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <div className="text-right">
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm text-primary hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium py-2 rounded-lg transition-colors"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to={ROUTES.REGISTER}
              className="text-primary hover:text-primary/80 font-medium"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
