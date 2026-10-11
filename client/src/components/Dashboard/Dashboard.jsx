import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaDatabase,
  FaRobot,
  FaChartLine,
  FaFilePdf,
  FaSyncAlt,
  FaBrain,
  FaArrowRight,
} from "react-icons/fa";
import Navbar from "../Navbar/Navbar";
import { API_BASE_URL } from "../../api/config.js";
const API_URL = API_BASE_URL;

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    datasets: 0,
    records: 0,
    quality: null,
    agents: 6,
    reports: 0,
    performance: null,
    performanceMetric: null,
    trainingProgress: 0,
    trainingCount: 0,
    latestTraining: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/dataset/dashboard-stats`,
        { headers: authHeaders() }
      );

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("selectedDatasetId");
        localStorage.removeItem("selectedDatasetName");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`Dashboard API returned ${response.status}`);
      }

      const data = await response.json();
      const model = data?.model || {};
      const reports = data?.reports || {};
      const quality = data?.dataQuality || {};

      setStats({
        datasets: Number(data?.totalDatasets || 0),
        records: Number(data?.totalRows || 0),
        quality:
          quality.averageScore === null || quality.averageScore === undefined
            ? null
            : Number(quality.averageScore),
        agents: 6,
        reports: Number(reports.count || 0),
        performance:
          model.performance === null || model.performance === undefined
            ? null
            : Number(model.performance),
        performanceMetric: model.performanceMetric || null,
        trainingProgress: Number(model.trainingProgress || 0),
        trainingCount: Number(model.trainingCount || 0),
        latestTraining: model.latestTraining || null,
      });
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Unable to load live dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const performanceText =
    stats.performance === null
      ? "—"
      : stats.performanceMetric === "RMSE" ||
        stats.performanceMetric === "MAE"
      ? stats.performance.toFixed(3)
      : `${(stats.performance * 100).toFixed(1)}%`;

  const qualityText =
    stats.quality === null ? "—" : `${Math.round(stats.quality)}%`;

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-950 text-white pt-28 px-5 sm:px-6 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-10"
          >
            <div>
              <p className="text-cyan-400 text-xs font-bold tracking-[0.25em] uppercase mb-2">
                NexusDS AI Workspace
              </p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Dashboard Preview
              </h1>
              <p className="text-gray-400 mt-3 max-w-2xl">
                Live overview of your datasets, reports, machine-learning
                activity and data quality.
              </p>
            </div>

            <button
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition disabled:opacity-50"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </motion.div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<FaDatabase />}
              label="Datasets"
              value={stats.datasets}
              hint="Uploaded to your workspace"
            />
            <MetricCard
              icon={<FaChartLine />}
              label={stats.performanceMetric || "Model Performance"}
              value={performanceText}
              hint={
                stats.performance === null
                  ? "Train a model to see a real metric"
                  : "Latest saved training result"
              }
            />
            <MetricCard
              icon={<FaRobot />}
              label="AI Agents"
              value="6"
              hint="Active platform workflows"
              badge="ACTIVE"
            />
            <MetricCard
              icon={<FaFilePdf />}
              label="Reports"
              value={stats.reports}
              hint="Generated reports for your account"
              badge="PDF"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
            <MetricCard
              icon={<FaDatabase />}
              label="Total Records"
              value={stats.records.toLocaleString()}
              hint="Across your uploaded datasets"
            />
            <MetricCard
              icon={<FaChartLine />}
              label="Average Data Quality"
              value={qualityText}
              hint="Calculated from your datasets"
            />
            <MetricCard
              icon={<FaBrain />}
              label="ML Training Runs"
              value={stats.trainingCount}
              hint="Datasets with saved training results"
            />
          </div>

          <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-cyan-400 text-xs font-bold tracking-[0.2em] uppercase">
                  Machine Learning
                </p>
                <h2 className="text-2xl font-bold mt-1">Model Training Progress</h2>
                <p className="text-gray-400 text-sm mt-2">
                  {stats.latestTraining
                    ? `Latest: ${stats.latestTraining.algorithm || stats.latestTraining.modelId || "Saved model"}`
                    : "No completed model training run yet."}
                </p>
              </div>
              <div className="text-3xl font-bold text-cyan-300">
                {Math.round(stats.trainingProgress)}%
              </div>
            </div>

            <div className="mt-6 h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, stats.trainingProgress))}%` }}
                transition={{ duration: 0.7 }}
                className="h-full bg-cyan-400 rounded-full"
              />
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={() => navigate("/dataset")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition"
              >
                Open Dataset Workspace <FaArrowRight />
              </button>
              <button
                onClick={() => navigate("/agents/reports")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                View Reports <FaFilePdf />
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function MetricCard({ icon, label, value, hint, badge }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="w-11 h-11 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 text-lg">
          {icon}
        </div>
        {badge && (
          <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
            {badge}
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm mt-5">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-gray-500 text-xs mt-2">{hint}</p>
    </motion.div>
  );
}

export default Dashboard;
