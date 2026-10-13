import { useState } from "react";

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

  FaStar,

} from "react-icons/fa";

import API from "../api/auth";



function Login() {

  const navigate = useNavigate();



  const [formData, setFormData] = useState({

    email: "",

    password: "",

  });

  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");



  const handleChange = (e) => {

    setFormData((prev) => ({

      ...prev,

      [e.target.name]: e.target.value,

    }));



    if (errorMessage) {

      setErrorMessage("");

    }

  };



  const handleSubmit = async (e) => {

    e.preventDefault();



    if (isSubmitting) return;



    setErrorMessage("");

    setIsSubmitting(true);



    try {

      const res = await API.post("/login", {

        email: formData.email.trim(),

        password: formData.password,

      });



      localStorage.setItem("token", res.data.token);

      localStorage.setItem("user", JSON.stringify(res.data.user));



      // Never carry another account's selected dataset into a new session.

      localStorage.removeItem("selectedDatasetId");

      localStorage.removeItem("selectedDatasetName");



      navigate("/dashboard");

    } catch (error) {

      setErrorMessage(

        error.response?.data?.detail ||

          error.response?.data?.message ||

          "Unable to login. Please check your credentials and try again."

      );

    } finally {

      setIsSubmitting(false);

    }

  };



  return (

    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">

      {/* Ambient background */}

      <div className="absolute inset-0 pointer-events-none">

        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-3xl" />

        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

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

        {/* Brand panel */}

        <div className="hidden lg:flex items-center justify-center px-12 xl:px-20">

          <motion.div

            initial={{ opacity: 0, x: -24 }}

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



            <h1 className="text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight">

              Turn raw data into

              <span className="block text-cyan-300">actionable intelligence.</span>

            </h1>



            <p className="mt-6 text-lg leading-8 text-slate-400 max-w-lg">

              Upload your data, let intelligent agents analyze it, train

              models, discover insights, and generate professional reports.

            </p>



            <div className="mt-10 space-y-4">

              {[

                "Universal file ingestion and structured conversion",

                "Automated analysis, ML recommendations and insights",

                "Professional PDF reporting with your real dataset",

              ].map((item) => (

                <div key={item} className="flex items-center gap-3 text-slate-300">

                  <FaCheckCircle className="text-cyan-300 shrink-0" />

                  <span>{item}</span>

                </div>

              ))}

            </div>



            <div className="mt-12 flex flex-wrap gap-3">

              {["Python", "FastAPI", "MongoDB", "AI Agents"].map((item) => (

                <span

                  key={item}

                  className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-400"

                >

                  {item}

                </span>

              ))}

            </div>

          </motion.div>

        </div>



        {/* Login panel */}

        <div className="flex items-center justify-center px-5 py-10 sm:px-8">

          <motion.div

            initial={{ opacity: 0, y: 22 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.5 }}

            className="w-full max-w-md"

          >

            {/* Mobile brand */}

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

              <div className="mb-8">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-300/15 text-cyan-300 text-xs font-semibold">

                  <FaStar />

                  Welcome back

                </div>



                <h2 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">

                  Sign in to NexusDS AI

                </h2>



                <p className="mt-2 text-sm leading-6 text-slate-400">

                  Continue to your autonomous data science workspace.

                </p>

              </div>



              {errorMessage && (

                <motion.div

                  initial={{ opacity: 0, y: -8 }}

                  animate={{ opacity: 1, y: 0 }}

                  className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"

                >

                  {errorMessage}

                </motion.div>

              )}



              <form onSubmit={handleSubmit} className="space-y-5">

                <div>

                  <label

                    htmlFor="email"

                    className="block mb-2 text-sm font-semibold text-slate-300"

                  >

                    Email address

                  </label>

                  <div className="relative">

                    <FaShieldAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

                    <input

                      id="email"

                      type="email"

                      name="email"

                      value={formData.email}

                      onChange={handleChange}

                      placeholder="you@example.com"

                      autoComplete="email"

                      required

                      className="w-full h-14 pl-11 pr-4 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"

                    />

                  </div>

                </div>



                <div>

                  <label

                    htmlFor="password"

                    className="block mb-2 text-sm font-semibold text-slate-300"

                  >

                    Password

                  </label>

                  <div className="relative">

                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

                    <input

                      id="password"

                      type={showPassword ? "text" : "password"}

                      name="password"

                      value={formData.password}

                      onChange={handleChange}

                      placeholder="Enter your password"

                      autoComplete="current-password"

                      required

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

                </div>

                <div className="flex justify-end -mt-2">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition"
                  >
                    Forgot password?
                  </Link>
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

                      Signing in...

                    </>

                  ) : (

                    <>

                      Sign in

                      <FaArrowRight className="text-sm" />

                    </>

                  )}

                </motion.button>

              </form>



              <div className="mt-7 pt-6 border-t border-white/10 text-center">

                <p className="text-sm text-slate-500">

                  Don't have an account?

                  <Link

                    to="/signup"

                    className="ml-2 font-bold text-cyan-300 hover:text-cyan-200 transition"

                  >

                    Create one

                  </Link>

                </p>

              </div>

            </div>



            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">

              <FaLock className="text-[10px]" />

              Secure authentication · NexusDS AI

            </div>

          </motion.div>

        </div>

      </div>

    </div>

  );

}



export default Login;
