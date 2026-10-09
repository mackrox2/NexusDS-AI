import {
  FaRobot,
  FaDatabase,
  FaChartBar,
  FaFilePdf,
} from "react-icons/fa";

const agents = [
  {
    icon: <FaDatabase />,
    title: "Data Cleaning Agent",
    desc: "Automatically cleans missing values, duplicates and inconsistent datasets."
  },
  {
    icon: <FaChartBar />,
    title: "Visualization Agent",
    desc: "Creates charts, graphs and insights from uploaded datasets."
  },
  {
    icon: <FaRobot />,
    title: "ML Training Agent",
    desc: "Automatically trains machine learning models with optimized settings."
  },
  {
    icon: <FaFilePdf />,
    title: "Report Agent",
    desc: "Generates professional PDF reports with metrics and recommendations."
  }
];

function Agents() {
  return (
    <section className="bg-slate-950 py-24 text-white">

      <div className="max-w-7xl mx-auto px-8">

        <h2 className="text-5xl font-bold text-center">
          Autonomous AI Agents
        </h2>

        <p className="text-center text-gray-400 mt-4 mb-16">
          Multiple intelligent agents work together to automate your entire Data Science workflow.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

          {agents.map((agent, index) => (

            <div
              key={index}
              className="bg-slate-900 rounded-3xl p-8 border border-cyan-500/20 hover:border-cyan-400 hover:-translate-y-2 transition duration-300"
            >

              <div className="text-5xl text-cyan-400 mb-6">
                {agent.icon}
              </div>

              <h3 className="text-2xl font-bold mb-4">
                {agent.title}
              </h3>

              <p className="text-gray-400">
                {agent.desc}
              </p>

            </div>

          ))}

        </div>

      </div>

    </section>
  );
}

export default Agents;