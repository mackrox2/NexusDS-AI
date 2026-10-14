import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowLeft, FaChartLine, FaLock } from "react-icons/fa";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const field =
    "w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400/60";

  async function sendResetLink(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Please enter your registered email address.");

      await sendPasswordResetEmail(auth, normalizedEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });

      setMessage(
        "If an account exists for this email, a password reset link has been sent. Please check your inbox and Spam folder."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      if (err?.code === "auth/user-not-found") {
        setMessage(
          "If an account exists for this email, a password reset link has been sent. Please check your inbox and Spam folder."
        );
      } else if (err?.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err?.code === "auth/too-many-requests") {
        setError("Too many reset requests. Please wait and try again later.");
      } else {
        setError(err?.message || "Could not send the password reset link. Please try again.");
      }
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

        <h1 className="text-3xl font-black">Forgot password?</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-400">
          Enter your registered email and we’ll send you a secure password reset link.
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            {message}
          </div>
        )}

        <form onSubmit={sendResetLink} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-300" htmlFor="email">
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
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-7 border-t border-white/10 pt-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300">
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
