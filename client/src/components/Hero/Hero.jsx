import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();

  const handleLearnMore = () => {
    const features =
      document.getElementById("features");

    if (features) {
      features.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">

      {/* ========================================= */}
      {/* BACKGROUND GLOW */}
      {/* ========================================= */}

      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-96 h-96 bg-cyan-500/20 blur-[140px] rounded-full top-20 left-20"
      />

      <motion.div
        animate={{
          scale: [1.15, 1, 1.15],
          opacity: [0.4, 0.25, 0.4],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-96 h-96 bg-blue-600/20 blur-[140px] rounded-full bottom-10 right-20"
      />


      {/* ========================================= */}
      {/* MAIN CONTAINER */}
      {/* ========================================= */}

      <div className="relative max-w-7xl mx-auto min-h-screen flex items-center px-8 grid lg:grid-cols-2 gap-16">


        {/* ========================================= */}
        {/* LEFT SIDE */}
        {/* ========================================= */}

        <motion.div
          initial={{
            opacity: 0,
            x: -80,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 1,
          }}
        >

          {/* BADGE */}

          <motion.span
            initial={{
              opacity: 0,
              y: -20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.2,
              duration: 0.6,
            }}
            className="inline-block border border-cyan-500 text-cyan-400 px-5 py-2 rounded-full"
          >
            🚀 AI Powered Data Science Platform
          </motion.span>


          {/* HEADING */}

          <h1 className="mt-8 text-6xl font-black leading-tight">

            Build Intelligent

            <span className="text-cyan-400">
              {" "}ML Models{" "}
            </span>

            with Autonomous AI

          </h1>


          {/* DESCRIPTION */}

          <p className="mt-8 text-gray-400 text-xl leading-9">

            NexusDS AI automates data cleaning,
            feature engineering, visualization,
            model training and report generation
            using intelligent AI agents.

          </p>


          {/* ========================================= */}
          {/* BUTTONS */}
          {/* ========================================= */}

          <div className="mt-10 flex gap-5 flex-wrap">


            {/* START ANALYSIS */}

            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow:
                  "0 0 30px rgba(6,182,212,0.5)",
              }}
              whileTap={{
                scale: 0.95,
              }}
              onClick={() =>
                navigate("/dataset")
              }
              className="bg-cyan-500 px-8 py-4 rounded-xl font-bold hover:bg-cyan-600 transition"
            >
              Start Analysis
            </motion.button>


            {/* LEARN MORE */}

            <motion.button
              whileHover={{
                scale: 1.05,
              }}
              whileTap={{
                scale: 0.95,
              }}
              onClick={handleLearnMore}
              className="border border-cyan-500 px-8 py-4 rounded-xl hover:bg-cyan-500 hover:text-white transition"
            >
              Learn More
            </motion.button>

          </div>

        </motion.div>


        {/* ========================================= */}
        {/* RIGHT SIDE - ORIGINAL ROBOT */}
        {/* ========================================= */}

        <motion.div
          className="flex justify-center"
          initial={{
            opacity: 0,
            scale: 0.4,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 0.9,
            type: "spring",
            stiffness: 140,
            damping: 12,
          }}
        >

          {/* ======================================= */}
          {/* ROBOT FLOAT */}
          {/* ======================================= */}

          <motion.div
            animate={{
              y: [-15, 15, -15],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >


            {/* ===================================== */}
            {/* GLOW */}
            {/* ===================================== */}

            <motion.div
              animate={{
                scale: [
                  1,
                  1.08,
                  1,
                ],

                opacity: [
                  0.5,
                  0.8,
                  0.5,
                ],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full bg-cyan-400/30 blur-3xl"
            />


            {/* ===================================== */}
            {/* ORIGINAL CIRCLE */}
            {/* ===================================== */}

            <motion.div
              animate={{
                boxShadow: [
                  "0 0 60px #06b6d4",
                  "0 0 100px #06b6d4",
                  "0 0 60px #06b6d4",
                ],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative w-80 h-80 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 flex items-center justify-center"
            >


              {/* ================================= */}
              {/* ORIGINAL ROBOT FACE */}
              {/* ================================= */}

              <motion.div
                animate={{
                  scale: [
                    1,
                    1.03,
                    1,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-56 h-56 rounded-full bg-slate-950 flex items-center justify-center text-8xl"
              >
                🤖
              </motion.div>

            </motion.div>


            {/* ===================================== */}
            {/* FLOATING PARTICLES */}
            {/* ===================================== */}

            <motion.div
              animate={{
                y: [-15, 15, -15],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              className="absolute -top-5 right-8 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_#06b6d4]"
            />


            <motion.div
              animate={{
                y: [15, -15, 15],
                opacity: [1, 0.3, 1],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
              }}
              className="absolute bottom-8 -left-6 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_15px_#67e8f9]"
            />


            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
              }}
              className="absolute top-1/2 -right-8 w-2 h-2 rounded-full bg-cyan-400"
            />

          </motion.div>

        </motion.div>

      </div>

    </section>
  );
}

export default Hero;