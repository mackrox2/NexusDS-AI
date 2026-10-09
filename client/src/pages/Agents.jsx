import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FaDatabase,
  FaChartLine,
  FaRobot,
  FaFilePdf,
  FaArrowRight,
  FaBroom,
  FaBrain,
  FaHome,
  FaPaperPlane,
  FaTrash,
  FaCircleNotch,
  FaPlay,
  FaCheckCircle,
  FaSpinner,
  FaSyncAlt,
  FaExternalLinkAlt,
  FaDownload,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import axios from "axios";

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api`,
  timeout: 120000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

const agents = [
  {
    title: "Data Cleaning Agent",
    icon: <FaBroom />,
    description:
      "Detect missing values, duplicates and inconsistent data, then apply controlled cleaning operations.",
    path: "/agents/data-cleaning",
    action: "Open Cleaning Workspace",
    accent: "cyan",
  },
  {
    title: "Visualization Agent",
    icon: <FaChartLine />,
    description:
      "Turn your dataset into meaningful charts, trends, distributions and visual insights.",
    path: "/agents/visualization",
    action: "Open Visualization",
    accent: "blue",
  },
  {
    title: "ML Training Agent",
    icon: <FaBrain />,
    description:
      "Select a target, train machine-learning models and evaluate real model performance.",
    path: "/agents/ml-training",
    action: "Open ML Workspace",
    accent: "purple",
  },
  {
    title: "Report Agent",
    icon: <FaFilePdf />,
    description:
      "Generate professional PDF reports containing statistics, data quality, insights and recommendations.",
    path: "/agents/reports",
    action: "Open Report Agent",
    accent: "rose",
  },
];

const autopilotStages = [
  { key: "understand", label: "Understand Dataset", icon: <FaDatabase /> },
  { key: "clean", label: "Data Quality", icon: <FaBroom /> },
  { key: "analyze", label: "Analyze Data", icon: <FaChartLine /> },
  { key: "ml", label: "Machine Learning", icon: <FaBrain /> },
  { key: "insights", label: "Generate Insights", icon: <FaRobot /> },
  { key: "report", label: "Prepare Report", icon: <FaFilePdf /> },
];

function Agents() {
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotStage, setAutopilotStage] = useState("");
  const [completedStages, setCompletedStages] = useState([]);
  const [autopilotResult, setAutopilotResult] = useState(null);
  const [mlSuggestion, setMlSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [datasetAnalysis, setDatasetAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [reportHistoryOpen, setReportHistoryOpen] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState("");

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    loadReportHistory();
  }, []);

  const getDatasetId = (dataset) =>
    String(dataset?.id || dataset?._id || "");

  const getDatasetName = (dataset) =>
    dataset?.fileName ||
    dataset?.filename ||
    dataset?.name ||
    "Unnamed Dataset";

  const loadDatasets = async () => {
    try {
      setLoadingDatasets(true);
      setError("");

      const response = await API.get("/dataset/datasets");
      const data = response.data;

      if (data?.success) {
        setDatasets(Array.isArray(data.datasets) ? data.datasets : []);
      } else {
        setDatasets([]);
        setError(data?.message || "No datasets found.");
      }
    } catch (err) {
      console.error("Dataset loading error:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Unable to load datasets. Make sure FastAPI is running."
      );
    } finally {
      setLoadingDatasets(false);
    }
  };

  const loadReportHistory = async () => {
    try {
      setLoadingReports(true);

      const response = await API.get("/autopilot/reports");
      const data = response.data;

      if (data?.success) {
        setReportHistory(Array.isArray(data.reports) ? data.reports : []);
      } else {
        setReportHistory([]);
      }
    } catch (err) {
      console.error("Report history loading error:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  const formatReportDate = (value) => {
    if (!value) return "Unknown date";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openHistoryReport = async (reportId) => {
    if (!reportId) return;

    try {
      const response = await API.get(
        `/autopilot/report/${encodeURIComponent(reportId)}`,
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("History report open error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to open this report."
      );
    }
  };

  const downloadHistoryReport = async (reportId) => {
    if (!reportId) return;

    try {
      const response = await API.get(
        `/autopilot/report/${encodeURIComponent(reportId)}`,
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `NexusDS_AI_Report_${reportId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("History report download error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to download this report."
      );
    }
  };

  const deleteHistoryReport = async (report) => {
    if (!report?.reportId || deletingReportId) return;

    const confirmed = window.confirm(
      `Permanently delete "${report.title || report.fileName || "this report"}"?\n\nThis will remove the report from history and permanently delete its generated PDF.`
    );

    if (!confirmed) return;

    try {
      setDeletingReportId(report.reportId);
      setError("");

      const response = await API.delete(
        `/autopilot/report/${encodeURIComponent(report.reportId)}`
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Report deletion failed."
        );
      }

      setReportHistory((previous) =>
        previous.filter((item) => item.reportId !== report.reportId)
      );

      // If the deleted report is the currently displayed result,
      // clear it so a deleted report cannot remain visible as active data.
      const currentReportId =
        autopilotResult?.report?.reportId ||
        autopilotResult?.reportId;

      if (currentReportId === report.reportId) {
        setAutopilotResult(null);
        setAutopilotStage("");
        setCompletedStages([]);
      }
    } catch (err) {
      console.error("Report deletion error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to permanently delete the report."
      );
    } finally {
      setDeletingReportId("");
    }
  };

  const refreshDatasets = async () => {
    await loadDatasets();
  };

  useEffect(() => {
    if (!selectedDataset) {
      setMlSuggestion(null);
      setDatasetAnalysis(null);
      return;
    }

    let cancelled = false;

    const loadDatasetIntelligence = async () => {
      try {
        setLoadingAnalysis(true);
        setLoadingSuggestion(true);
        setDatasetAnalysis(null);
        setMlSuggestion(null);

        const [analysisResponse, suggestionResponse] = await Promise.all([
          API.get(
            `/dataset/datasets/${encodeURIComponent(selectedDataset)}/analyze`
          ),
          API.get(
            `/ml/suggest/${encodeURIComponent(selectedDataset)}`
          ),
        ]);

        if (!cancelled) {
          if (analysisResponse.data?.success) {
            setDatasetAnalysis(analysisResponse.data);
          }

          if (suggestionResponse.data?.success) {
            setMlSuggestion(suggestionResponse.data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Dataset intelligence error:", err);
          setDatasetAnalysis(null);
          setMlSuggestion(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingAnalysis(false);
          setLoadingSuggestion(false);
        }
      }
    };

    loadDatasetIntelligence();

    return () => {
      cancelled = true;
    };
  }, [selectedDataset]);

  const handleDatasetChange = (event) => {
    const id = event.target.value;

    setSelectedDataset(id);
    setProfile(null);
    setMessages([]);
    setAutopilotResult(null);
    setAutopilotStage("");
    setCompletedStages([]);
    setDatasetAnalysis(null);
    setMlSuggestion(null);
    setError("");

    if (id) {
      const selected = datasets.find(
        (dataset) => getDatasetId(dataset) === String(id)
      );

      localStorage.setItem("selectedDatasetId", id);
      localStorage.setItem(
        "selectedDatasetName",
        getDatasetName(selected)
      );
    } else {
      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");
    }
  };

  const sendMessage = async () => {
    const trimmedQuestion = question.trim();

    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    if (!trimmedQuestion) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);

    setQuestion("");
    setLoadingAI(true);
    setError("");

    try {
      const response = await API.post("/dataset/chat", {
        datasetId: selectedDataset,
        question: trimmedQuestion,
      });

      const data = response.data;

      if (data?.success) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: data.answer || "No answer received.",
          },
        ]);

        if (data.profile) setProfile(data.profile);
      } else {
        throw new Error(
          data?.message || data?.detail || "AI response failed."
        );
      }
    } catch (err) {
      console.error("AI Chat Error:", err);

      const message =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        (err.request
          ? "Unable to connect to backend. Make sure FastAPI is running."
          : err.message) ||
        "AI service is unavailable.";

      setError(message);

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: "⚠️ " + message },
      ]);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setProfile(null);
    setError("");
  };

  const askQuickQuestion = (text) => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }
    setQuestion(text);
  };

  const runAutopilot = async () => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    setError("");
    setAutopilotResult(null);
    setCompletedStages([]);
    setAutopilotRunning(true);
    setAutopilotStage("understand");

    try {
      // Real Stage 1: dataset inspection.
      const analysisResponse = await API.get(
        `/dataset/datasets/${encodeURIComponent(selectedDataset)}/analyze`
      );

      if (!analysisResponse.data?.success) {
        throw new Error(
          analysisResponse.data?.message ||
            analysisResponse.data?.detail ||
            "Dataset inspection failed."
        );
      }

      setDatasetAnalysis(analysisResponse.data);
      setCompletedStages(["understand"]);
      setAutopilotStage("clean");

      // Real Stage 2: ML/data-readiness inspection.
      const suggestionResponse = await API.get(
        `/ml/suggest/${encodeURIComponent(selectedDataset)}`
      );

      if (suggestionResponse.data?.success) {
        setMlSuggestion(suggestionResponse.data);
      }

      setCompletedStages(["understand", "clean"]);
      setAutopilotStage("analyze");

      // Real autonomous backend run.
      const response = await API.post("/autopilot/run", {
        datasetId: selectedDataset,
        runML: true,
      });

      const data = response.data;

      if (!data?.success) {
        throw new Error(
          data?.message || data?.detail || "Autopilot run failed."
        );
      }

      // The remaining stages are represented only after the real backend response
      // returns the corresponding result sections. No artificial timers are used.
      setAutopilotStage("ml");
      setCompletedStages(["understand", "clean", "analyze", "ml"]);
      setAutopilotResult(data);

      setAutopilotStage("insights");
      setCompletedStages([
        "understand",
        "clean",
        "analyze",
        "ml",
        "insights",
      ]);

      if (data?.report?.reportId || data?.reportId) {
        setAutopilotStage("report");
        setCompletedStages([
          "understand",
          "clean",
          "analyze",
          "ml",
          "insights",
          "report",
        ]);

        // Refresh the compact report history after a new report is generated.
        await loadReportHistory();
      }
    } catch (err) {
      console.error("Autopilot Error:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          "Autonomous analysis failed."
      );
      setAutopilotStage("");
    } finally {
      setAutopilotRunning(false);
      setAutopilotStage("");
    }
  };

  const openReport = async () => {
    const reportId =
      autopilotResult?.report?.reportId ||
      autopilotResult?.reportId;

    if (!reportId) {
      setError("No report ID was returned by the backend.");
      return;
    }

    try {
      const response = await API.get(
        `/autopilot/report/${encodeURIComponent(reportId)}`,
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("Report open error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to open the generated report."
      );
    }
  };

  const downloadReport = async () => {
    const reportId =
      autopilotResult?.report?.reportId ||
      autopilotResult?.reportId;

    if (!reportId) {
      setError("No report ID was returned by the backend.");
      return;
    }

    try {
      const response = await API.get(
        `/autopilot/report/${encodeURIComponent(reportId)}`,
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `NexusDS_AI_Report_${reportId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("Report download error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to download the generated report."
      );
    }
  };

  const selectedDatasetInfo = datasets.find(
    (dataset) =>
      getDatasetId(dataset) === String(selectedDataset)
  );

  const analysis = autopilotResult?.analysis || {};
  const summary =
    analysis?.summary ||
    autopilotResult?.summary ||
    datasetAnalysis?.summary ||
    {};

  const ml = autopilotResult?.ml || {};

  const insights =
    autopilotResult?.insights ||
    analysis?.insights ||
    datasetAnalysis?.insights ||
    [];

  const recommendations =
    autopilotResult?.cleaningRecommendations ||
    analysis?.cleaningRecommendations ||
    datasetAnalysis?.cleaningRecommendations ||
    [];

  const renderValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (typeof value === "number") {
      return value.toLocaleString();
    }

    return String(value);
  };

  const formatModelName = (value) => {
    if (!value) return "-";
    return String(value)
      .replace(/_/g, " ")
      .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
  };

  const formatRecommendation = (item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "Review recommended";

    const column = item.column || item.feature || "Dataset";
    const issue = item.issue || item.message || item.reason || "Review recommended";
    const action = item.action ? ` — ${item.action}` : "";
    const priority = item.priority ? ` (${String(item.priority)} priority)` : "";

    return `${column}: ${issue}${action}${priority}`;
  };

  const getMetricValue = (metrics, keys) => {
    for (const key of keys) {
      if (metrics?.[key] !== undefined && metrics?.[key] !== null) {
        return metrics[key];
      }
    }
    return null;
  };

  const formatMetric = (value, percentage = false) => {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    if (percentage) return `${(numeric * 100).toFixed(2)}%`;
    return numeric.toFixed(4);
  };

  const suggestedTarget =
    mlSuggestion?.recommendedTarget ||
    mlSuggestion?.targetCandidates?.[0]?.column ||
    null;

  const suggestedProblemType =
    mlSuggestion?.recommendedProblemType ||
    (mlSuggestion?.targetCandidates?.[0]?.type === "regression_candidate"
      ? "regression"
      : mlSuggestion?.targetCandidates?.length
        ? "classification"
        : null);

  const bestModel = ml?.bestModel || ml?.algorithm || null;
  const modelComparison = ml?.comparison || ml?.modelComparison || [];
  const featureImportance = ml?.featureImportance || [];
  const targetClasses = ml?.targetClasses || [];

  const getAccentClasses = (accent) => {
    const map = {
      cyan: {
        icon: "bg-cyan-400/10 border-cyan-400/20 text-cyan-400",
        hover: "hover:border-cyan-400/50",
        button: "text-cyan-400",
      },
      blue: {
        icon: "bg-blue-400/10 border-blue-400/20 text-blue-400",
        hover: "hover:border-blue-400/50",
        button: "text-blue-400",
      },
      purple: {
        icon: "bg-purple-400/10 border-purple-400/20 text-purple-400",
        hover: "hover:border-purple-400/50",
        button: "text-purple-400",
      },
      rose: {
        icon: "bg-rose-400/10 border-rose-400/20 text-rose-400",
        hover: "hover:border-rose-400/50",
        button: "text-rose-400",
      },
    };

    return map[accent] || map.cyan;
  };

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-slate-950 text-white pt-28 px-4 md:px-8 pb-20">
        <div className="max-w-7xl mx-auto">

          {/* BACK */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition mb-10"
          >
            <FaHome />
            Back to Home
          </button>

          {/* HEADER */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <p className="text-cyan-400 font-semibold tracking-widest text-sm">
              NEXUSDS AI CORE
            </p>

            <h1 className="text-4xl md:text-6xl font-bold mt-3">
              Autonomous{" "}
              <span className="text-cyan-400">AI Agents</span>
            </h1>

            <p className="text-gray-400 text-lg mt-5 max-w-3xl mx-auto">
              Select a dataset and use specialized agents for cleaning,
              visualization, machine learning and professional reporting.
            </p>
          </motion.div>

          {/* ERROR */}
          {error && (
            <div className="max-w-6xl mx-auto mb-8 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-4">
              {error}
            </div>
          )}

          {/* DATASET SELECTOR */}
          <div className="max-w-6xl mx-auto mb-10">
            <div className="bg-slate-900/90 border border-cyan-500/20 rounded-3xl p-6 md:p-8">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                    <FaDatabase className="text-cyan-400 text-xl" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">
                        Select Dataset
                      </h2>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                        Live
                      </span>
                    </div>

                    <p className="text-gray-400 text-sm">
                      Choose one of your uploaded datasets
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshDatasets}
                  disabled={loadingDatasets || autopilotRunning}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 disabled:opacity-40 transition"
                >
                  <FaSyncAlt className={loadingDatasets ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              {loadingDatasets ? (
                <div className="flex items-center gap-3 text-cyan-400 py-4">
                  <FaCircleNotch className="animate-spin" />
                  Loading your datasets...
                </div>
              ) : (
                <select
                  value={selectedDataset}
                  onChange={handleDatasetChange}
                  disabled={autopilotRunning}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-400 transition"
                >
                  <option value="">Choose a dataset...</option>

                  {datasets.map((dataset) => {
                    const id = getDatasetId(dataset);

                    return (
                      <option key={id} value={id}>
                        {getDatasetName(dataset)}
                        {" — "}
                        {dataset.rows ?? dataset.rowCount ?? 0} rows × {dataset.columns ?? dataset.columnCount ?? 0} columns
                      </option>
                    );
                  })}
                </select>
              )}

              {!loadingDatasets && datasets.length === 0 && (
                <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-2xl p-4 text-gray-400">
                  No datasets are available. Upload a dataset from the Dataset Manager first.
                </div>
              )}

              {selectedDatasetInfo && (
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-cyan-500/5 border border-cyan-400/15 rounded-2xl p-4">
                  <div>
                    <p className="text-sm text-gray-500">Selected dataset</p>
                    <p className="font-bold mt-1">
                      {getDatasetName(selectedDatasetInfo)}
                    </p>
                  </div>

                  <div className="flex gap-5 text-sm">
                    <span>
                      <b className="text-cyan-400">
                        {renderValue(selectedDatasetInfo.rows ?? selectedDatasetInfo.rowCount)}
                      </b>{" "}
                      rows
                    </span>
                    <span>
                      <b className="text-cyan-400">
                        {renderValue(selectedDatasetInfo.columns ?? selectedDatasetInfo.columnCount)}
                      </b>{" "}
                      columns
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* REAL ML RECOMMENDATION */}
          {selectedDataset && (loadingSuggestion || mlSuggestion) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto mb-8"
            >
              <div className="bg-slate-900/90 border border-purple-400/20 rounded-3xl p-6 md:p-7">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-purple-400 text-xs font-bold tracking-widest">
                      REAL DATASET INSPECTION
                    </p>
                    <h2 className="text-2xl font-bold mt-1">
                      ML Recommendation
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Based on the selected dataset, not a placeholder.
                    </p>
                  </div>
                  {loadingSuggestion && (
                    <FaSpinner className="text-purple-400 animate-spin text-xl" />
                  )}
                </div>

                {loadingSuggestion ? (
                  <div className="flex items-center gap-3 text-purple-300 bg-slate-800/60 rounded-2xl p-4">
                    <FaCircleNotch className="animate-spin" />
                    Inspecting columns, target candidates and problem type...
                  </div>
                ) : mlSuggestion ? (
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Suggested Target</p>
                      <p className="text-lg font-bold text-purple-300 mt-2">
                        {suggestedTarget || "No reliable target"}
                      </p>
                    </div>
                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Problem Type</p>
                      <p className="text-lg font-bold text-cyan-300 mt-2 capitalize">
                        {suggestedProblemType || "Needs review"}
                      </p>
                    </div>
                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Available Features</p>
                      <p className="text-lg font-bold text-green-300 mt-2">
                        {(mlSuggestion.numericColumns?.length || 0) +
                          (mlSuggestion.categoricalColumns?.length || 0)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}

          {/* REAL DATASET INTELLIGENCE */}
          {selectedDataset && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto mb-10"
            >
              <div className="bg-slate-900/90 border border-cyan-500/20 rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-cyan-400 text-xs font-bold tracking-widest">
                      REAL DATASET INSPECTION
                    </p>
                    <h2 className="text-2xl font-bold mt-1">
                      NexusDS Intelligence
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Recommendations below are calculated from the selected dataset.
                    </p>
                  </div>

                  {(loadingAnalysis || loadingSuggestion) && (
                    <div className="flex items-center gap-2 text-cyan-300 text-sm">
                      <FaSpinner className="animate-spin" />
                      Inspecting dataset...
                    </div>
                  )}
                </div>

                {loadingAnalysis || loadingSuggestion ? (
                  <div className="grid md:grid-cols-3 gap-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-20 rounded-2xl bg-slate-800/70 border border-slate-800 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Rows
                      </p>
                      <p className="text-xl font-bold mt-1">
                        {renderValue(
                          datasetAnalysis?.summary?.rows ??
                            datasetAnalysis?.dataset?.rows ??
                            selectedDatasetInfo?.rows
                        )}
                      </p>
                    </div>

                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Columns
                      </p>
                      <p className="text-xl font-bold mt-1">
                        {renderValue(
                          datasetAnalysis?.summary?.columns ??
                            datasetAnalysis?.dataset?.columns ??
                            selectedDatasetInfo?.columns
                        )}
                      </p>
                    </div>

                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Suggested Target
                      </p>
                      <p className="text-xl font-bold mt-1 text-purple-300">
                        {renderValue(suggestedTarget)}
                      </p>
                    </div>

                    <div className="bg-slate-800/70 rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Suggested Task
                      </p>
                      <p className="text-xl font-bold mt-1 text-cyan-300 capitalize">
                        {renderValue(suggestedProblemType)}
                      </p>
                    </div>
                  </div>
                )}

                {!loadingSuggestion && mlSuggestion?.problemTypeReason && (
                  <div className="mt-4 rounded-2xl bg-purple-500/5 border border-purple-400/15 p-4">
                    <p className="text-xs uppercase tracking-wider text-purple-300 font-bold">
                      Why NexusDS selected this task
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      {mlSuggestion.problemTypeReason}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* AUTOPILOT */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto mb-12"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-400/30 rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(6,182,212,0.08)]">

              <div className="absolute -top-24 -right-24 w-56 h-56 bg-cyan-400/10 rounded-full blur-3xl" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-11 h-11 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
                      <FaRobot className="text-cyan-400 text-xl" />
                    </span>

                    <div>
                      <p className="text-cyan-400 text-xs font-bold tracking-widest">
                        AUTONOMOUS ANALYST
                      </p>
                      <h2 className="text-3xl font-bold">
                        Run Autopilot
                      </h2>
                    </div>
                  </div>

                  <p className="text-gray-400 max-w-2xl">
                    Let NexusDS AI coordinate the complete workflow from
                    dataset understanding to quality checks, analysis,
                    machine learning, insights and PDF reporting.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={runAutopilot}
                  disabled={!selectedDataset || autopilotRunning}
                  className="shrink-0 inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg"
                >
                  {autopilotRunning ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaPlay />
                  )}
                  {autopilotRunning ? "Running..." : "Run Autopilot"}
                </button>
              </div>

              {/* STAGES */}
              <div className="relative mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {autopilotStages.map((stage) => {
                  const completed = completedStages.includes(stage.key);
                  const active =
                    autopilotRunning &&
                    stage.key === autopilotStage &&
                    !completed;

                  return (
                    <motion.div
                      key={stage.key}
                      animate={
                        active
                          ? { opacity: [0.75, 1, 0.75] }
                          : { opacity: 1 }
                      }
                      transition={
                        active
                          ? { duration: 1.4, repeat: Infinity }
                          : { duration: 0.2 }
                      }
                      className={`rounded-2xl border p-4 transition ${
                        active
                          ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_25px_rgba(6,182,212,0.10)]"
                          : completed
                            ? "border-green-400/30 bg-green-400/5"
                            : "border-slate-800 bg-slate-900/70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            active
                              ? "bg-cyan-400/15 text-cyan-400"
                              : completed
                                ? "bg-green-400/10 text-green-400"
                                : "bg-slate-800 text-gray-500"
                          }`}
                        >
                          {completed ? (
                            <FaCheckCircle />
                          ) : active ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            stage.icon
                          )}
                        </div>

                        <p className="text-xs font-semibold leading-tight">
                          {stage.label}
                        </p>
                      </div>

                      {active && (
                        <p className="text-[11px] text-cyan-300 mt-3">
                          Processing real data...
                        </p>
                      )}

                      {completed && (
                        <p className="text-[11px] text-green-400 mt-3">
                          Completed
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {autopilotRunning && (
                <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-cyan-400/5 border border-cyan-400/15 p-4 text-cyan-300">
                  <FaSpinner className="animate-spin" />
                  <div>
                    <p className="font-semibold">
                      {autopilotStage === "understand" && "Understanding the dataset..."}
                      {autopilotStage === "clean" && "Checking data quality and ML readiness..."}
                      {autopilotStage === "analyze" && "Analyzing patterns and dataset structure..."}
                      {autopilotStage === "ml" && "Training and evaluating machine-learning candidates..."}
                      {autopilotStage === "insights" && "Generating insights from the real analysis..."}
                      {autopilotStage === "report" && "Preparing the generated PDF report..."}
                      {!autopilotStage && "NexusDS AI is running the real analysis..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Each green tick appears after a real backend operation returns; no artificial progress timer is used.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* AUTOPILOT RESULT */}
          {autopilotResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto mb-20"
            >
              <div className="bg-slate-900 border border-green-400/20 rounded-3xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7">
                  <div>
                    <p className="text-green-400 text-xs font-bold tracking-widest">
                      AUTONOMOUS RUN COMPLETE
                    </p>
                    <h2 className="text-3xl font-bold mt-2">
                      Autonomous Analysis Complete
                    </h2>
                    <p className="text-gray-400 text-sm mt-2">
                      Real analysis, data-quality checks, ML evaluation and report generation returned by FastAPI.
                    </p>
                  </div>

                  {(autopilotResult?.report?.reportId || autopilotResult?.reportId) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={openReport}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-400/30 text-cyan-300 font-semibold transition"
                      >
                        <FaFilePdf />
                        Open Generated Report
                      </button>
                      <button
                        type="button"
                        onClick={downloadReport}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition"
                      >
                        <FaDownload />
                        Download PDF
                      </button>
                    </div>
                  )}
                </div>

                {/* REAL SUMMARY */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800/70 rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Rows</p>
                    <p className="text-2xl font-bold mt-2">
                      {renderValue(summary.rows)}
                    </p>
                  </div>

                  <div className="bg-slate-800/70 rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Columns</p>
                    <p className="text-2xl font-bold mt-2">
                      {renderValue(summary.columns)}
                    </p>
                  </div>

                  <div className="bg-slate-800/70 rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Data Quality</p>
                    <p className="text-2xl font-bold mt-2 text-cyan-400">
                      {summary.dataHealthScore != null
                        ? `${summary.dataHealthScore}%`
                        : summary.dataQualityScore != null
                          ? `${summary.dataQualityScore}%`
                          : "-"}
                    </p>
                  </div>

                  <div className="bg-slate-800/70 rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-wider text-gray-500">ML Status</p>
                    <p className="text-2xl font-bold mt-2 text-green-300">
                      {ml?.bestModel
                        ? formatModelName(ml.bestModel)
                        : ml?.status || ml?.modelStatus || "Skipped"}
                    </p>
                  </div>
                </div>

                {/* DATA QUALITY DETAILS */}
                <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500">Missing Cells</p>
                    <p className="font-bold mt-1">{renderValue(summary.missingCells ?? summary.totalMissingValues)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500">Duplicate Rows</p>
                    <p className="font-bold mt-1">{renderValue(summary.duplicateRows)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500">Numeric Columns</p>
                    <p className="font-bold mt-1">{renderValue(summary.numericColumns)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-2xl p-4">
                    <p className="text-xs text-gray-500">Categorical Columns</p>
                    <p className="font-bold mt-1">{renderValue(summary.categoricalColumns)}</p>
                  </div>
                </div>

                {/* INSIGHTS + RECOMMENDATIONS */}
                <div className="mt-7 grid lg:grid-cols-2 gap-5">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <FaRobot className="text-cyan-400" />
                      Key Insights
                    </h3>

                    {insights.length > 0 ? (
                      <div className="space-y-3">
                        {insights.slice(0, 10).map((item, index) => (
                          <div
                            key={index}
                            className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4 text-gray-300"
                          >
                            {typeof item === "string"
                              ? item
                              : item?.text ||
                                item?.insight ||
                                item?.message ||
                                `${item?.column || "Dataset"}: Review recommended`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No additional insights were returned.</p>
                    )}
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <FaBroom className="text-cyan-400" />
                      Cleaning Recommendations
                    </h3>

                    {recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {recommendations.slice(0, 10).map((item, index) => (
                          <div
                            key={index}
                            className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4 text-gray-300"
                          >
                            {formatRecommendation(item)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No cleaning recommendations were returned.</p>
                    )}
                  </div>
                </div>

                {/* EXECUTIVE SUMMARY */}
                {autopilotResult?.report?.executiveSummary && (
                  <div className="mt-5 bg-cyan-500/5 border border-cyan-400/15 rounded-3xl p-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <FaFilePdf className="text-cyan-400" />
                      Executive Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed mt-3">
                      {autopilotResult.report.executiveSummary}
                    </p>
                  </div>
                )}

                {/* MACHINE LEARNING */}
                {ml && Object.keys(ml).length > 0 && (
                  <div className="mt-5 bg-slate-900 border border-purple-400/15 rounded-3xl p-6">
                    <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                      <FaBrain className="text-purple-400" />
                      Machine Learning Evaluation
                    </h3>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-800/70 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase">Target</p>
                        <p className="font-bold mt-2 text-purple-300">
                          {renderValue(ml.target || ml.targetColumn)}
                        </p>
                      </div>

                      <div className="bg-slate-800/70 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase">Task</p>
                        <p className="font-bold mt-2 capitalize">
                          {renderValue(ml.problemType || ml.taskType)}
                        </p>
                      </div>

                      <div className="bg-slate-800/70 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase">Best Model</p>
                        <p className="font-bold mt-2 text-green-300">
                          {formatModelName(ml.bestModel || ml.algorithm)}
                        </p>
                      </div>

                      <div className="bg-slate-800/70 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase">Best Score</p>
                        <p className="font-bold mt-2 text-cyan-300">
                          {renderValue(ml.bestScore ?? ml.selectionScore)}
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <div className="bg-slate-800/50 rounded-2xl p-4">
                        <p className="text-xs text-gray-500">Training Rows</p>
                        <p className="font-bold mt-1">{renderValue(ml.trainingRows)}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-2xl p-4">
                        <p className="text-xs text-gray-500">Testing Rows</p>
                        <p className="font-bold mt-1">{renderValue(ml.testingRows)}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-2xl p-4">
                        <p className="text-xs text-gray-500">CV Method</p>
                        <p className="font-semibold mt-1 text-gray-300">
                          {renderValue(ml.cvMethod || "Holdout evaluation")}
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-2xl p-4">
                        <p className="text-xs text-gray-500">Selection</p>
                        <p className="font-semibold mt-1 text-gray-300">
                          {renderValue(ml.selectionMethod || "Best available model")}
                        </p>
                      </div>
                    </div>

                    {/* METRICS */}
                    {ml.metrics && Object.keys(ml.metrics).length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-bold mb-3">Model Performance</p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {ml.problemType === "regression" ? (
                            <>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">R² Score</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["r2Score"]))}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">MAE</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["mae"]))}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">MSE</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["mse"]))}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">RMSE</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["rmse"]))}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">Accuracy</p>
                                <p className="text-xl font-bold mt-1 text-cyan-300">{formatMetric(getMetricValue(ml.metrics, ["accuracy"]), true)}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">Precision</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["precision"]), true)}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">Recall</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["recall"]), true)}</p>
                              </div>
                              <div className="bg-slate-800/60 rounded-2xl p-4">
                                <p className="text-xs text-gray-500">F1 Score</p>
                                <p className="text-xl font-bold mt-1">{formatMetric(getMetricValue(ml.metrics, ["f1Score", "f1"]), true)}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MODEL COMPARISON */}
                    {modelComparison.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-bold mb-3">Model Comparison</p>
                        <div className="overflow-x-auto rounded-2xl border border-slate-800">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-800/80">
                              <tr>
                                <th className="text-left p-3">Model</th>
                                <th className="text-left p-3">Selection Score</th>
                                <th className="text-left p-3">CV</th>
                                <th className="text-left p-3">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelComparison.map((item, index) => {
                                const itemMetrics = item.metrics || item;
                                const selection =
                                  item.selectionScore ??
                                  item.score ??
                                  item.accuracy ??
                                  item.r2;

                                const cv =
                                  item.cvMetrics?.f1Score ??
                                  item.cvMetrics?.accuracy ??
                                  item.cvMetrics?.r2Score ??
                                  item.cvScore ??
                                  null;

                                return (
                                  <tr
                                    key={`${item.model || item.algorithm || "model"}-${index}`}
                                    className="border-t border-slate-800"
                                  >
                                    <td className="p-3 font-semibold">
                                      {formatModelName(item.model || item.algorithm)}
                                    </td>
                                    <td className="p-3 text-cyan-300">
                                      {formatMetric(selection)}
                                    </td>
                                    <td className="p-3 text-purple-300">
                                      {cv == null ? "—" : formatMetric(cv)}
                                    </td>
                                    <td className="p-3">
                                      {item.status === "failed" ? (
                                        <span className="text-red-300">Failed</span>
                                      ) : (
                                        <span className="text-green-300">Evaluated</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* TARGET CLASSES */}
                    {targetClasses.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-bold mb-3">Target Classes</p>
                        <div className="flex flex-wrap gap-2">
                          {targetClasses.map((item) => (
                            <span
                              key={item}
                              className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-200 text-xs"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* FEATURE IMPORTANCE */}
                    {featureImportance.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-bold mb-3">Top Feature Importance</p>
                        <div className="space-y-3">
                          {featureImportance.slice(0, 10).map((item, index) => {
                            const importance = Number(item.importance || 0);
                            const width = Math.min(100, Math.max(2, importance * 100));

                            return (
                              <div key={`${item.feature}-${index}`}>
                                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                                  <span className="text-gray-300 truncate">
                                    {item.feature}
                                  </span>
                                  <span className="text-cyan-300 shrink-0">
                                    {importance.toFixed(4)}
                                  </span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                                    style={{ width: `${width}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* CONFUSION MATRIX */}
                    {ml?.confusionMatrix?.matrix && (
                      <div className="mt-5">
                        <p className="text-sm font-bold mb-3">Confusion Matrix</p>
                        <div className="overflow-x-auto rounded-2xl border border-slate-800">
                          <table className="text-xs border-collapse">
                            <tbody>
                              {ml.confusionMatrix.matrix.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((value, colIndex) => (
                                    <td
                                      key={colIndex}
                                      className="border border-slate-700 bg-slate-800/60 px-4 py-3 text-center min-w-12"
                                    >
                                      {value}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {ml.confusionMatrix.labels?.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Class order: {ml.confusionMatrix.labels.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FALLBACK IF ML WAS SKIPPED */}
                {(!ml || Object.keys(ml).length === 0) && (
                  <div className="mt-5 bg-slate-800/40 border border-yellow-400/10 rounded-2xl p-4">
                    <p className="font-semibold text-yellow-300">
                      Machine learning was not completed.
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {autopilotResult?.ml?.reason ||
                        "No suitable ML configuration was returned for this dataset."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}


          {/* REPORT HISTORY */}
          <div className="max-w-6xl mx-auto mb-12">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden">
              <button
                type="button"
                onClick={() => setReportHistoryOpen((previous) => !previous)}
                className="w-full p-5 md:p-6 flex items-center justify-between gap-4 text-left hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                    <FaFilePdf className="text-cyan-400" />
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl md:text-2xl font-bold">
                        Report History
                      </h2>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-gray-400">
                        {reportHistory.length}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      Expand to view, download or permanently delete generated reports.
                    </p>
                  </div>
                </div>

                <FaArrowRight
                  className={`text-gray-500 transition-transform ${
                    reportHistoryOpen ? "rotate-90 text-cyan-400" : ""
                  }`}
                />
              </button>

              {reportHistoryOpen && (
                <div className="border-t border-slate-800 p-5 md:p-6">
                  {loadingReports ? (
                    <div className="flex items-center gap-3 text-cyan-300 py-5">
                      <FaSpinner className="animate-spin" />
                      Loading report history...
                    </div>
                  ) : reportHistory.length === 0 ? (
                    <div className="text-center py-8 bg-slate-800/30 rounded-2xl border border-slate-800">
                      <FaFilePdf className="mx-auto text-3xl text-slate-700" />
                      <p className="text-gray-400 mt-3">
                        No generated reports yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reportHistory.map((report) => (
                        <div
                          key={report.reportId}
                          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 md:p-5"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <FaFilePdf className="text-cyan-400 shrink-0" />
                                <h3 className="font-bold truncate">
                                  {report.title || "NexusDS AI Report"}
                                </h3>
                              </div>

                              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-500">
                                <span>
                                  Dataset:{" "}
                                  <span className="text-gray-300">
                                    {report.datasetName || "Dataset"}
                                  </span>
                                </span>
                                <span>
                                  Generated:{" "}
                                  <span className="text-gray-300">
                                    {formatReportDate(report.generatedAt)}
                                  </span>
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-3">
                                {report.mlBestModel && (
                                  <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-400/20 text-purple-300 text-[11px]">
                                    ML: {report.mlBestModel}
                                  </span>
                                )}

                                {report.mlBestScore !== null &&
                                  report.mlBestScore !== undefined && (
                                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-[11px]">
                                      Score: {report.mlBestScore}
                                    </span>
                                  )}

                                {report.dataHealthScore !== null &&
                                  report.dataHealthScore !== undefined && (
                                    <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-400/20 text-green-300 text-[11px]">
                                      Data Health: {report.dataHealthScore}%
                                    </span>
                                  )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => openHistoryReport(report.reportId)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400/30 text-cyan-300 text-sm font-semibold transition"
                              >
                                <FaExternalLinkAlt />
                                Open
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadHistoryReport(report.reportId)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20 hover:bg-cyan-500/20 text-cyan-300 text-sm font-semibold transition"
                              >
                                <FaDownload />
                                Download
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteHistoryReport(report)}
                                disabled={deletingReportId === report.reportId}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 text-red-300 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {deletingReportId === report.reportId ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  <FaTrash />
                                )}
                                {deletingReportId === report.reportId
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI CHAT */}
          <div className="max-w-6xl mx-auto mb-20">
            <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl overflow-hidden">

              <div className="border-b border-slate-800 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                    <FaRobot className="text-3xl text-cyan-400" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold">
                      NexusDS AI
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Dataset-aware AI assistant
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearChat}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 transition text-gray-400"
                >
                  <FaTrash />
                  Clear Chat
                </button>
              </div>

              <div className="p-6">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <FaRobot className="mx-auto text-4xl text-slate-700" />

                    <p className="text-gray-400 mt-4">
                      Select a dataset and ask a question about it.
                    </p>

                    <div className="flex flex-wrap justify-center gap-3 mt-6">
                      {[
                        "Summarize this dataset",
                        "What are the main data quality issues?",
                        "Which columns are most important?",
                        "What insights can you find?",
                      ].map((text) => (
                        <button
                          type="button"
                          key={text}
                          onClick={() => askQuickQuestion(text)}
                          disabled={!selectedDataset}
                          className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-400/40 text-gray-300 hover:text-cyan-300 disabled:opacity-40 transition"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto space-y-4 pr-2">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-5 py-4 whitespace-pre-wrap ${
                            message.role === "user"
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-slate-800 text-gray-200"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}

                    {loadingAI && (
                      <div className="flex items-center gap-3 text-cyan-400">
                        <FaSpinner className="animate-spin" />
                        NexusDS AI is analyzing your dataset...
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!selectedDataset || loadingAI}
                    placeholder={
                      selectedDataset
                        ? "Ask something about your selected dataset..."
                        : "Select a dataset first..."
                    }
                    rows={3}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 outline-none focus:border-cyan-400 transition resize-none disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={loadingAI || !selectedDataset || !question.trim()}
                    className="self-end w-14 h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 flex items-center justify-center transition"
                  >
                    {loadingAI ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaPaperPlane />
                    )}
                  </button>
                </div>

                {profile && (
                  <div className="mt-6 bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      Dataset Profile
                    </p>
                    <pre className="mt-3 text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(profile, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INDIVIDUAL AGENTS */}
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-cyan-400 text-sm font-semibold tracking-widest">
                SPECIALIZED WORKSPACES
              </p>

              <h2 className="text-3xl md:text-4xl font-bold mt-2">
                Individual{" "}
                <span className="text-cyan-400">Agents</span>
              </h2>

              <p className="text-gray-400 mt-3">
                Each card is a direct entry point to a real agent workspace.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {agents.map((agent, index) => {
                const accent = getAccentClasses(agent.accent);

                return (
                  <motion.button
                    type="button"
                    key={agent.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06 }}
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => navigate(agent.path)}
                    className={`text-left w-full bg-slate-900 border border-slate-800 ${accent.hover} rounded-3xl p-6 transition cursor-pointer group`}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-2xl shrink-0 ${accent.icon}`}
                      >
                        {agent.icon}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-bold">
                            {agent.title}
                          </h3>

                          <FaExternalLinkAlt className="text-xs text-gray-600 group-hover:text-cyan-400 transition mt-1" />
                        </div>

                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                          {agent.description}
                        </p>

                        <div
                          className={`mt-5 flex items-center gap-2 font-semibold ${accent.button} group-hover:gap-3 transition-all`}
                        >
                          {agent.action}
                          <FaArrowRight className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default Agents;
