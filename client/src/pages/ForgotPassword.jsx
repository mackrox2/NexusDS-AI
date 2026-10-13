import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaChartLine,
  FaLock,
} from "react-icons/fa";
import API from "../api/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const field =
    "w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/60";

  async function sendCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/forgot-password", {
        email: email.trim(),
      });

      setMessage(
        response.data?.message ||
          "If an account exists, a reset code has been sent."
      );

      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not send reset code. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit reset code.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const response = await API.post("/reset-password", {
        email: email.trim(),
        otp: otp.trim(),
        newPassword: password,
      });

      setMessage(
        response.data?.message ||
          "Password reset successful. You can now log in."
      );

      setPassword("");
      setConfirm("");
      setOtp("");

      // Navigate only after the API confirms success.
      navigate("/login", {
        state: { message: response.data?.message || "Password reset successful." },
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not reset password. Check the code and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/85 p-7 sm:p-9 shadow-2xl"
      >
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
            <FaChartLine />
          </div>

          <div>
            <div className="text-xl font-black">
              NexusDS <span className="text-cyan-300">AI</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Account recovery
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-black">
          {step === 1 ? "Forgot password?" : "Reset your password"}
        </h1>

        <p className="mb-6 mt-2 text-sm leading-6 text-slate-400">
          {step === 1
            ? "Enter your registered email to request a reset code."
            : "Enter the 6-digit code and choose a new password."}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200"
          >
            {message}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={sendCode} className="space-y-4">
            <label
              className="block text-sm font-semibold text-slate-300"
              htmlFor="email"
            >
              Email address
            </label>

            <input
              id="email"
              className={field}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <button
              disabled={busy}
              className="w-full rounded-xl bg-cyan-400 py-4 font-extrabold text-slate-950 disabled:opacity-60"
            >
              {busy ? "Sending..." : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-slate-300"
                htmlFor="otp"
              >
                6-digit reset code
              </label>

              <input
                id="otp"
                className={field}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-slate-300"
                htmlFor="new-password"
              >
                New password
              </label>

              <input
                id="new-password"
                className={field}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-slate-300"
                htmlFor="confirm-password"
              >
                Confirm new password
              </label>

              <input
                id="confirm-password"
                className={field}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            <button
              disabled={busy}
              className="w-full rounded-xl bg-cyan-400 py-4 font-extrabold text-slate-950 disabled:opacity-60"
            >
              {busy ? "Resetting..." : "Reset password"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp("");
                setError("");
                setMessage("");
              }}
              className="w-full text-sm text-cyan-300"
            >
              Back to email
            </button>
          </form>
        )}

        <div className="mt-7 border-t border-white/10 pt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300"
          >
            <FaArrowLeft />
            Back to login
          </Link>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
          <FaLock />
          Secure account recovery
        </div>
      </motion.div>
    </div>
  );
}