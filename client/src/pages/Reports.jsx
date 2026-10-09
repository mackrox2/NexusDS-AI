import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/config";
import {
  FaFilePdf,
  FaPlay,
  FaSyncAlt,
  FaDownload,
  FaCheckCircle,
  FaTrash,
  FaChevronDown,
  FaExternalLinkAlt,
  FaDatabase,
  FaClock,
  FaChartLine,
  FaBrain,
  FaShieldAlt,
  FaSearch,
  FaCircleNotch,
} from "react-icons/fa";
import Navbar from "../components/Navbar/Navbar";

const API_URL = API_BASE_URL;

function Reports() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [deletingReportId, setDeletingReportId] = useState("");
  const [search, setSearch] = useState("");

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const handle401 = (status) => {
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");
      window.location.href = "/login";
      return true;
    }
    return false;
  };

  const getDatasetId = (dataset) =>
    String(dataset?.id || dataset?._id || "");

  const getDatasetName = (dataset) =>
    dataset?.fileName ||
    dataset?.filename ||
    dataset?.name ||
    "Unnamed Dataset";

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [datasetResponse, reportResponse] = await Promise.all([
        fetch(`${API_URL}/api/dataset/datasets`, { headers: headers() }),
        fetch(`${API_URL}/api/autopilot/reports`, { headers: headers() }),
      ]);

      if (
        handle401(datasetResponse.status) ||
        handle401(reportResponse.status)
      ) {
        return;
      }

      if (!datasetResponse.ok) {
        throw new Error("Unable to load datasets.");
      }

      if (!reportResponse.ok) {
        throw new Error("Unable to load reports.");
      }

      const datasetData = await datasetResponse.json();
      const reportData = await reportResponse.json();

      const datasetList = Array.isArray(datasetData?.datasets)
        ? datasetData.datasets
        : [];

      const reportList = Array.isArray(reportData?.reports)
        ? reportData.reports
        : [];

      setDatasets(datasetList);
      setReports(reportList);

      const saved = localStorage.getItem("selectedDatasetId");

      if (
        saved &&
        datasetList.some(
          (item) => getDatasetId(item) === String(saved)
        )
      ) {
        setSelectedDataset(String(saved));
      } else if (datasetList.length) {
        setSelectedDataset((previous) =>
          previous &&
          datasetList.some(
            (item) => getDatasetId(item) === String(previous)
          )
            ? previous
            : getDatasetId(datasetList[0])
        );
      } else {
        setSelectedDataset("");
      }
    } catch (err) {
      console.error("Reports loading error:", err);
      setError(err.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(() => setSuccess(""), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handleDatasetChange = (event) => {
    const id = event.target.value;

    setSelectedDataset(id);
    setError("");
    setSuccess("");

    const dataset = datasets.find(
      (item) => getDatasetId(item) === String(id)
    );

    if (id) {
      localStorage.setItem("selectedDatasetId", id);
      localStorage.setItem(
        "selectedDatasetName",
        getDatasetName(dataset)
      );
    }
  };

  const generateReport = async () => {
    if (!selectedDataset || generating) return;

    try {
      setGenerating(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/api/autopilot/run`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          datasetId: selectedDataset,
          runML: true,
        }),
      });

      if (handle401(response.status)) return;

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Report generation failed."
        );
      }

      setSuccess(
        "Report generated successfully and saved to your account."
      );

      await loadData();
      setHistoryOpen(true);
    } catch (err) {
      console.error("Report generation error:", err);
      setError(err.message || "Unable to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const getReport = async (reportId) => {
    const response = await fetch(
      `${API_URL}/api/autopilot/report/${encodeURIComponent(reportId)}`,
      {
        headers: {
          Authorization: `Bearer ${
            localStorage.getItem("token") || ""
          }`,
        },
      }
    );

    if (handle401(response.status)) return null;

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.detail || "Unable to access report.");
    }

    return response.blob();
  };

  const openReport = async (reportId) => {
    if (!reportId) return;

    try {
      setError("");

      const blob = await getReport(reportId);
      if (!blob) return;

      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      console.error("Report open error:", err);
      setError(err.message || "Unable to open report.");
    }
  };

  const downloadReport = async (
    reportId,
    fileName = "NexusDS_AI_Report.pdf"
  ) => {
    if (!reportId) return;

    try {
      setError("");

      const blob = await getReport(reportId);
      if (!blob) return;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        fileName || `NexusDS_AI_Report_${reportId}.pdf`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error("Report download error:", err);
      setError(err.message || "Unable to download report.");
    }
  };

  const deleteReport = async (report) => {
    if (!report?.reportId || deletingReportId) return;

    const confirmed = window.confirm(
      `Permanently delete "${
        report.title || "this report"
      }"?\n\nThe saved report record and its PDF file will be permanently deleted.`
    );

    if (!confirmed) return;

    try {
      setDeletingReportId(report.reportId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/autopilot/report/${encodeURIComponent(
          report.reportId
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${
              localStorage.getItem("token") || ""
            }`,
          },
        }
      );

      if (handle401(response.status)) return;

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to permanently delete report."
        );
      }

      setReports((previous) =>
        previous.filter(
          (item) => item.reportId !== report.reportId
        )
      );

      setSuccess("Report permanently deleted.");
    } catch (err) {
      console.error("Report delete error:", err);
      setError(err.message || "Unable to delete report.");
    } finally {
      setDeletingReportId("");
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedDatasetInfo = datasets.find(
    (dataset) => getDatasetId(dataset) === String(selectedDataset)
  );

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return reports;

    return reports.filter((report) => {
      const haystack = [
        report?.title,
        report?.fileName,
        report?.datasetName,
        report?.mlBestModel,
        report?.generatedAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [reports, search]);

  const latestReport = reports[0];

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-slate-950 text-white pt-28 px-4 sm:px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* HERO */}
          <motion.section
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/25 p-6 sm:p-8 lg:p-10 mb-7"
          >
            <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl" />

            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[11px] font-bold uppercase tracking-[0.18em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Report Agent
                  </span>

                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/15 text-emerald-300 text-[11px] font-semibold">
                    <FaShieldAlt />
                    Private workspace
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
                  Analysis <span className="text-cyan-400">Reports</span>
                </h1>

                <p className="text-gray-400 text-base sm:text-lg leading-relaxed mt-5 max-w-2xl">
                  Turn your selected dataset into a professional PDF
                  analysis with data quality, machine learning results,
                  insights and recommendations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                <div className="rounded-2xl bg-white/[0.035] border border-white/10 p-4">
                  <FaFilePdf className="text-cyan-400 mb-3" />
                  <p className="text-2xl font-bold">{reports.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Saved reports
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.035] border border-white/10 p-4">
                  <FaDatabase className="text-purple-400 mb-3" />
                  <p className="text-2xl font-bold">
                    {datasets.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Available datasets
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ALERTS */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300 flex items-center gap-3"
              >
                <FaCheckCircle />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* GENERATOR */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-xl overflow-hidden mb-7"
          >
            <div className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
                <div>
                  <p className="text-cyan-400 text-[11px] font-bold tracking-[0.2em] uppercase">
                    Generate a new report
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                    Choose your dataset
                  </h2>
                  <p className="text-gray-500 text-sm mt-2">
                    The report uses the real analysis pipeline and is
                    saved to your authenticated account.
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                  <FaShieldAlt className="text-emerald-400" />
                  Account-scoped storage
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_auto] gap-4">
                <div className="relative">
                  <FaDatabase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />

                  <select
                    value={selectedDataset}
                    onChange={handleDatasetChange}
                    disabled={loading || generating || !datasets.length}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-900/90 pl-12 pr-5 py-4 text-white outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition disabled:opacity-50"
                  >
                    {!datasets.length && (
                      <option value="">No datasets available</option>
                    )}

                    {datasets.map((dataset) => {
                      const id = getDatasetId(dataset);

                      return (
                        <option key={id} value={id}>
                          {getDatasetName(dataset)}
                          {dataset.rows != null
                            ? ` — ${dataset.rows} rows`
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={generateReport}
                  disabled={!selectedDataset || generating || loading}
                  className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-cyan-500 text-slate-950 font-black hover:bg-cyan-400 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed min-w-[210px]"
                >
                  {generating ? (
                    <>
                      <FaSyncAlt className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaPlay />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {selectedDatasetInfo && (
                  <motion.div
                    key={getDatasetId(selectedDatasetInfo)}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-5"
                  >
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] p-4">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500">
                          Selected dataset
                        </p>
                        <p className="font-bold mt-1 truncate">
                          {getDatasetName(selectedDatasetInfo)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500">
                          Rows
                        </p>
                        <p className="font-bold text-cyan-300 mt-1">
                          {selectedDatasetInfo.rows ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500">
                          Columns
                        </p>
                        <p className="font-bold text-purple-300 mt-1">
                          {selectedDatasetInfo.columns ?? "—"}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!loading && !datasets.length && (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5">
                  <p className="font-semibold">No dataset available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload a dataset from the Dataset Workspace before
                    generating a report.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-6 sm:px-8 py-5 bg-black/10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {[
                  [FaDatabase, "Dataset", "Real source data"],
                  [FaChartLine, "Analysis", "Statistics & quality"],
                  [FaBrain, "ML", "Model evaluation"],
                  [FaFilePdf, "PDF", "Saved report"],
                ].map(([Icon, title, detail]) => (
                  <div key={title} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-cyan-400">
                      <Icon />
                    </div>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-gray-600">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* REPORT HISTORY */}
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] backdrop-blur-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen((previous) => !previous)}
              className="w-full p-5 sm:p-7 flex items-center justify-between gap-4 text-left hover:bg-white/[0.025] transition"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center text-red-300">
                  <FaFilePdf />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-bold">
                      Report History
                    </h2>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs">
                      {reports.length}
                    </span>
                  </div>

                  <p className="text-gray-500 text-sm mt-1">
                    Your generated reports, stored privately with your
                    account.
                  </p>
                </div>
              </div>

              <FaChevronDown
                className={`shrink-0 text-gray-500 transition-transform ${
                  historyOpen ? "rotate-180 text-cyan-400" : ""
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/10 p-5 sm:p-7">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                      <div>
                        <p className="text-sm font-semibold">
                          Saved analysis reports
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {filteredReports.length} of {reports.length} reports shown
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search reports..."
                            className="w-full sm:w-64 rounded-xl border border-white/10 bg-slate-950/70 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-400/40 transition"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={loadData}
                          disabled={loading || generating}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 text-sm transition disabled:opacity-40"
                        >
                          <FaSyncAlt className={loading ? "animate-spin" : ""} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {loading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="h-28 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse"
                          />
                        ))}
                      </div>
                    ) : !filteredReports.length ? (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center">
                          <FaFilePdf className="text-2xl text-gray-600" />
                        </div>

                        <h3 className="font-bold text-lg mt-5">
                          {search ? "No matching reports" : "No saved reports yet"}
                        </h3>

                        <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                          {search
                            ? "Try another report name, dataset name or model."
                            : "Generate your first PDF report above and it will appear here automatically."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredReports.map((report, index) => {
                          const isDeleting =
                            deletingReportId === report.reportId;

                          return (
                            <motion.article
                              key={report.reportId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: Math.min(index * 0.035, 0.2),
                              }}
                              className="group rounded-2xl border border-white/10 bg-slate-950/55 hover:border-cyan-400/20 hover:bg-slate-950/75 transition p-4 sm:p-5"
                            >
                              <div className="flex flex-col xl:flex-row xl:items-center gap-5">
                                <div className="flex items-start gap-4 min-w-0 flex-1">
                                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center text-red-300">
                                    <FaFilePdf />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-bold truncate">
                                        {report.title || "NexusDS AI Report"}
                                      </h3>

                                      {index === 0 && !search && (
                                        <span className="px-2 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/15 text-cyan-300 text-[10px] uppercase tracking-wider font-bold">
                                          Latest
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-gray-500">
                                      <span className="inline-flex items-center gap-1.5">
                                        <FaDatabase />
                                        {report.datasetName || "Dataset"}
                                      </span>

                                      <span className="inline-flex items-center gap-1.5">
                                        <FaClock />
                                        {formatDate(report.generatedAt)}
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {report.dataHealthScore !== null &&
                                        report.dataHealthScore !== undefined && (
                                          <span className="px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/10 text-emerald-300 text-[11px]">
                                            Health {report.dataHealthScore}%
                                          </span>
                                        )}

                                      {report.mlBestModel && (
                                        <span className="px-2.5 py-1 rounded-full bg-purple-400/10 border border-purple-400/10 text-purple-300 text-[11px]">
                                          ML: {report.mlBestModel}
                                        </span>
                                      )}

                                      {report.mlBestScore !== null &&
                                        report.mlBestScore !== undefined && (
                                          <span className="px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/10 text-cyan-300 text-[11px]">
                                            Score {report.mlBestScore}
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 xl:justify-end shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openReport(report.reportId)}
                                    disabled={isDeleting}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-400/30 hover:bg-cyan-400/5 text-gray-300 hover:text-cyan-300 text-sm font-semibold transition disabled:opacity-40"
                                  >
                                    <FaExternalLinkAlt className="text-xs" />
                                    Open
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadReport(
                                        report.reportId,
                                        report.fileName || `NexusDS_AI_Report_${report.reportId}.pdf`
                                      )
                                    }
                                    disabled={isDeleting}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 hover:bg-cyan-500/15 text-cyan-300 text-sm font-semibold transition disabled:opacity-40"
                                  >
                                    <FaDownload />
                                    Download
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteReport(report)}
                                    disabled={
                                      deletingReportId !== "" || isDeleting
                                    }
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-400/20 hover:bg-red-500/15 text-red-300 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {isDeleting ? (
                                      <FaCircleNotch className="animate-spin" />
                                    ) : (
                                      <FaTrash />
                                    )}
                                    {isDeleting ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 text-xs text-gray-600">
            <span className="inline-flex items-center gap-2">
              <FaShieldAlt className="text-emerald-500/70" />
              Reports are scoped to your authenticated account.
            </span>

            {latestReport && (
              <span className="inline-flex items-center gap-2">
                Latest report:{" "}
                <span className="text-gray-400">
                  {formatDate(latestReport.generatedAt)}
                </span>
              </span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default Reports;
