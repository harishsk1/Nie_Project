import React, { useState, FormEvent } from "react";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  validateEmail,
  validateUsername,
  validatePasswordStrength,
} from "../utils/helpers";

// Per-criterion password rules for live checklist
const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper",  label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower",  label: "One lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number (0–9)", test: (p: string) => /[0-9]/.test(p) },
  { key: "special",label: "One special character (!@#$…)",    test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const ValidationSample = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [touched, setTouched]     = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm,  setShowConfirm]    = useState(false);
  const [success, setSuccess]     = useState(false);

  /* ── helpers ────────────────────────────────────────── */
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (success) setSuccess(false);
    // Only show error once the field has been touched
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Mark all as touched and validate all fields
    const allTouched: Record<string, boolean> = {};
    const newErrors: Record<string, string> = {};
    (Object.keys(formData) as (keyof typeof formData)[]).forEach(k => {
      allTouched[k] = true;
      const err = validateField(k, formData[k]);
      if (err) newErrors[k] = err;
    });
    setTouched(allTouched);
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setSuccess(true);
    }
  };

  /* ── live password checklist ────────────────────────── */
  const pw = formData.password;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10 gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl ring-1 ring-blue-500/20 mb-1">
          <ShieldCheck className="text-blue-400 w-7 h-7" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Advanced Validation</h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Real-time, criterion-level feedback for every field — enterprise-grade security UX.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/50 overflow-hidden">
        {/* Success Banner */}
        {success && (
          <div className="flex items-center gap-3 px-6 py-4 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={18} className="shrink-0" />
            <p className="text-sm font-medium">All fields validated — form is ready to submit!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">

          {/* ── Username ── */}
          <div className="space-y-1">
            <label htmlFor="username" className="block text-sm font-semibold text-slate-200">
              Username <span className="text-red-400">*</span>
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
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 border text-white placeholder:text-slate-500 text-sm outline-none transition-all duration-200 focus:ring-2 ${
                errors.username
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
            />
            {/* Error message */}
            {errors.username && touched.username && (
              <p className="flex items-start gap-1.5 text-red-400 text-xs mt-1">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {errors.username}
              </p>
            )}
            {/* Hint */}
            <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-1">
              <Info size={11} />
              Use 3–25 alphanumeric characters only (letters and numbers, no spaces or symbols).
            </p>
          </div>

          {/* ── Email ── */}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-200">
              Email Address <span className="text-red-400">*</span>
            </label>
            {/* IMPORTANT: type="text" so React validation fires and the error renders */}
            <input
              id="email"
              type="text"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter your email"
              autoComplete="email"
              inputMode="email"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 border text-white placeholder:text-slate-500 text-sm outline-none transition-all duration-200 focus:ring-2 ${
                errors.email
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
            />
            {/* Error message — always rendered when present */}
            {errors.email && touched.email && (
              <p className="flex items-start gap-1.5 text-red-400 text-xs mt-1">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {errors.email}
              </p>
            )}
            {/* Hint */}
            <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-1">
              <Info size={11} />
              Enter a valid email (e.g. you@example.com). It will be stored in lowercase.
            </p>
          </div>

          {/* ── Password ── */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-200">
              Password <span className="text-red-400">*</span>
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
                className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-800 border text-white placeholder:text-slate-500 text-sm outline-none transition-all duration-200 focus:ring-2 ${
                  errors.password
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {/* Granular error message */}
            {errors.password && touched.password && (
              <p className="flex items-start gap-1.5 text-red-400 text-xs mt-1">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {errors.password}
              </p>
            )}

            {/* Live criterion checklist */}
            {(touched.password || pw) && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map(rule => {
                  const pass = rule.test(pw);
                  return (
                    <li key={rule.key} className={`flex items-center gap-2 text-[11px] transition-colors ${pass ? "text-emerald-400" : "text-slate-500"}`}>
                      <CheckCircle2 size={12} className={pass ? "text-emerald-400" : "text-slate-600"} />
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Hint always visible */}
            <p className="text-slate-500 text-[11px] flex items-start gap-1 mt-2">
              <Info size={11} className="shrink-0 mt-0.5" />
              Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.
            </p>
          </div>

          {/* ── Confirm Password ── */}
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-200">
              Confirm Password <span className="text-red-400">*</span>
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
                className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-800 border text-white placeholder:text-slate-500 text-sm outline-none transition-all duration-200 focus:ring-2 ${
                  errors.confirmPassword
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {errors.confirmPassword && touched.confirmPassword && (
              <p className="flex items-start gap-1.5 text-red-400 text-xs mt-1">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {errors.confirmPassword}
              </p>
            )}
            <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-1">
              <Info size={11} />
              Must exactly match the password entered above.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 mt-1"
          >
            Validate &amp; Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default ValidationSample;
