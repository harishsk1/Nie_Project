import React, { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { ROUTES } from "../utils/constants";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Info } from "lucide-react";
import {
  validateEmail,
  validatePasswordStrength,
  validateUsername,
} from "../utils/helpers";

// Live checklist rules for password field
const PASSWORD_RULES = [
  { key: "length",  label: "At least 8 characters",          test: (p: string) => p.length >= 8 },
  { key: "upper",   label: "One uppercase letter (A–Z)",      test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower",   label: "One lowercase letter (a–z)",      test: (p: string) => /[a-z]/.test(p) },
  { key: "number",  label: "One number (0–9)",                test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$…)",   test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched]         = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  /* ── per-field validation ────────────────────────── */
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "username": {
        const res = validateUsername(value);
        return res.valid ? "" : res.message;
      }
      case "email": {
        if (!value.trim()) return "Email is required.";
        if (!validateEmail(value)) return "Please enter a valid email address (e.g. user@example.com).";
        return "";
      }
      case "password": {
        const res = validatePasswordStrength(value);
        return res.valid ? "" : res.message;
      }
      case "confirmPassword": {
        if (!value) return "Please confirm your password.";
        if (value !== formData.password) return "Passwords do not match.";
        return "";
      }
      default: return "";
    }
  };

  /* ── live change handler — validates only touched fields ── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearError();
    if (touched[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  /* ── blur handler — marks field as touched ── */
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  /* ── submit — validates all fields at once ── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    const allTouched: Record<string, boolean>  = {};
    const nextErrors: Record<string, string>   = {};

    (Object.keys(formData) as (keyof typeof formData)[]).forEach(key => {
      allTouched[key] = true;
      const err = validateField(key, formData[key]);
      if (err) nextErrors[key] = err;
    });

    setTouched(allTouched);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      await register({
        username: formData.username.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      navigate(ROUTES.LOGIN);
    } catch {
      /* error surfaced via context `error` state */
    } finally {
      setIsLoading(false);
    }
  };

  const pw = formData.password;

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8 lg:py-12 bg-background overflow-x-hidden relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md mx-auto">

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground text-base sm:text-lg">Sign up to get started</p>
        </div>

        <div className="bg-card rounded-lg p-4 sm:p-6 lg:p-8 shadow-lg border border-border w-full max-w-full box-border">

          {/* Server-side / API error */}
          {error && (
            <div className="mb-5 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* ── Username ── */}
            <div className="space-y-1">
              <label htmlFor="username" className="block text-sm font-medium text-foreground">
                Username <span className="text-destructive">*</span>
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your username"
                autoComplete="username"
                className={`w-full px-4 py-2 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.username
                    ? "border-destructive focus:ring-destructive/20"
                    : "border-input focus:border-primary focus:ring-ring"
                }`}
              />
              {fieldErrors.username && touched.username && (
                <p className="flex items-start gap-1.5 text-destructive text-xs mt-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {fieldErrors.username}
                </p>
              )}
              <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-1">
                <Info size={11} />
                3–25 characters, letters and numbers only. No spaces or symbols.
              </p>
            </div>

            {/* ── Email ── */}
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="text"
                inputMode="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your email"
                autoComplete="email"
                className={`w-full px-4 py-2 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.email
                    ? "border-destructive focus:ring-destructive/20"
                    : "border-input focus:border-primary focus:ring-ring"
                }`}
              />
              {fieldErrors.email && touched.email && (
                <p className="flex items-start gap-1.5 text-destructive text-xs mt-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {fieldErrors.email}
                </p>
              )}
              <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-1">
                <Info size={11} />
                Enter a valid email address (e.g. you@example.com). Stored in lowercase.
              </p>
            </div>

            {/* ── Password ── */}
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  className={`w-full px-4 py-2 pr-11 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.password
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-input focus:border-primary focus:ring-ring"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Granular error — lists exactly which rules are failing */}
              {fieldErrors.password && touched.password && (
                <p className="flex items-start gap-1.5 text-destructive text-xs mt-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {fieldErrors.password}
                </p>
              )}

              {/* Live checklist — visible once the user starts typing */}
              {(touched.password || pw.length > 0) && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map(rule => {
                    const passed = rule.test(pw);
                    return (
                      <li
                        key={rule.key}
                        className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${
                          passed ? "text-green-500" : "text-muted-foreground"
                        }`}
                      >
                        <CheckCircle2
                          size={12}
                          className={passed ? "text-green-500" : "text-muted-foreground/80"}
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Static hint always visible */}
              <p className="text-muted-foreground text-[11px] flex items-start gap-1 mt-2">
                <Info size={11} className="shrink-0 mt-0.5" />
                Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.
              </p>
            </div>

            {/* ── Confirm Password ── */}
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                Confirm Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`w-full px-4 py-2 pr-11 bg-background border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.confirmPassword
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-input focus:border-primary focus:ring-ring"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && touched.confirmPassword && (
                <p className="flex items-start gap-1.5 text-destructive text-xs mt-1">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
              <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-1">
                <Info size={11} />
                Must exactly match the password entered above.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium py-2 rounded-lg transition-colors"
            >
              {isLoading ? "Creating account…" : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={ROUTES.LOGIN} className="text-primary hover:text-primary/80 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
