import {
  FaRobot,
  FaChartLine,
  FaDatabase,
  FaFileAlt,
} from "react-icons/fa";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: <FaRobot />,
    title: "Multi-Agent AI",
    desc: "Autonomous AI agents collaborate to complete complex data science tasks.",
    path: "/agents",
    button: "Open AI Agents",
  },

  {
    icon: <FaDatabase />,
    title: "Dataset Processing",
    desc: "Upload CSV files and automatically clean, preprocess and prepare data.",
    path: "/dataset",
    button: "Open Dataset",
  },

  {
    icon: <FaChartLine />,
    title: "ML Model Training",
    desc: "Train machine learning models with one click using intelligent automation.",
    path: "/agents",
    button: "Open ML Training",
  },

  {
    icon: <FaFileAlt />,
    title: "Auto Report",
    desc: "Generate professional PDF reports including charts, accuracy and insights.",
    path: "/reports",
    button: "Generate Report",
  },
];

function Features() {
  const navigate = useNavigate();

  return (
    <section
      id="features"
      className="relative py-24 bg-slate-950 text-white"
    >

      {/* ========================================= */}
      {/* HEADER */}
      {/* ========================================= */}

      <div className="max-w-7xl mx-auto px-8">

        <motion.div
          initial={{
            opacity: 0,
            y: 40,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
          }}
          transition={{
            duration: 0.7,
          }}
        >

          <h2 className="text-5xl font-bold text-center">

            Platform{" "}

            <span className="text-cyan-400">
              Features
            </span>

          </h2>


          <p className="text-center text-gray-400 mt-4 mb-16 text-lg">
            Everything required for an AI powered Data Science Platform.
          </p>

        </motion.div>


        {/* ========================================= */}
        {/* FEATURE CARDS */}
        {/* ========================================= */}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

          {features.map(
            (item, index) => (

              <motion.div
                key={index}

                initial={{
                  opacity: 0,
                  y: 50,
                }}

                whileInView={{
                  opacity: 1,
                  y: 0,
                }}

                viewport={{
                  once: true,
                }}

                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}

                whileHover={{
                  y: -10,
                  scale: 1.03,
                }}

                whileTap={{
                  scale: 0.97,
                }}

                onClick={() =>
                  navigate(item.path)
                }

                className="group cursor-pointer bg-slate-900 rounded-3xl p-8 border border-cyan-500/20 hover:border-cyan-400 transition-all duration-300 hover:shadow-[0_0_35px_rgba(6,182,212,0.18)]"
              >

                {/* ICON */}

                <motion.div
                  whileHover={{
                    scale: 1.15,
                    rotate: 5,
                  }}

                  className="text-5xl text-cyan-400 mb-6 transition"
                >
                  {item.icon}
                </motion.div>


                {/* TITLE */}

                <h3 className="text-2xl font-bold mb-4">
                  {item.title}
                </h3>


                {/* DESCRIPTION */}

                <p className="text-gray-400 leading-relaxed">
                  {item.desc}
                </p>


                {/* CLICK ACTION */}

                <div className="mt-7 flex items-center justify-between">

                  <span className="text-cyan-400 font-semibold group-hover:text-cyan-300">
                    {item.button}
                  </span>

                  <span className="text-cyan-400 text-xl transform group-hover:translate-x-2 transition">
                    →
                  </span>

                </div>

              </motion.div>

            )
          )}

        </div>


        {/* ========================================= */}
        {/* BOTTOM INFO */}
        {/* ========================================= */}

        <motion.div
          initial={{
            opacity: 0,
            y: 30,
          }}

          whileInView={{
            opacity: 1,
            y: 0,
          }}

          viewport={{
            once: true,
          }}

          className="mt-16 text-center"
        >

          <p className="text-gray-500">
            Click any feature to open its module →
          </p>

        </motion.div>

      </div>

    </section>
  );
}

export default Features;