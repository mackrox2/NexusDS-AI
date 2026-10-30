import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaArrowRight,
  FaChartLine,
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaShieldAlt,
  FaUser,
} from "react-icons/fa";
import API from "../api/auth";

export default function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [step, setStep] = useState("register");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpMessage, setOtpMessage] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage("");
    setOtpMessage("");

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (name.length < 2) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await API.post("/register", { name, email, password });
      setFormData((prev) => ({ ...prev, name, email }));
      setStep("otp");
      setOtp("");
      setResendCooldown(60);
      setOtpMessage(
        response.data?.message ||
          "A 6-digit verification code has been sent to your email."
      );
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to create your account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage("");
    setOtpMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await API.post("/verify-email", {
        email: formData.email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      setStep("verified");
      setOtpMessage(
        response.data?.message ||
          "Verification Complete! Your account is now active."
      );
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.detail ||
          "OTP verification failed. Please check the code and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (isSubmitting || resendCooldown > 0) return;

    setErrorMessage("");
    setOtpMessage("");
    setIsSubmitting(true);
    try {
      const response = await API.post("/resend-otp", {
        email: formData.email.trim().toLowerCase(),
      });
      setResendCooldown(60);
      setOtpMessage(response.data?.message || "A new OTP has been sent.");
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.detail || "Unable to resend OTP. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full h-14 pl-11 pr-4 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10";

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative min-h-screen grid lg:grid-cols-2">
        <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:order-1">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="h-11 w-11 rounded-2xl bg-cyan-400/10 border border-cyan-300/20 flex items-center justify-center">
                <FaChartLine className="text-cyan-300" />
              </div>
              <div>
                <div className="text-lg font-black">
                  NexusDS <span className="text-cyan-300">AI</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Data Science Platform
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 backdrop-blur-2xl shadow-2xl shadow-black/30 p-7 sm:p-9">
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-300/15 text-cyan-300 text-xs font-semibold">
                  {step === "verified" ? <FaCheckCircle /> : <FaUser />}
                  {step === "register"
                    ? "Get started"
                    : step === "otp"
                      ? "Email verification"
                      : "Account activated"}
                </div>

                <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
                  {step === "register"
                    ? "Create your account"
                    : step === "otp"
                      ? "Verify your email"
                      : "Verification Complete!"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {step === "register" &&
                    "Build your workspace and start turning data into intelligence."}
                  {step === "otp" &&
                    `Enter the 6-digit code sent to ${formData.email}.`}
                  {step === "verified" &&
                    "Your account is now active. You can sign in and start using NexusDS AI."}
                </p>
              </div>

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {errorMessage}
                </motion.div>
              )}

              {otpMessage && step !== "verified" && (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200"
                >
                  {otpMessage}
                </div>
              )}

              {step === "register" && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block mb-2 text-sm font-semibold text-slate-300">
                      Full name
                    </label>
                    <div className="relative">
                      <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="name"
                        type="text"
                        name="name"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={handleChange}
                        autoComplete="name"
                        required
                        minLength={2}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block mb-2 text-sm font-semibold text-slate-300">
                      Email address
                    </label>
                    <div className="relative">
                      <FaShieldAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block mb-2 text-sm font-semibold text-slate-300">
                      Password
                    </label>
                    <div className="relative">
                      <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Minimum 6 characters"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="w-full h-14 pl-11 pr-12 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-white/5 transition"
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${formData.password.length >= 6 ? "bg-cyan-400" : "bg-slate-700"}`}
                      />
                      At least 6 characters required
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-xl bg-cyan-400 text-slate-950 font-extrabold text-base shadow-lg shadow-cyan-500/10 hover:bg-cyan-300 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-5 w-5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        Create account <FaArrowRight className="text-sm" />
                      </>
                    )}
                  </motion.button>
                </form>
              )}

              {step === "otp" && (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div>
                    <label htmlFor="otp" className="block mb-2 text-sm font-semibold text-slate-300">
                      6-digit verification code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                        if (errorMessage) setErrorMessage("");
                      }}
                      placeholder="Enter OTP"
                      required
                      className="w-full h-14 px-4 rounded-xl bg-slate-950/70 border border-white/10 text-white tracking-[0.4em] text-center text-xl outline-none focus:border-cyan-400/60"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otp.length !== 6}
                    className="w-full h-14 rounded-xl bg-cyan-400 text-slate-950 font-extrabold disabled:opacity-60"
                  >
                    {isSubmitting ? "Verifying..." : "Verify OTP"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isSubmitting || resendCooldown > 0}
                    className="w-full text-sm font-bold text-cyan-300 disabled:text-slate-500"
                  >
                    {resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : "Resend OTP"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("register");
                      setOtp("");
                      setOtpMessage("");
                      setErrorMessage("");
                    }}
                    className="w-full text-xs text-slate-500 hover:text-slate-300"
                  >
                    Back to signup
                  </button>
                </form>
              )}

              {step === "verified" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-6 text-center">
                    <FaCheckCircle className="mx-auto mb-3 text-5xl text-cyan-300" />
                    <p className="font-bold text-cyan-100">Verification Complete!</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {otpMessage || "Your account is now active."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="w-full h-14 rounded-xl bg-cyan-400 text-slate-950 font-extrabold hover:bg-cyan-300 transition"
                  >
                    Continue to Login <FaArrowRight className="inline ml-2" />
                  </button>
                </div>
              )}

              {step !== "verified" && (
                <div className="mt-7 pt-6 border-t border-white/10 text-center">
                  <p className="text-sm text-slate-500">
                    Already have an account?
                    <Link to="/login" className="ml-2 font-bold text-cyan-300 hover:text-cyan-200 transition">
                      Sign in
                    </Link>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
              <FaLock className="text-[10px]" />
              Secure account creation · NexusDS AI
            </div>
          </motion.div>
        </div>

        <div className="hidden lg:flex items-center justify-center px-12 xl:px-20 lg:order-2">
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-cyan-400/10 border border-cyan-300/20 flex items-center justify-center">
                <FaChartLine className="text-cyan-300 text-xl" />
              </div>
              <div>
                <div className="text-xl font-black tracking-tight">
                  NexusDS <span className="text-cyan-300">AI</span>
                </div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Autonomous Data Science
                </div>
              </div>
            </div>

            <h2 className="text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight">
              Your data.
              <span className="block text-cyan-300">Your intelligence.</span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-400 max-w-lg">
              Create your workspace and let NexusDS AI handle the repetitive work of modern data science.
            </p>

            <div className="mt-10 space-y-4">
              {[
                "Upload and structure data from multiple file formats",
                "Run automated analysis and machine learning workflows",
                "Generate insights and professional data reports",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-slate-300">
                  <FaCheckCircle className="text-cyan-300 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                  <FaLock className="text-cyan-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Built for your data workflow</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Authentication and workspace access are handled securely.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
