import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowRight, FaChartLine, FaCheckCircle } from "react-icons/fa";

export default function VerifyEmail() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" /><div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" /></div>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-300/20"><FaChartLine className="text-2xl text-cyan-300" /></div>
        <h1 className="text-2xl font-black">NexusDS <span className="text-cyan-300">AI</span></h1>
        <div className="mx-auto my-7 flex h-14 w-14 items-center justify-center"><FaCheckCircle className="text-5xl text-cyan-300" /></div>
        <h2 className="text-xl font-bold">Verify your email</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">NexusDS AI verifies new accounts with a 6-digit code. Enter the code sent to your email on the signup screen to activate your account.</p>
        <Link to="/signup" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-extrabold text-slate-950 hover:bg-cyan-300">Go to Sign Up <FaArrowRight className="text-sm" /></Link>
        <Link to="/login" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-bold hover:bg-white/10">Back to Sign In</Link>
      </motion.div>
    </div>
  );
}
