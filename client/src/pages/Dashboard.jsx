import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

import {
  FaDatabase,
  FaRobot,
  FaChartLine,
  FaFilePdf,
  FaTable,
  FaCheckCircle,
  FaSyncAlt,
  FaArrowRight,
  FaUpload,
  FaMagic,
  FaBrain,
  FaClock,
  FaArrowUp,
  FaShieldAlt,
  FaBolt,
  FaLightbulb,
} from "react-icons/fa";

import Navbar from "../components/Navbar/Navbar";

function Dashboard() {
  const navigate = useNavigate();
  const API_URL = API_BASE_URL;

  const [datasets, setDatasets] = useState([]);
  const [datasetCount, setDatasetCount] = useState(0);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const redirectToLogin = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDatasetId");
    localStorage.removeItem("selectedDatasetName");
    localStorage.removeItem("datasetPath");
    navigate("/login");
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const authHeaders = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [statsResponse, datasetsResponse] = await Promise.all([
        fetch(`${API_URL}/api/dataset/dashboard-stats`, {
          method: "GET",
          headers: authHeaders,
        }),
        fetch(`${API_URL}/api/dataset/datasets`, {
          method: "GET",
          headers: authHeaders,
        }),
      ]);

      if (statsResponse.status === 401 || datasetsResponse.status === 401) {
        redirectToLogin();
        return;
      }

      let statsData = null;
      let data = null;

      try {
        statsData = await statsResponse.json();
      } catch {}

      try {
        data = await datasetsResponse.json();
      } catch {}

      const list =
        datasetsResponse.ok &&
        data?.success &&
        Array.isArray(data.datasets)
          ? data.datasets
          : [];

      const stats =
        statsResponse.ok && statsData?.success
          ? statsData
          : {};

      setDatasets(list);
      setDashboardStats(stats);

      const backendCount = Number(stats.totalDatasets);
      const responseCount = Number(data?.count);

      if (Number.isFinite(backendCount) && backendCount >= 0) {
        setDatasetCount(backendCount);
      } else if (Number.isFinite(responseCount) && responseCount >= 0) {
        setDatasetCount(responseCount);
      } else {
        setDatasetCount(list.length);
      }

      if (!datasetsResponse.ok) {
        setError(
          data?.detail ||
            data?.message ||
            "Unable to load datasets."
        );
      }
    } catch (err) {
      console.error("Dashboard Data Error:", err);
      setDatasets([]);
      setDatasetCount(0);
      setDashboardStats(null);
      setError("Unable to connect to dashboard service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "0";
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("en-IN")
      : "0";
  };

  const formatDate = (value) => {
    if (!value) return "Recently uploaded";
    try {
      return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Recently uploaded";
    }
  };

  const getExtension = (name = "") => {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "DATA";
  };

  const getFileIcon = (name = "") => {
    const ext = getExtension(name);
    if (["PDF"].includes(ext)) return "PDF";
    if (["DOC", "DOCX"].includes(ext)) return "DOC";
    if (["JPG", "JPEG", "PNG", "WEBP", "BMP", "TIF", "TIFF"].includes(ext))
      return "IMG";
    if (["XLS", "XLSX"].includes(ext)) return "XLS";
    if (ext === "CSV") return "CSV";
    return "DATA";
  };

  const latestDataset = datasets[0] || null;

  const totalRows =
    dashboardStats?.totalRows ??
    datasets.reduce((sum, item) => sum + (Number(item.rows) || 0), 0);

  const cleanedDatasets =
    dashboardStats?.cleanedDatasets ??
    datasets.filter((item) => item.cleaned).length;

  const totalModels =
    dashboardStats?.model?.trainingCount ??
    dashboardStats?.modelsTrained ??
    0;

  const averageDataQuality =
    dashboardStats?.dataQuality?.averageScore ??
    dashboardStats?.averageDataQuality ??
    null;

  const reportCount = dashboardStats?.reports?.count ?? 0;
  const recentDatasets = Array.isArray(dashboardStats?.recentDatasets)
    ? dashboardStats.recentDatasets
    : datasets.slice(0, 5);

  const qualityLabel = useMemo(() => {
    if (averageDataQuality === null || averageDataQuality === undefined) {
      return "Not analyzed";
    }
    const score = Number(averageDataQuality);
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 50) return "Needs attention";
    return "Needs improvement";
  }, [averageDataQuality]);

  const openDataset = (dataset) => {
    const id = dataset?.id || dataset?._id || "";
    if (id) localStorage.setItem("selectedDatasetId", String(id));
    if (dataset?.fileName)
      localStorage.setItem("selectedDatasetName", dataset.fileName);
    if (dataset?.filePath)
      localStorage.setItem("datasetPath", dataset.filePath);
    navigate("/dataset");
  };

  const healthScore =
    averageDataQuality !== null && averageDataQuality !== undefined
      ? Math.max(0, Math.min(100, Number(averageDataQuality)))
      : 0;

  const healthMessage =
    averageDataQuality === null || averageDataQuality === undefined
      ? "Upload and analyze a dataset to generate your workspace health score."
      : healthScore >= 90
      ? "Your workspace is in excellent shape. Data is ready for deeper analysis."
      : healthScore >= 75
      ? "Your datasets are mostly healthy. A few quality improvements may help."
      : healthScore >= 50
      ? "Some data-quality issues need attention before advanced modeling."
      : "Your workspace needs cleaning before reliable analysis and ML.";

  const workflowSteps = [
    {
      title: "Upload",
      text: latestDataset ? "Dataset available" : "Add your first dataset",
      done: Boolean(latestDataset),
      icon: FaUpload,
    },
    {
      title: "Clean",
      text: cleanedDatasets > 0 ? `${formatNumber(cleanedDatasets)} cleaned` : "Not started",
      done: cleanedDatasets > 0,
      icon: FaCheckCircle,
    },
    {
      title: "Analyze",
      text: averageDataQuality !== null ? "Quality analyzed" : "Waiting for analysis",
      done: averageDataQuality !== null && averageDataQuality !== undefined,
      icon: FaChartLine,
    },
    {
      title: "Model",
      text: totalModels > 0 ? `${formatNumber(totalModels)} trained` : "No model yet",
      done: totalModels > 0,
      icon: FaBrain,
    },
    {
      title: "Report",
      text: reportCount > 0 ? `${formatNumber(reportCount)} generated` : "No report yet",
      done: reportCount > 0,
      icon: FaFilePdf,
    },
  ];

  const statCards = [
    {
      label: "Total Datasets",
      value: loading ? "..." : formatNumber(datasetCount),
      note: "Your workspace",
      icon: FaDatabase,
      accent: "cyan",
    },
    {
      label: "Total Records",
      value: loading ? "..." : formatNumber(totalRows),
      note: "Across your datasets",
      icon: FaTable,
      accent: "violet",
    },
    {
      label: "Data Quality",
      value:
        loading
          ? "..."
          : averageDataQuality !== null
          ? `${averageDataQuality}%`
          : "—",
      note: loading ? "Calculating..." : qualityLabel,
      icon: FaCheckCircle,
      accent: "emerald",
    },
    {
      label: "ML Models",
      value: loading ? "..." : formatNumber(totalModels),
      note: totalModels > 0 ? "Training completed" : "No models trained yet",
      icon: FaBrain,
      accent: "amber",
    },
  ];

  const accentClasses = {
    cyan: {
      border: "border-cyan-400/20",
      bg: "bg-cyan-400/10",
      text: "text-cyan-300",
      glow: "group-hover:shadow-cyan-500/10",
    },
    violet: {
      border: "border-violet-400/20",
      bg: "bg-violet-400/10",
      text: "text-violet-300",
      glow: "group-hover:shadow-violet-500/10",
    },
    emerald: {
      border: "border-emerald-400/20",
      bg: "bg-emerald-400/10",
      text: "text-emerald-300",
      glow: "group-hover:shadow-emerald-500/10",
    },
    amber: {
      border: "border-amber-400/20",
      bg: "bg-amber-400/10",
      text: "text-amber-300",
      glow: "group-hover:shadow-amber-500/10",
    },
  };

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-950 text-white pt-28 px-4 sm:px-6 md:px-8 pb-16">
        <div className="max-w-7xl mx-auto">

          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] border border-cyan-400/10 bg-slate-900/80 p-6 sm:p-8 md:p-10 mb-8"
          >
            <div className="absolute -top-32 -right-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 left-1/3 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-7">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI Data Science Workspace
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                  Welcome to{" "}
                  <span className="text-cyan-300">NexusDS AI</span>
                </h1>

                <p className="text-slate-400 mt-3 max-w-2xl text-base sm:text-lg leading-relaxed">
                  Turn raw files into structured data, insights, machine-learning
                  workflows and professional reports.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/dataset")}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/10"
                >
                  <FaUpload />
                  Upload Dataset
                </button>

                <button
                  onClick={loadDashboardData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900 transition disabled:opacity-50"
                >
                  <FaSyncAlt className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </motion.section>

          {error && (
            <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-950/20 px-5 py-4 text-red-300">
              <p className="font-semibold">Unable to load dashboard</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={loadDashboardData}
                className="mt-3 text-sm font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              const styles = accentClasses[card.accent];

              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -4 }}
                  className={`group rounded-2xl border ${styles.border} bg-slate-900/75 p-5 shadow-xl shadow-black/10 ${styles.glow} transition`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-11 h-11 rounded-xl ${styles.bg} flex items-center justify-center`}>
                      <Icon className={`text-xl ${styles.text}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
                      LIVE
                    </span>
                  </div>

                  <p className="text-slate-400 mt-5 text-sm">{card.label}</p>
                  <h2 className="text-3xl font-bold mt-1 tracking-tight">
                    {card.value}
                  </h2>
                  <p className="text-xs text-slate-500 mt-2">{card.note}</p>
                </motion.div>
              );
            })}
          </section>

          {/* Main grid */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

            {/* Latest dataset */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="xl:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                    Workspace
                  </p>
                  <h2 className="text-2xl font-bold mt-1">Latest Dataset</h2>
                </div>
                <FaDatabase className="text-slate-700 text-2xl" />
              </div>

              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-5 bg-slate-800 rounded w-2/3" />
                  <div className="h-4 bg-slate-800 rounded w-1/3" />
                  <div className="h-12 bg-slate-800 rounded-xl" />
                </div>
              ) : latestDataset ? (
                <div className="rounded-2xl border border-cyan-400/10 bg-slate-950/50 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-cyan-400/10 border border-cyan-400/10 flex items-center justify-center">
                      <span className="text-xs font-black text-cyan-300">
                        {getFileIcon(latestDataset.fileName)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1">
                          <FaCheckCircle />
                          Ready for analysis
                        </span>
                      </div>
                      <h3 className="font-bold text-lg truncate">
                        {latestDataset.fileName}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {formatNumber(latestDataset.rows)} records
                        {" • "}
                        {formatNumber(latestDataset.columns)} columns
                        {" • "}
                        {formatDate(latestDataset.uploadedAt)}
                      </p>
                    </div>

                    <button
                      onClick={() => openDataset(latestDataset)}
                      className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 font-semibold hover:border-cyan-400/40 hover:text-cyan-300 transition"
                    >
                      Open
                      <FaArrowRight className="text-xs" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 py-10 text-center">
                  <FaDatabase className="mx-auto text-3xl text-slate-700 mb-3" />
                  <p className="text-slate-400">Your workspace is empty.</p>
                  <button
                    onClick={() => navigate("/dataset")}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 font-bold text-slate-950"
                  >
                    <FaUpload />
                    Upload your first dataset
                  </button>
                </div>
              )}
            </motion.div>

            {/* Workspace health */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                    Workspace Health
                  </p>
                  <h2 className="text-2xl font-bold mt-1">Overview</h2>
                </div>
                <FaMagic className="text-slate-700 text-xl" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <span className="text-slate-400">Datasets cleaned</span>
                  <span className="font-bold text-emerald-300">
                    {formatNumber(cleanedDatasets)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <span className="text-slate-400">Reports generated</span>
                  <span className="font-bold text-red-300">
                    {formatNumber(reportCount)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 p-4">
                  <span className="text-slate-400">AI agents</span>
                  <span className="inline-flex items-center gap-2 font-bold text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    6 Active
                  </span>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-cyan-500/5 to-violet-500/5 border border-cyan-400/10 p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <FaClock className="text-cyan-400" />
                    Latest activity
                  </div>
                  <p className="text-white font-semibold mt-2">
                    {latestDataset
                      ? formatDate(latestDataset.uploadedAt)
                      : "No activity yet"}
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* AI Intelligence */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 via-slate-900/80 to-cyan-500/5 p-6 md:p-7"
            >
              <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-violet-300 font-bold">
                      Nexus Intelligence
                    </p>
                    <h2 className="text-2xl font-bold mt-1">AI Workspace Insight</h2>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-violet-400/10 border border-violet-400/15 flex items-center justify-center">
                    <FaLightbulb className="text-violet-300" />
                  </div>
                </div>

                <p className="text-slate-300 mt-5 leading-relaxed">
                  {healthMessage}
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                    {formatNumber(datasetCount)} datasets
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                    {formatNumber(totalRows)} records
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                    {formatNumber(totalModels)} models
                  </span>
                </div>

                {latestDataset && (
                  <button
                    onClick={() => openDataset(latestDataset)}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200 transition"
                  >
                    Continue with {latestDataset.fileName}
                    <FaArrowRight className="text-xs" />
                  </button>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-300 font-bold">
                    Data Health
                  </p>
                  <h2 className="text-xl font-bold mt-1">Workspace Score</h2>
                </div>
                <FaShieldAlt className="text-slate-700 text-xl" />
              </div>

              <div className="flex items-center gap-5 mt-6">
                <div className="relative w-24 h-24 shrink-0 rounded-full border-[7px] border-slate-800 flex items-center justify-center">
                  <div className="absolute inset-[-7px] rounded-full border-[7px] border-emerald-400/70 border-l-transparent border-b-transparent -rotate-45" />
                  <span className="text-2xl font-black">
                    {averageDataQuality !== null && averageDataQuality !== undefined
                      ? `${Math.round(healthScore)}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <p className="text-emerald-300 font-bold">{qualityLabel}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Based on available dataset quality metrics.
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Workflow Pulse */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-7">
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                  Workflow Pulse
                </p>
                <h2 className="text-2xl font-bold mt-1">Your Data Science Journey</h2>
              </div>
              <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                <FaBolt className="text-cyan-300" />
                Live from your workspace
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-2xl border p-4 ${
                      step.done
                        ? "border-emerald-400/15 bg-emerald-400/5"
                        : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={step.done ? "text-emerald-300" : "text-slate-600"} />
                      <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="font-bold mt-4">{step.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{step.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Autopilot hero */}
          {latestDataset && (
            <motion.section
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-violet-500/10 p-6 md:p-8 mb-8"
            >
              <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-7">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 text-cyan-300 text-xs font-bold tracking-widest uppercase">
                    <FaRobot />
                    Autonomous Data Science
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold mt-3">
                    Let NexusDS AI run the workflow
                  </h2>

                  <p className="text-slate-400 mt-2 leading-relaxed">
                    Analyze data quality, discover patterns, assess ML readiness,
                    generate AI insights and prepare a professional report.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-5">
                    {["Understand", "Quality", "Analyze", "ML", "Insights", "Report"].map(
                      (item) => (
                        <span
                          key={item}
                          className="px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-700 text-xs text-slate-400"
                        >
                          {item}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    openDataset(latestDataset);
                    navigate("/agents");
                  }}
                  className="shrink-0 inline-flex items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 hover:bg-cyan-300 transition shadow-xl shadow-cyan-500/10"
                >
                  <FaRobot />
                  Run Autopilot
                  <FaArrowRight />
                </button>
              </div>
            </motion.section>
          )}

          {/* Recent datasets */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-7 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  Your workspace
                </p>
                <h2 className="text-2xl font-bold mt-1">Recent Datasets</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Your latest uploaded and processed files.
                </p>
              </div>

              <button
                onClick={() => navigate("/dataset")}
                className="text-cyan-300 font-semibold hover:text-cyan-200 transition"
              >
                Manage all →
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-16 rounded-2xl bg-slate-800/50 animate-pulse"
                  />
                ))}
              </div>
            ) : recentDatasets.length === 0 ? (
              <div className="py-10 text-center">
                <FaTable className="mx-auto text-3xl text-slate-700 mb-3" />
                <p className="text-slate-400">No datasets uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDatasets.slice(0, 5).map((dataset) => (
                  <motion.div
                    key={dataset.id || dataset._id || dataset.fileName}
                    whileHover={{ x: 3 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 hover:border-cyan-400/20 transition"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center">
                      <span className="text-[10px] font-black text-cyan-300">
                        {getFileIcon(dataset.fileName)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {dataset.fileName || "Unnamed dataset"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatNumber(dataset.rows)} rows
                        {" • "}
                        {formatNumber(dataset.columns)} columns
                        {dataset.uploadedAt
                          ? ` • ${formatDate(dataset.uploadedAt)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {dataset.cleaned && (
                        <span className="px-2.5 py-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 text-emerald-300 text-[11px] font-semibold">
                          Cleaned
                        </span>
                      )}
                      <button
                        onClick={() => openDataset(dataset)}
                        className="text-cyan-300 font-semibold text-sm hover:text-cyan-200"
                      >
                        Open →
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section>
            <div className="mb-5">
              <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                Command Center
              </p>
              <h2 className="text-2xl font-bold mt-1">Command Center</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {
                  title: "Dataset Manager",
                  text: "Upload, convert and manage your datasets.",
                  icon: FaDatabase,
                  color: "cyan",
                  path: "/dataset",
                },
                {
                  title: "Data Analytics",
                  text: "Explore statistics, charts and data quality.",
                  icon: FaChartLine,
                  color: "violet",
                  path: "/analytics",
                },
                {
                  title: "AI Agents",
                  text: "Run autonomous data-science workflows.",
                  icon: FaRobot,
                  color: "emerald",
                  path: "/agents",
                },
                {
                  title: "Reports",
                  text: "Generate and manage professional reports.",
                  icon: FaFilePdf,
                  color: "red",
                  path: "/reports",
                },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.title}
                    whileHover={{ y: -4 }}
                    onClick={() => navigate(action.path)}
                    className="text-left rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-600 transition group"
                  >
                    <Icon
                      className={`text-2xl mb-5 ${
                        action.color === "cyan"
                          ? "text-cyan-300"
                          : action.color === "violet"
                          ? "text-violet-300"
                          : action.color === "emerald"
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    />
                    <h3 className="font-bold text-lg">{action.title}</h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                      {action.text}
                    </p>
                    <div className="mt-5 text-sm font-semibold text-slate-300 flex items-center gap-2 group-hover:text-cyan-300 transition">
                      Open
                      <FaArrowRight className="text-xs" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>

        </div>
      </main>
    </>
  );
}

export default Dashboard;
