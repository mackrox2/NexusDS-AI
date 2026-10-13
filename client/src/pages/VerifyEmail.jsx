import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCheckCircle, FaExclamationCircle, FaChartLine } from "react-icons/fa";
import API from "../api/auth";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    let active = true;
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing or invalid.");
      return () => { active = false; };
    }
    API.post("/verify-email-link", { token })
      .then((response) => {
        if (!active) return;
        setStatus("success");
        setMessage(response.data?.message || "Email verified successfully. You can now sign in.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error.response?.data?.detail || "This verification link is invalid, expired, or already used.");
      });
    return () => { active = false; };
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><FaChartLine size={24} /></div>
        <h1 className="text-2xl font-black">NexusDS <span className="text-cyan-300">AI</span></h1>
        <div className="mx-auto my-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          {status === "loading" ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-300" /> : status === "success" ? <FaCheckCircle className="text-2xl text-emerald-400" /> : <FaExclamationCircle className="text-2xl text-red-400" />}
        </div>
        <h2 className="text-xl font-bold">{status === "loading" ? "Verifying email" : status === "success" ? "Email verified" : "Verification failed"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        {status !== "loading" && <Link to="/login" className="mt-7 inline-flex items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">Continue to Sign In</Link>}
      </motion.div>
    </div>
  );
}
