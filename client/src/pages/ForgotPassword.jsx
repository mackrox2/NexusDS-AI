import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowLeft, FaChartLine, FaLock } from "react-icons/fa";
import API from "../api/auth";

export default function ForgotPassword() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const field =
    "w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/60";

  async function sendOTP(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error("Please enter your registered email address.");
      }

      await API.post("/forgot-password", {
        email: normalizedEmail,
      });

      setEmail(normalizedEmail);
      setStep("otp");
      setMessage("If an account exists, a 6-digit OTP has been sent to your email.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        "Could not send OTP. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!/^\d{6}$/.test(otp)) {
        throw new Error("Please enter a valid 6-digit OTP.");
      }

      if (newPassword.length < 6) {
        throw new Error("Password must contain at least 6 characters.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await API.post("/reset-password", {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });

      setMessage("Password reset successful! You can now login with your new password.");
      setStep("success");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        "Password reset failed. Please try again."
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
          {step === "success" ? "Password updated!" : "Forgot password?"}
        </h1>

        <p className="mb-6 mt-2 text-sm leading-6 text-slate-400">
          {step === "email" &&
            "Enter your registered email. We'll send you a secure 6-digit OTP."}

          {step === "otp" &&
            `Enter the OTP sent to ${email} and create your new password.`}

          {step === "success" &&
            "Your password has been changed successfully. You can now access your account."}
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

        {step === "email" && (
          <form onSubmit={sendOTP} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">
              Email address
            </label>

            <input
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
              {busy ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                6-digit OTP
              </label>

              <input
                className={field}
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter OTP"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                New password
              </label>

              <input
                className={field}
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Confirm new password
              </label>

              <input
                className={field}
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <button
              disabled={busy}
              className="w-full rounded-xl bg-cyan-400 py-4 font-extrabold text-slate-950 disabled:opacity-60"
            >
              {busy ? "Updating password..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
                setMessage("");
              }}
              className="w-full text-sm font-semibold text-cyan-300"
            >
              Change email address
            </button>
          </form>
        )}

        {step === "success" && (
          <Link
            to="/login"
            className="block w-full rounded-xl bg-cyan-400 py-4 text-center font-extrabold text-slate-950"
          >
            Continue to Login
          </Link>
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