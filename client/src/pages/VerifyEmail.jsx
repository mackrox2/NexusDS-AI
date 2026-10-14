import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FaChartLine, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { applyActionCode, checkActionCode, signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    const verifyEmail = async () => {
      const mode = params.get("mode");
      const oobCode = params.get("oobCode");
      if (mode !== "verifyEmail" || !oobCode) {
        setStatus("error");
        setMessage("This verification link is missing, invalid, or expired.");
        return;
      }
      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        if (auth.currentUser) await auth.currentUser.reload();
        await signOut(auth).catch(() => {});
        setStatus("success");
        setMessage("Your email has been verified successfully. You can now sign in to NexusDS AI.");
      } catch (error) {
        console.error("Email verification error:", error);
        if (error?.code === "auth/expired-action-code") setMessage("This verification link has expired. Please request a new verification email.");
        else if (error?.code === "auth/invalid-action-code") setMessage("This verification link is invalid or has already been used.");
        else setMessage("We could not verify your email. Please request a new verification link.");
        setStatus("error");
      }
    };
    verifyEmail();
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"/><div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl"/></div>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-300/20"><FaChartLine className="text-2xl text-cyan-300"/></div>
        <h1 className="text-2xl font-black">NexusDS <span className="text-cyan-300">AI</span></h1>
        <div className="mx-auto my-7 flex h-14 w-14 items-center justify-center">{status==="loading"?<span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300"/>:status==="success"?<FaCheckCircle className="text-5xl text-emerald-400"/>:<FaExclamationCircle className="text-5xl text-red-400"/>}</div>
        <h2 className="text-xl font-bold">{status==="loading"?"Verifying your email":status==="success"?"Email verified successfully":"Verification failed"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        {status==="success"&&<Link to="/login" className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 font-extrabold text-slate-950 hover:bg-cyan-300">Continue to Sign In</Link>}
        {status==="error"&&<Link to="/login" className="mt-7 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-bold hover:bg-white/10">Back to Sign In</Link>}
      </motion.div>
    </div>
  );
}
