/*
 * NexusDS AI — Analytics Professional 2.0
 * Based on the existing Analytics.jsx source.
 * Existing API contracts, analysis fields, selectors, insights,
 * recommendations, profiles, statistics and chart handling are preserved.
 *
 * NOTE: This file is generated from the uploaded pasted source.
 * Review the JSX if the pasted source was truncated during upload.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaDatabase,
  FaTable,
  FaExclamationTriangle,
  FaCopy,
  FaChartBar,
  FaColumns,
  FaSyncAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaFileExcel,
  FaLayerGroup,
  FaBullseye,
  FaRobot,
  FaFilter,
  FaBrain,
  FaLightbulb,
  FaPlay,
  FaComments,
  FaRocket,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar/Navbar";
import DatasetAPI from "../api/dataset";


function Analytics() {

  const navigate = useNavigate();

  // =====================================================
  // STATES
  // =====================================================

  const [datasets, setDatasets] = useState([]);

  const [selectedDataset, setSelectedDataset] =
    useState(null);

  const [analysis, setAnalysis] =
    useState(null);

  const [selectedSheet, setSelectedSheet] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [openSection, setOpenSection] =
    useState("overview");

  const [showCharts, setShowCharts] =
    useState(false);

  // AI Data Analyst workspace mode (additive; existing sections preserved)
  const [analystMode, setAnalystMode] = useState("overview");
  const [profileSearch, setProfileSearch] = useState("");
  const [profileTypeFilter, setProfileTypeFilter] = useState("all");
  const [profileSort, setProfileSort] = useState("missing");

  // AI Data Scientist workspace (additive; existing Analytics preserved)
  const [scientistReport, setScientistReport] = useState(null);
  const [scientistLoading, setScientistLoading] = useState(false);
  const [scientistError, setScientistError] = useState("");
  const [scientistQuestion, setScientistQuestion] = useState("");
  const [scientistAnswer, setScientistAnswer] = useState("");
  const [scientistChatLoading, setScientistChatLoading] = useState(false);



  // =====================================================
  // LOAD DATASETS
  // =====================================================

  const loadDatasets = async () => {

    try {

      setLoading(true);
      setError("");

      const response =
        await DatasetAPI.get("/datasets");

      const list =
        Array.isArray(
          response.data?.datasets
        )
          ? response.data.datasets
          : [];

      setDatasets(list);

      if (list.length === 0) {

        setSelectedDataset(null);
        setAnalysis(null);

        setError(
          "No datasets found. Please upload a dataset first."
        );

        return;
      }

      const savedId =
        localStorage.getItem(
          "selectedDatasetId"
        );

      let selected =
        list.find(
          item =>
            String(item.id) ===
            String(savedId)
        );

      if (!selected) {
        selected = list[0];
      }

      setSelectedDataset(selected);

      localStorage.setItem(
        "selectedDatasetId",
        selected.id
      );

      localStorage.setItem(
        "selectedDatasetName",
        selected.fileName
      );

    } catch (err) {

      console.error(
        "LOAD DATASETS ERROR:",
        err
      );

      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to load datasets. Please check the backend server."
      );

    } finally {

      setLoading(false);

    }
  };


  // =====================================================
  // ANALYZE DATASET
  // =====================================================

  const analyzeDataset = async (
    dataset,
    sheet = ""
  ) => {

    if (!dataset?.id) {
      return;
    }

    try {

      setAnalyzing(true);
      setError("");

      let url =
        `/datasets/${dataset.id}/analyze`;

      if (sheet) {

        url +=
          `?sheet=${encodeURIComponent(sheet)}`;

      }

      console.log(
        "Analytics API:",
        url
      );

      const response =
        await DatasetAPI.get(url);

      console.log(
        "Analytics response:",
        response.data
      );

      setAnalysis(
        response.data || null
      );

      localStorage.setItem(
        "selectedDatasetId",
        dataset.id
      );

      localStorage.setItem(
        "selectedDatasetName",
        dataset.fileName
      );

    } catch (err) {

      console.error(
        "ANALYTICS ERROR:",
        err
      );

      setAnalysis(null);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to analyze this dataset."
      );

    } finally {

      setAnalyzing(false);

    }
  };


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    loadDatasets();

  }, []);


  // =====================================================
  // ANALYZE WHEN DATASET OR SHEET CHANGES
  // =====================================================

  useEffect(() => {

    if (selectedDataset?.id) {

      analyzeDataset(
        selectedDataset,
        selectedSheet
      );

    }

  }, [
    selectedDataset?.id,
    selectedSheet
  ]);


  // =====================================================
  // DATASET CHANGE
  // =====================================================

  const handleDatasetChange = (
    event
  ) => {

    const selectedId =
      event.target.value;

    const dataset =
      datasets.find(
        item =>
          String(item.id) ===
          String(selectedId)
      );

    if (!dataset) {
      return;
    }

    setSelectedDataset(dataset);

    setSelectedSheet("");

    setAnalysis(null);

    localStorage.setItem(
      "selectedDatasetId",
      dataset.id
    );

    localStorage.setItem(
      "selectedDatasetName",
      dataset.fileName
    );

  };


  // =====================================================
  // SHEET CHANGE
  // =====================================================

  const handleSheetChange = (
    event
  ) => {

    setSelectedSheet(
      event.target.value
    );

  };


  // =====================================================
  // AI DATA SCIENTIST
  // =====================================================

  const runAIScientist = async () => {
    if (!selectedDataset?.id) return;

    try {
      setScientistLoading(true);
      setScientistError("");

      const response = await DatasetAPI.post("/ai-scientist", {
        datasetId: selectedDataset.id,
        sheet: selectedSheet || "",
      });

      setScientistReport(response.data?.report || null);
    } catch (err) {
      console.error("AI DATA SCIENTIST ERROR:", err);
      setScientistReport(null);
      setScientistError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to generate the AI Data Scientist report."
      );
    } finally {
      setScientistLoading(false);
    }
  };

  const askAIScientist = async () => {
    const question = scientistQuestion.trim();
    if (!selectedDataset?.id || !question) return;

    try {
      setScientistChatLoading(true);
      setScientistError("");

      const response = await DatasetAPI.post("/chat", {
        datasetId: selectedDataset.id,
        question,
      });

      setScientistAnswer(response.data?.answer || "No answer returned.");
    } catch (err) {
      console.error("AI SCIENTIST CHAT ERROR:", err);
      setScientistAnswer("");
      setScientistError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to answer the question."
      );
    } finally {
      setScientistChatLoading(false);
    }
  };

  // =====================================================
  // REFRESH
  // =====================================================

  const handleRefresh = () => {

    setAnalysis(null);

    loadDatasets();

  };


  // =====================================================
  // TOGGLE SECTION
  // =====================================================

  const toggleSection = (
    section
  ) => {

    setOpenSection(
      previous =>
        previous === section
          ? ""
          : section
    );

  };


  // =====================================================
  // SAFE VALUES
  // =====================================================

  const summary =
    analysis?.summary || {};

  const rows =
    Number(
      summary.rows ??
      analysis?.dataset?.rows ??
      0
    );

  const columns =
    Number(
      summary.columns ??
      analysis?.dataset?.columns ??
      0
    );

  const missingCount =
    Number(
      summary.totalMissingValues ??
      0
    );

  const duplicateCount =
    Number(
      summary.duplicateRows ??
      0
    );

  const continuationCount =
    Number(
      summary.continuationRows ??
      0
    );

  const qualityScore =
    Number(
      summary.dataQualityScore ??
      100
    );


  // =====================================================
  // SHEETS
  // =====================================================

  const availableSheets =
    Array.isArray(
      analysis?.availableSheets
    )
      ? analysis.availableSheets
      : (
        Array.isArray(
          selectedDataset?.sheets
        )
          ? selectedDataset.sheets
          : []
      );


  // =====================================================
  // COLUMN DATA
  // =====================================================

  const columnKinds =
    analysis?.columnKinds || {};

  const dataTypes =
    analysis?.dataTypes || {};

  const missingValues =
    analysis?.missingValues || {};

  const missingPercentage =
    analysis?.missingPercentage || {};

  const statistics =
    analysis?.statistics || {};

  const recommendations =
    Array.isArray(
      analysis?.cleaningRecommendations
    )
      ? analysis.cleaningRecommendations
      : [];


  const insights =
    Array.isArray(
      analysis?.insights
    )
      ? analysis.insights
      : [];

  const columnProfiles =
    Array.isArray(
      analysis?.columnProfiles
    )
      ? analysis.columnProfiles
      : [];


  // =====================================================
  // AI ANALYST DERIVED METRICS
  // Additive only — uses existing analysis response fields.
  // =====================================================

  const missingRate = rows > 0 && columns > 0
    ? ((missingCount / (rows * columns)) * 100)
    : 0;

  const duplicateRate = rows > 0
    ? ((duplicateCount / rows) * 100)
    : 0;

  const qualityLabel = qualityScore >= 90
    ? "Excellent"
    : qualityScore >= 75
      ? "Good"
      : qualityScore >= 50
        ? "Needs Attention"
        : "Critical";

  const filteredProfiles = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();
    const filtered = columnProfiles.filter(profile => {
      const name = String(profile?.column ?? profile?.name ?? "").toLowerCase();
      const type = String(profile?.detectedType ?? profile?.type ?? profile?.dataType ?? "").toLowerCase();
      const matchesSearch = !query || name.includes(query);
      const matchesType = profileTypeFilter === "all" || type === profileTypeFilter.toLowerCase();
      return matchesSearch && matchesType;
    });

    return [...filtered].sort((a, b) => {
      if (profileSort === "name") {
        return String(a?.column ?? a?.name ?? "").localeCompare(String(b?.column ?? b?.name ?? ""));
      }
      if (profileSort === "unique") {
        return Number(b?.unique ?? b?.uniqueCount ?? 0) - Number(a?.unique ?? a?.uniqueCount ?? 0);
      }
      if (profileSort === "outliers") {
        return Number(b?.outliers ?? 0) - Number(a?.outliers ?? 0);
      }
      return Number(b?.missing ?? b?.missingCount ?? 0) - Number(a?.missing ?? a?.missingCount ?? 0);
    });
  }, [columnProfiles, profileSearch, profileTypeFilter, profileSort]);

  const correlations =
    Array.isArray(
      analysis?.correlations
    )
      ? analysis.correlations
      : [];

  const mlReadiness =
    analysis?.mlReadiness || {};


  // =====================================================
  // NUMERIC / CATEGORICAL / DATE
  // =====================================================

  const numericColumns =
    useMemo(
      () =>
        Object.entries(
          columnKinds
        )
          .filter(
            ([, type]) =>
              type === "numeric"
          )
          .map(
            ([name]) =>
              name
          ),
      [columnKinds]
    );


  const categoricalColumns =
    useMemo(
      () =>
        Object.entries(
          columnKinds
        )
          .filter(
            ([, type]) =>
              type === "categorical"
          )
          .map(
            ([name]) =>
              name
          ),
      [columnKinds]
    );


  const dateColumns =
    useMemo(
      () =>
        Object.entries(
          columnKinds
        )
          .filter(
            ([, type]) =>
              type === "date"
          )
          .map(
            ([name]) =>
              name
          ),
      [columnKinds]
    );


  // =====================================================
  // MISSING COLUMN LIST
  // =====================================================

  const missingColumns =
    useMemo(
      () =>
        Object.entries(
          missingValues
        )
          .filter(
            ([, count]) =>
              Number(count) > 0
          )
          .sort(
            ([, a], [, b]) =>
              Number(b) -
              Number(a)
          ),
      [missingValues]
    );


  // =====================================================
  // RECOMMENDATION COLORS
  // =====================================================

  const recommendationClass = (
    recommendation
  ) => {

    if (
      recommendation?.priority ===
      "HIGH"
    ) {

      return "border-red-500/30 bg-red-500/5";

    }

    if (
      recommendation?.priority ===
      "MEDIUM"
    ) {

      return "border-yellow-500/30 bg-yellow-500/5";

    }

    if (
      recommendation?.priority ===
      "REVIEW"
    ) {

      return "border-orange-500/30 bg-orange-500/5";

    }

    return "border-cyan-500/20 bg-slate-800";

  };


  // =====================================================
  // RECOMMENDATION ICON
  // =====================================================

  const recommendationIcon = (
    recommendation
  ) => {

    if (
      recommendation?.recommended
    ) {

      return (
        <FaCheckCircle
          className="text-green-400"
        />
      );

    }

    if (
      recommendation?.priority ===
      "HIGH"
    ) {

      return (
        <FaExclamationTriangle
          className="text-red-400"
        />
      );

    }

    return (
      <FaExclamationTriangle
        className="text-yellow-400"
      />
    );

  };


  // =====================================================
  // CHART COMPONENT
  // =====================================================

  const SimpleChart = ({
    chart
  }) => {

    const labels =
      Array.isArray(chart?.labels)
        ? chart.labels
        : [];

    const values =
      Array.isArray(chart?.values)
        ? chart.values.map(value => Number(value || 0))
        : [];

    if (
      labels.length === 0 ||
      values.length === 0
    ) {
      return (
        <div className="text-gray-500 text-center py-10">
          No chart data available.
        </div>
      );
    }

    const maxValue =
      Math.max(
        ...values,
        1
      );

    return (
      <div className="bg-slate-950 rounded-2xl p-5 border border-slate-700">

        <h3 className="text-lg font-bold mb-5">
          {chart.title}
        </h3>

        <div className="space-y-4">

          {labels
            .slice(0, 12)
            .map(
              (
                label,
                index
              ) => {

                const value =
                  values[index] || 0;

                const percentage =
                  Math.max(
                    2,
                    (value / maxValue) * 100
                  );

                return (
                  <div
                    key={`${label}-${index}`}
                  >

                    <div className="flex justify-between gap-3 text-sm mb-1">

                      <span className="text-gray-300 truncate max-w-[70%]">
                        {label}
                      </span>

                      <span className="text-cyan-300 font-semibold">
                        {Number.isFinite(value)
                          ? Number.isInteger(value)
                            ? value
                            : value.toFixed(2)
                          : "-"}
                      </span>

                    </div>

                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">

                      <motion.div
                        initial={{
                          width: 0
                        }}
                        animate={{
                          width: `${percentage}%`
                        }}
                        transition={{
                          duration: 0.7,
                          delay: index * 0.04
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
                      />

                    </div>

                  </div>
                );

              }
            )}

        </div>

      </div>
    );
  };

  // =====================================================
  // CORRELATION CHART
  // =====================================================

  const CorrelationChart = ({
    chart
  }) => {

    const chartRows =
      Array.isArray(
        chart?.data
      )
        ? chart.data
        : [];

    if (
      chartRows.length === 0
    ) {

      return null;

    }

    return (

      <div className="bg-slate-950 rounded-2xl p-5 border border-slate-700 overflow-x-auto">

        <h3 className="text-lg font-bold mb-5">
          {chart.title}
        </h3>

        <table className="min-w-full text-xs">

          <thead>

            <tr>

              <th className="p-2 text-left text-gray-400">
                Feature
              </th>

              {(
                chart.columns || []
              ).map(
                column => (

                  <th
                    key={column}
                    className="p-2 text-gray-400 whitespace-nowrap"
                  >
                    {column}
                  </th>

                )
              )}

            </tr>

          </thead>

          <tbody>

            {chartRows.map(
              row => (

                <tr
                  key={row.row}
                  className="border-t border-slate-800"
                >

                  <td className="p-2 font-semibold text-gray-300 whitespace-nowrap">
                    {row.row}
                  </td>

                  {(
                    row.values || []
                  ).map(
                    item => {

                      const value =
                        Number(
                          item.value
                        );

                      let intensity =
                        Math.abs(
                          value
                        );

                      if (
                        !Number.isFinite(
                          intensity
                        )
                      ) {
                        intensity = 0;
                      }

                      intensity =
                        Math.min(
                          1,
                          intensity
                        );

                      return (

                        <td
                          key={
                            item.column
                          }
                          className="p-2 text-center font-semibold"
                        >

                          <div
                            className="rounded-lg px-2 py-2 bg-cyan-500/10"
                            style={{
                              opacity:
                                0.35 +
                                intensity *
                                0.65
                            }}
                          >

                            {Number.isFinite(
                              value
                            )
                              ? value.toFixed(
                                  2
                                )
                              : "-"}

                          </div>

                        </td>

                      );

                    }
                  )}

                </tr>

              )
            )}

          </tbody>

        </table>

      </div>

    );

  };


  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (

    <>

      <Navbar />

      <div className="min-h-screen bg-slate-950 text-white pt-28 px-5 md:px-8 pb-16">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="max-w-7xl mx-auto">

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">

            <div>

              <button
                onClick={() =>
                  navigate("/dashboard")
                }
                className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 mb-5 transition"
              >

                <FaArrowLeft />

                Back to Dashboard

              </button>

              <div className="flex items-center gap-3 mb-3">

                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">

                  <FaChartBar className="text-cyan-400 text-xl" />

                </div>

                <span className="text-cyan-400 font-semibold">
                  Analysis Complete ✓
                </span>

              </div>

              <h1 className="text-4xl md:text-5xl font-black">

                Data{" "}

                <span className="text-cyan-400">
                  Analytics
                </span>

              </h1>

              <p className="text-gray-400 mt-3 text-lg">

                Intelligent dataset profiling, quality analysis and visual insights.

              </p>

            </div>


            <button
              onClick={
                handleRefresh
              }
              disabled={
                loading ||
                analyzing
              }
              className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 px-6 py-3 rounded-xl font-bold transition disabled:opacity-50"
            >

              <FaSyncAlt
                className={
                  loading ||
                  analyzing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh

            </button>

          </div>


          {/* =================================================
              DATASET SELECTOR
          ================================================= */}

          <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl p-6 mb-6">

            <div className="grid lg:grid-cols-2 gap-5">

              <div>

                <div className="flex items-center gap-3 mb-3">

                  <FaDatabase className="text-cyan-400" />

                  <label className="font-bold">
                    Select Dataset
                  </label>

                </div>

                <select
                  value={
                    selectedDataset?.id ||
                    ""
                  }
                  onChange={
                    handleDatasetChange
                  }
                  disabled={
                    loading ||
                    datasets.length === 0
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-cyan-400"
                >

                  {datasets.length === 0 ? (

                    <option value="">
                      No datasets found
                    </option>

                  ) : (

                    datasets.map(
                      dataset => (

                        <option
                          key={
                            dataset.id
                          }
                          value={
                            dataset.id
                          }
                        >
                          {
                            dataset.fileName
                          }
                        </option>

                      )
                    )

                  )}

                </select>

              </div>


              {/* =================================================
                  SHEET SELECTOR
              ================================================= */}

              <div>

                <div className="flex items-center gap-3 mb-3">

                  <FaLayerGroup className="text-purple-400" />

                  <label className="font-bold">
                    Select Sheet
                  </label>

                </div>

                <select
                  value={
                    selectedSheet
                  }
                  onChange={
                    handleSheetChange
                  }
                  disabled={
                    analyzing ||
                    availableSheets.length === 0
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-purple-400"
                >

                  <option value="">
                    {availableSheets.length
                      ? "First Sheet"
                      : "Single Dataset"}
                  </option>

                  {availableSheets.map(
                    sheet => (

                      <option
                        key={sheet}
                        value={sheet}
                      >
                        {sheet}
                      </option>

                    )
                  )}

                </select>

              </div>

            </div>


            {selectedDataset && (

              <div className="flex flex-wrap items-center gap-3 mt-5 text-sm text-gray-400">

                <div className="flex items-center gap-2">

                  <FaFileExcel className="text-green-400" />

                  {selectedDataset.fileName}

                </div>

                {availableSheets.length > 0 && (

                  <span className="bg-slate-800 px-3 py-1 rounded-full">

                    {availableSheets.length} sheets

                  </span>

                )}

              </div>

            )}

          </div>


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (

            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-6">

              <div className="flex items-start gap-3">

                <FaExclamationTriangle className="text-red-400 mt-1" />

                <div>

                  <h3 className="font-bold text-red-400">
                    Analytics Error
                  </h3>

                  <p className="text-gray-300 mt-1">
                    {error}
                  </p>

                </div>

              </div>

            </div>

          )}


          {/* =================================================
              LOADING
          ================================================= */}

          {(loading ||
            analyzing) && (

            <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl p-12 text-center">

              <FaSyncAlt className="mx-auto text-5xl text-cyan-400 animate-spin mb-5" />

              <h2 className="text-xl font-bold text-cyan-400">

                {loading
                  ? "Loading datasets..."
                  : "Analyzing dataset..."}

              </h2>

              <p className="text-gray-400 mt-2">

                NexusDS AI is profiling your data.

              </p>

            </div>

          )}


          {/* =================================================
              NO DATA
          ================================================= */}

          {!loading &&
            !analyzing &&
            !selectedDataset &&
            !error && (

            <div className="bg-slate-900 rounded-3xl p-12 text-center">

              <FaDatabase className="mx-auto text-6xl text-gray-600 mb-5" />

              <h2 className="text-2xl font-bold">
                No Dataset Selected
              </h2>

              <button
                onClick={() =>
                  navigate("/dataset")
                }
                className="mt-6 bg-cyan-500 hover:bg-cyan-600 px-7 py-3 rounded-xl font-bold"
              >
                Upload Dataset
              </button>

            </div>

          )}


          {/* =================================================
              ANALYSIS
          ================================================= */}

          {!loading &&
            !analyzing &&
            analysis && (

            <div className="space-y-6">

              {/* =================================================
                  AI DATA ANALYST WORKSPACE — ADDITIVE LAYER
              ================================================= */}

              <div className="bg-slate-950 border border-cyan-500/20 rounded-3xl overflow-hidden shadow-xl">

                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                          <FaRobot className="text-cyan-400 text-lg" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black">AI Data Analyst Workspace</h2>
                          <p className="text-sm text-gray-500 mt-1">
                            A focused view of the same analysis already generated by NexusDS AI.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        ["overview", "Overview"],
                        ["quality", "Data Quality"],
                        ["findings", "AI Findings"],
                        ["profiler", "Column Profiler"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setAnalystMode(key)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                            analystMode === key
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-slate-900 text-gray-400 border border-slate-700 hover:border-cyan-500/40 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {analystMode === "overview" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-slate-900 rounded-2xl p-5 border border-cyan-500/10">
                          <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Dataset Health</p>
                          <p className="text-2xl font-black text-cyan-400 mt-2">{qualityScore.toFixed(0)}%</p>
                          <p className="text-xs text-gray-500 mt-1">{qualityLabel}</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 border border-yellow-500/10">
                          <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Missing Rate</p>
                          <p className="text-2xl font-black text-yellow-400 mt-2">{missingRate.toFixed(2)}%</p>
                          <p className="text-xs text-gray-500 mt-1">Across all cells</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 border border-purple-500/10">
                          <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Duplicate Rate</p>
                          <p className="text-2xl font-black text-purple-400 mt-2">{duplicateRate.toFixed(2)}%</p>
                          <p className="text-xs text-gray-500 mt-1">Of dataset rows</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 border border-green-500/10">
                          <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">AI Signals</p>
                          <p className="text-2xl font-black text-green-400 mt-2">{insights.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Existing findings</p>
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <FaBullseye className="text-cyan-400" />
                          <h3 className="font-black">Analyst Focus</h3>
                        </div>
                        <p className="text-sm text-gray-400 leading-6">
                          Start with data quality, then review AI findings and the columns with the highest missing-value impact before moving into cleaning or modeling.
                        </p>
                      </div>
                    </div>
                  )}

                  {analystMode === "quality" && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-slate-900 rounded-2xl p-5 border border-cyan-500/10">
                        <p className="text-gray-500 text-sm">Quality Score</p>
                        <p className="text-3xl font-black text-cyan-400 mt-2">{qualityScore.toFixed(0)}%</p>
                        <p className="text-sm text-gray-400 mt-1">{qualityLabel}</p>
                      </div>
                      <div className="bg-slate-900 rounded-2xl p-5 border border-yellow-500/10">
                        <p className="text-gray-500 text-sm">Missing Cells</p>
                        <p className="text-3xl font-black text-yellow-400 mt-2">{missingCount}</p>
                        <p className="text-sm text-gray-400 mt-1">{missingRate.toFixed(2)}% cell-level rate</p>
                      </div>
                      <div className="bg-slate-900 rounded-2xl p-5 border border-purple-500/10">
                        <p className="text-gray-500 text-sm">Duplicate Rows</p>
                        <p className="text-3xl font-black text-purple-400 mt-2">{duplicateCount}</p>
                        <p className="text-sm text-gray-400 mt-1">{duplicateRate.toFixed(2)}% row-level rate</p>
                      </div>
                    </div>
                  )}

                  {analystMode === "findings" && (
                    <div className="space-y-3">
                      {insights.length > 0 ? insights.map((insight, index) => (
                        <div key={index} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                              <FaRobot className="text-cyan-400 text-sm" />
                            </div>
                            <p className="text-sm text-gray-300 leading-6">
                              {typeof insight === "string" ? insight : (insight?.message || insight?.text || JSON.stringify(insight))}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-gray-500">No AI findings were returned for this dataset.</div>
                      )}
                    </div>
                  )}

                  {analystMode === "profiler" && (
                    <div className="space-y-3">
                      {filteredProfiles.length > 0 ? filteredProfiles.slice(0, 12).map((profile, index) => (
                        <div key={profile?.name || profile?.column || index} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <p className="font-bold break-all">{profile?.name || profile?.column || `Column ${index + 1}`}</p>
                              <p className="text-xs text-gray-500 mt-1">{profile?.type || profile?.dataType || "Detected column"}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-400">Missing: <b className="text-yellow-400">{Number(profile?.missing ?? profile?.missingCount ?? 0)}</b></span>
                              {profile?.unique !== undefined && <span className="text-gray-400">Unique: <b className="text-cyan-400">{profile.unique}</b></span>}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-gray-500">No column profiles were returned.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* =================================================
                  AI DATA SCIENTIST — ADDITIVE INTELLIGENCE LAYER
              ================================================= */}

              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 border border-purple-500/20 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                        <FaBrain className="text-purple-400 text-xl" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black">AI Data Scientist</h2>
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">NexusDS AI</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Converts the current dataset analysis into an actionable data-science plan.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={runAIScientist}
                      disabled={!selectedDataset?.id || scientistLoading || analyzing}
                      className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-400 text-white px-6 py-3 rounded-xl font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scientistLoading ? <FaSyncAlt className="animate-spin" /> : <FaPlay />}
                      {scientistLoading ? "Thinking..." : "Run AI Scientist"}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {scientistError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300">
                      {scientistError}
                    </div>
                  )}

                  {scientistReport ? (
                    <>
                      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                        <div className="bg-slate-900 rounded-2xl p-4 border border-cyan-500/10">
                          <p className="text-xs text-gray-500 uppercase font-bold">Health</p>
                          <p className="text-2xl font-black text-cyan-400 mt-1">{Number(scientistReport.healthScore ?? qualityScore).toFixed(0)}%</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-yellow-500/10">
                          <p className="text-xs text-gray-500 uppercase font-bold">Risks</p>
                          <p className="text-2xl font-black text-yellow-400 mt-1">{(scientistReport.risks || []).length}</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-purple-500/10">
                          <p className="text-xs text-gray-500 uppercase font-bold">ML Targets</p>
                          <p className="text-2xl font-black text-purple-400 mt-1">{(scientistReport.targetCandidates || []).length}</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-green-500/10">
                          <p className="text-xs text-gray-500 uppercase font-bold">Actions</p>
                          <p className="text-2xl font-black text-green-400 mt-1">{(scientistReport.actions || []).length}</p>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 border border-blue-500/10 col-span-2 xl:col-span-1">
                          <p className="text-xs text-gray-500 uppercase font-bold">Rows</p>
                          <p className="text-2xl font-black text-blue-400 mt-1">{Number(scientistReport.rows || rows).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                          <div className="flex items-center gap-2 mb-3"><FaLightbulb className="text-yellow-400" /><h3 className="font-black">Executive Assessment</h3></div>
                          <p className="text-sm text-gray-300 leading-6">{scientistReport.executiveSummary || "No summary returned."}</p>
                          {scientistReport.narrative && <p className="text-sm text-gray-400 leading-6 mt-4 whitespace-pre-line">{scientistReport.narrative}</p>}
                        </div>

                        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                          <div className="flex items-center gap-2 mb-3"><FaRocket className="text-cyan-400" /><h3 className="font-black">Recommended Next Step</h3></div>
                          <p className="text-sm text-cyan-200 font-bold">{scientistReport.nextStep || "Review the dataset and proceed to the recommended workflow."}</p>
                          {scientistReport.mlRecommendation && (
                            <div className="mt-4 bg-slate-800 rounded-xl p-4">
                              <p className="text-xs text-gray-500 uppercase font-bold">ML Recommendation</p>
                              <p className="text-sm text-gray-300 mt-2">{scientistReport.mlRecommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-3 gap-4">
                        <div className="bg-slate-900 rounded-2xl p-5 border border-red-500/10">
                          <h3 className="font-black text-red-300 mb-3">Priority Risks</h3>
                          {(scientistReport.risks || []).length ? (
                            <ul className="space-y-2 text-sm text-gray-300">{scientistReport.risks.slice(0, 8).map((item, i) => <li key={i}>⚠ {item}</li>)}</ul>
                          ) : <p className="text-sm text-green-300">No major risks detected.</p>}
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 border border-yellow-500/10">
                          <h3 className="font-black text-yellow-300 mb-3">Recommended Actions</h3>
                          {(scientistReport.actions || []).length ? (
                            <ul className="space-y-2 text-sm text-gray-300">{scientistReport.actions.slice(0, 8).map((item, i) => <li key={i}>→ {item}</li>)}</ul>
                          ) : <p className="text-sm text-gray-400">No additional actions returned.</p>}
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-5 border border-purple-500/10">
                          <h3 className="font-black text-purple-300 mb-3">Target Candidates</h3>
                          {(scientistReport.targetCandidates || []).length ? (
                            <div className="space-y-2">{scientistReport.targetCandidates.slice(0, 8).map((item, i) => <div key={i} className="bg-slate-800 rounded-xl p-3"><p className="font-bold text-sm">{item.column}</p><p className="text-xs text-gray-500 mt-1">{item.type || "candidate"} · {item.reason || "Potential modeling target"}</p></div>)}</div>
                          ) : <p className="text-sm text-gray-400">No clear target candidate detected.</p>}
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-2xl p-5 border border-cyan-500/10">
                        <div className="flex items-center gap-2 mb-3"><FaComments className="text-cyan-400" /><h3 className="font-black">Ask the AI Data Scientist</h3></div>
                        <div className="flex flex-col md:flex-row gap-3">
                          <input
                            value={scientistQuestion}
                            onChange={event => setScientistQuestion(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter" && !scientistChatLoading) askAIScientist(); }}
                            placeholder="Ask about trends, cleaning, ML, columns or business meaning..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-cyan-400"
                          />
                          <button onClick={askAIScientist} disabled={!scientistQuestion.trim() || scientistChatLoading} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-6 py-3 rounded-xl font-black disabled:opacity-50">
                            {scientistChatLoading ? "Thinking..." : "Ask AI"}
                          </button>
                        </div>
                        {scientistAnswer && <div className="mt-4 bg-slate-800 rounded-xl p-4 text-sm text-gray-200 leading-6 whitespace-pre-line">{scientistAnswer}</div>}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FaBrain className="mx-auto text-4xl text-purple-400 mb-3" />
                      <p className="font-bold">AI Data Scientist is ready.</p>
                      <p className="text-sm text-gray-500 mt-2">Run it to turn the current analysis into a prioritized data-science plan.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* =================================================
                  TOP CARDS
              ================================================= */}

              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">

                {/* ROWS */}

                <motion.div
                  whileHover={{
                    y: -3
                  }}
                  className="bg-slate-900 border border-cyan-500/20 rounded-2xl p-5"
                >

                  <FaTable className="text-cyan-400 text-2xl mb-3" />

                  <p className="text-gray-400 text-sm">
                    Total Rows
                  </p>

                  <h2 className="text-3xl font-black mt-1">
                    {rows}
                  </h2>

                </motion.div>


                {/* COLUMNS */}

                <motion.div
                  whileHover={{
                    y: -3
                  }}
                  className="bg-slate-900 border border-purple-500/20 rounded-2xl p-5"
                >

                  <FaColumns className="text-purple-400 text-2xl mb-3" />

                  <p className="text-gray-400 text-sm">
                    Total Columns
                  </p>

                  <h2 className="text-3xl font-black mt-1">
                    {columns}
                  </h2>

                </motion.div>


                {/* MISSING */}

                <motion.div
                  whileHover={{
                    y: -3
                  }}
                  className="bg-slate-900 border border-yellow-500/20 rounded-2xl p-5"
                >

                  <FaExclamationTriangle className="text-yellow-400 text-2xl mb-3" />

                  <p className="text-gray-400 text-sm">
                    Missing Cells
                  </p>

                  <h2 className="text-3xl font-black mt-1">
                    {missingCount}
                  </h2>

                </motion.div>


                {/* DUPLICATES */}

                <motion.div
                  whileHover={{
                    y: -3
                  }}
                  className="bg-slate-900 border border-red-500/20 rounded-2xl p-5"
                >

                  <FaCopy className="text-red-400 text-2xl mb-3" />

                  <p className="text-gray-400 text-sm">
                    Duplicate Rows
                  </p>

                  <h2 className="text-3xl font-black mt-1">
                    {duplicateCount}
                  </h2>

                </motion.div>


                {/* QUALITY */}

                <motion.div
                  whileHover={{
                    y: -3
                  }}
                  className="bg-slate-900 border border-green-500/20 rounded-2xl p-5 col-span-2 xl:col-span-1"
                >

                  <FaCheckCircle className="text-green-400 text-2xl mb-3" />

                  <p className="text-gray-400 text-sm">
                    Data Health
                  </p>

                  <h2 className="text-3xl font-black mt-1 text-green-400">
                    {qualityScore}%
                  </h2>

                </motion.div>

              </div>


              {/* =================================================
                  DATASET INFO
              ================================================= */}

              <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "overview"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaDatabase className="text-cyan-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Dataset Overview
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Current sheet and dataset health
                      </p>

                    </div>

                  </div>

                  {openSection ===
                  "overview"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {openSection ===
                    "overview" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      <div className="grid md:grid-cols-3 gap-4">

                        <div className="bg-slate-800 rounded-xl p-4">

                          <p className="text-gray-500 text-sm">
                            File
                          </p>

                          <p className="font-bold mt-1 break-all">
                            {
                              analysis.dataset?.fileName ||
                              selectedDataset?.fileName ||
                              "Unknown"
                            }
                          </p>

                        </div>

                        <div className="bg-slate-800 rounded-xl p-4">

                          <p className="text-gray-500 text-sm">
                            Current Sheet
                          </p>

                          <p className="font-bold mt-1">
                            {
                              analysis.dataset?.sheetName ||
                              availableSheets[0] ||
                              "CSV"
                            }
                          </p>

                        </div>

                        <div className="bg-slate-800 rounded-xl p-4">

                          <p className="text-gray-500 text-sm">
                            Continuation Rows
                          </p>

                          <p className="font-bold mt-1 text-purple-400">
                            {continuationCount}
                          </p>

                        </div>

                      </div>

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  MISSING VALUE ANALYSIS
              ================================================= */}

              <div className="bg-slate-900 border border-yellow-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "missing"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaExclamationTriangle className="text-yellow-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Missing Value Analysis
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        {missingCount} blank cells detected
                      </p>

                    </div>

                  </div>

                  {openSection ===
                  "missing"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {openSection ===
                    "missing" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      {missingColumns.length === 0 ? (

                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 flex items-center gap-3">

                          <FaCheckCircle className="text-green-400" />

                          <span>
                            No missing values detected.
                          </span>

                        </div>

                      ) : (

                        <div className="space-y-3">

                          {missingColumns.map(
                            (
                              [
                                column,
                                count
                              ]
                            ) => {

                              const percentage =
                                Number(
                                  missingPercentage[
                                    column
                                  ] || 0
                                );

                              const type =
                                columnKinds[
                                  column
                                ] ||
                                "unknown";

                              const isBusiness =
                                [
                                  "approval",
                                  "approved",
                                  "po",
                                  "end date",
                                  "done",
                                  "cancel",
                                  "pending",
                                  "remarks",
                                  "status"
                                ].some(
                                  word =>
                                    column
                                      .toLowerCase()
                                      .includes(
                                        word
                                      )
                                );

                              return (

                                <div
                                  key={
                                    column
                                  }
                                  className="bg-slate-800 rounded-xl p-4"
                                >

                                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                                    <div>

                                      <p className="font-bold">
                                        {column}
                                      </p>

                                      <p className="text-sm text-gray-500 mt-1">
                                        Type:{" "}
                                        {type}
                                      </p>

                                    </div>

                                    <div className="flex items-center gap-3">

                                      <span className="text-yellow-300 font-bold">
                                        {count} missing
                                      </span>

                                      <span className="text-gray-500">
                                        {percentage}%
                                      </span>

                                    </div>

                                  </div>

                                  <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">

                                    <div
                                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                                      style={{
                                        width:
                                          `${Math.min(
                                            100,
                                            percentage
                                          )}%`
                                      }}
                                    />

                                  </div>

                                  <div className="mt-3 text-sm">

                                    {isBusiness ? (

                                      <span className="text-yellow-300">

                                        ⚠ Review — this blank may have business meaning. Do not invent a value automatically.

                                      </span>

                                    ) : type ===
                                      "numeric" ? (

                                      <span className="text-green-300">

                                        ✓ Numeric column — median may be suitable if the missingness is not meaningful.

                                      </span>

                                    ) : type ===
                                      "categorical" ? (

                                      <span className="text-green-300">

                                        ✓ Categorical column — mode may be suitable when appropriate.

                                      </span>

                                    ) : (

                                      <span className="text-yellow-300">

                                        ⚠ Review before filling.

                                      </span>

                                    )}

                                  </div>

                                </div>

                              );

                            }
                          )}

                        </div>

                      )}

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  COLUMN TYPES
              ================================================= */}

              <div className="bg-slate-900 border border-purple-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "columns"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaColumns className="text-purple-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Data Types & Columns
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Automatically detected column types
                      </p>

                    </div>

                  </div>

                  {openSection ===
                  "columns"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {openSection ===
                    "columns" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      <div className="grid md:grid-cols-3 gap-4 mb-6">

                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-5">

                          <p className="text-gray-400">
                            Numeric
                          </p>

                          <p className="text-3xl font-black text-cyan-400 mt-1">
                            {
                              numericColumns.length
                            }
                          </p>

                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">

                          <p className="text-gray-400">
                            Categorical
                          </p>

                          <p className="text-3xl font-black text-purple-400 mt-1">
                            {
                              categoricalColumns.length
                            }
                          </p>

                        </div>

                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">

                          <p className="text-gray-400">
                            Date
                          </p>

                          <p className="text-3xl font-black text-green-400 mt-1">
                            {
                              dateColumns.length
                            }
                          </p>

                        </div>

                      </div>


                      <div className="overflow-x-auto">

                        <table className="w-full text-left">

                          <thead>

                            <tr className="border-b border-slate-700">

                              <th className="py-3 px-3 text-gray-500">
                                Column
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Detected Type
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Missing
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Raw Type
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {Object.keys(
                              columnKinds
                            ).map(
                              column => (

                                <tr
                                  key={
                                    column
                                  }
                                  className="border-b border-slate-800"
                                >

                                  <td className="py-3 px-3 font-semibold">
                                    {column}
                                  </td>

                                  <td className="py-3 px-3">

                                    <span className="bg-slate-800 px-3 py-1 rounded-full text-cyan-300">
                                      {
                                        columnKinds[
                                          column
                                        ]
                                      }
                                    </span>

                                  </td>

                                  <td className="py-3 px-3">

                                    {
                                      missingValues[
                                        column
                                      ] || 0
                                    }

                                  </td>

                                  <td className="py-3 px-3 text-gray-500">
                                    {
                                      dataTypes[
                                        column
                                      ] || "-"
                                    }
                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  DATA INSIGHTS
              ================================================= */}

              <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "insights"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaRobot className="text-cyan-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        AI-Ready Data Insights
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Patterns, anomalies, relationships and quality findings extracted from the actual dataset
                      </p>

                    </div>

                  </div>

                  {openSection === "insights"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>

                <AnimatePresence>

                  {openSection === "insights" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      <div className="grid lg:grid-cols-2 gap-4">

                        {insights.map(
                          (insight, index) => (

                            <div
                              key={`insight-${index}`}
                              className="bg-slate-800 rounded-2xl p-5 border border-slate-700"
                            >

                              <div className="flex items-start gap-3">

                                <div className="text-xl">
                                  {insight.type === "positive"
                                    ? "✓"
                                    : insight.type === "warning"
                                      ? "⚠"
                                      : insight.type === "relationship"
                                        ? "↔"
                                        : "ℹ"}
                                </div>

                                <div>

                                  <h3 className="font-bold">
                                    {insight.title}
                                  </h3>

                                  <p className="text-gray-400 text-sm mt-2 leading-6">
                                    {insight.message}
                                  </p>

                                </div>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                      {correlations.length > 0 && (

                        <div className="mt-5 bg-slate-800 rounded-2xl p-5">

                          <h3 className="font-bold mb-4">
                            Strong Numeric Relationships
                          </h3>

                          <div className="space-y-3">

                            {correlations.map(
                              (item, index) => (

                                <div
                                  key={`corr-${index}`}
                                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-700 last:border-0 pb-3 last:pb-0"
                                >

                                  <span className="text-gray-300">
                                    {item.feature1}
                                    {" ↔ "}
                                    {item.feature2}
                                  </span>

                                  <span className="text-cyan-300 font-bold">
                                    {Number(item.correlation).toFixed(2)}
                                  </span>

                                </div>

                              )
                            )}

                          </div>

                        </div>

                      )}

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  COLUMN PROFILE
              ================================================= */}

              <div className="bg-slate-900 border border-blue-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() => toggleSection("profiles")}
                  className="w-full p-6 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <FaColumns className="text-blue-400" />
                    <div>
                      <h2 className="text-xl font-bold">Column Intelligence</h2>
                      <p className="text-gray-500 text-sm mt-1">
                        Search, filter and inspect column quality signals
                      </p>
                    </div>
                  </div>
                  {openSection === "profiles" ? <FaChevronUp /> : <FaChevronDown />}
                </button>

                <AnimatePresence>
                  {openSection === "profiles" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6"
                    >
                      <div className="grid md:grid-cols-3 gap-3 mb-5">
                        <div className="md:col-span-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Search column</label>
                          <div className="relative">
                            <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                              value={profileSearch}
                              onChange={event => setProfileSearch(event.target.value)}
                              placeholder="e.g. age, revenue, status"
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Type</label>
                          <select
                            value={profileTypeFilter}
                            onChange={event => setProfileTypeFilter(event.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm outline-none focus:border-cyan-400"
                          >
                            <option value="all">All types</option>
                            <option value="numeric">Numeric</option>
                            <option value="categorical">Categorical</option>
                            <option value="date">Date</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Sort by</label>
                          <select
                            value={profileSort}
                            onChange={event => setProfileSort(event.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm outline-none focus:border-cyan-400"
                          >
                            <option value="missing">Highest missing</option>
                            <option value="outliers">Highest outliers</option>
                            <option value="unique">Highest unique</option>
                            <option value="name">Column name</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3 text-sm">
                        <span className="text-gray-500">Showing <b className="text-gray-300">{filteredProfiles.length}</b> of {columnProfiles.length} columns</span>
                        {(profileSearch || profileTypeFilter !== "all") && (
                          <button
                            onClick={() => { setProfileSearch(""); setProfileTypeFilter("all"); }}
                            className="text-cyan-400 hover:text-cyan-300 font-bold"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>

                      {filteredProfiles.length === 0 ? (
                        <div className="bg-slate-800 rounded-2xl p-8 text-center text-gray-500">
                          No columns match the selected filters.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="py-3 px-3 text-gray-500">Column</th>
                                <th className="py-3 px-3 text-gray-500">Type</th>
                                <th className="py-3 px-3 text-gray-500">Unique</th>
                                <th className="py-3 px-3 text-gray-500">Missing</th>
                                <th className="py-3 px-3 text-gray-500">Outliers</th>
                                <th className="py-3 px-3 text-gray-500">Mean</th>
                                <th className="py-3 px-3 text-gray-500">Median</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredProfiles.map((profile, index) => {
                                const columnName = profile?.column ?? profile?.name ?? `Column ${index + 1}`;
                                const type = profile?.detectedType ?? profile?.type ?? profile?.dataType ?? "-";
                                const missing = profile?.missing ?? profile?.missingCount ?? 0;
                                const missingPct = profile?.missingPercentage ?? 0;
                                const outliers = profile?.outliers ?? "-";
                                return (
                                  <tr key={`${columnName}-${index}`} className="border-b border-slate-800 hover:bg-slate-800/60 transition">
                                    <td className="py-3 px-3 font-semibold max-w-[220px] truncate" title={columnName}>{columnName}</td>
                                    <td className="py-3 px-3"><span className="bg-slate-800 px-3 py-1 rounded-full text-cyan-300">{type}</span></td>
                                    <td className="py-3 px-3">{profile?.unique ?? 0}</td>
                                    <td className="py-3 px-3">{missing}<span className="text-gray-500 ml-1">({missingPct}%)</span></td>
                                    <td className="py-3 px-3">{outliers}</td>
                                    <td className="py-3 px-3">{profile?.mean ?? "-"}</td>
                                    <td className="py-3 px-3">{profile?.median ?? "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


              {/* =================================================
                  SMART RECOMMENDATIONS
              ================================================= */}

              <div className="bg-slate-900 border border-green-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "recommendations"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaRobot className="text-green-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Smart Cleaning Recommendations
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        AI-assisted suggestions based on dataset structure
                      </p>

                    </div>

                  </div>

                  {openSection ===
                  "recommendations"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {openSection ===
                    "recommendations" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      {recommendations.length ===
                      0 ? (

                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">

                          <div className="flex items-center gap-3">

                            <FaCheckCircle className="text-green-400" />

                            <div>

                              <p className="font-bold">
                                No immediate cleaning recommendations.
                              </p>

                              <p className="text-gray-500 text-sm mt-1">
                                The dataset currently looks structurally healthy.
                              </p>

                            </div>

                          </div>

                        </div>

                      ) : (

                        <div className="space-y-4">

                          {recommendations.map(
                            (
                              recommendation,
                              index
                            ) => (

                              <div
                                key={
                                  recommendation.id ||
                                  index
                                }
                                className={`rounded-2xl border p-5 ${recommendationClass(
                                  recommendation
                                )}`}
                              >

                                <div className="flex items-start gap-4">

                                  <div className="mt-1">

                                    {
                                      recommendationIcon(
                                        recommendation
                                      )
                                    }

                                  </div>

                                  <div className="flex-1">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <h3 className="font-bold">

                                        {
                                          recommendation.title ||
                                          "Recommendation"
                                        }

                                      </h3>

                                      {recommendation.priority && (

                                        <span className="text-xs bg-slate-950/60 px-2 py-1 rounded-full">

                                          {
                                            recommendation.priority
                                          }

                                        </span>

                                      )}

                                    </div>

                                    <p className="text-gray-400 text-sm mt-2">

                                      {
                                        recommendation.reason
                                      }

                                    </p>

                                    {recommendation.action && (

                                      <div className="mt-3">

                                        <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">

                                          Action:{" "}
                                          {
                                            recommendation.action
                                          }

                                        </span>

                                      </div>

                                    )}

                                  </div>

                                </div>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  BASIC STATISTICS
              ================================================= */}

              {Object.keys(
                statistics
              ).length > 0 && (

                <div className="bg-slate-900 border border-blue-500/20 rounded-3xl overflow-hidden">

                  <button
                    onClick={() =>
                      toggleSection(
                        "statistics"
                      )
                    }
                    className="w-full p-6 flex items-center justify-between text-left"
                  >

                    <div className="flex items-center gap-3">

                      <FaFilter className="text-blue-400" />

                      <div>

                        <h2 className="text-xl font-bold">
                          Numeric Statistics
                        </h2>

                        <p className="text-gray-500 text-sm mt-1">
                          Mean, median, minimum, maximum and standard deviation
                        </p>

                      </div>

                    </div>

                    {openSection ===
                    "statistics"
                      ? <FaChevronUp />
                      : <FaChevronDown />}

                  </button>


                  <AnimatePresence>

                    {openSection ===
                      "statistics" && (

                      <motion.div
                        initial={{
                          height: 0,
                          opacity: 0
                        }}
                        animate={{
                          height: "auto",
                          opacity: 1
                        }}
                        exit={{
                          height: 0,
                          opacity: 0
                        }}
                        className="px-6 pb-6 overflow-x-auto"
                      >

                        <table className="w-full text-left">

                          <thead>

                            <tr className="border-b border-slate-700">

                              <th className="py-3 px-3 text-gray-500">
                                Column
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Mean
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Median
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Min
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Max
                              </th>

                              <th className="py-3 px-3 text-gray-500">
                                Std
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {Object.entries(
                              statistics
                            ).map(
                              (
                                [
                                  column,
                                  stat
                                ]
                              ) => (

                                <tr
                                  key={
                                    column
                                  }
                                  className="border-b border-slate-800"
                                >

                                  <td className="py-3 px-3 font-semibold">
                                    {column}
                                  </td>

                                  <td className="py-3 px-3">
                                    {stat.mean ?? "-"}
                                  </td>

                                  <td className="py-3 px-3">
                                    {stat.median ?? "-"}
                                  </td>

                                  <td className="py-3 px-3">
                                    {stat.min ?? "-"}
                                  </td>

                                  <td className="py-3 px-3">
                                    {stat.max ?? "-"}
                                  </td>

                                  <td className="py-3 px-3">
                                    {stat.std ?? "-"}
                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </motion.div>

                    )}

                  </AnimatePresence>

                </div>

              )}


              {/* =================================================
                  CHARTS
              ================================================= */}

              <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    setShowCharts(
                      previous =>
                        !previous
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
                >

                  <div className="flex items-center gap-3">

                    <FaChartBar className="text-cyan-400 text-xl" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Interactive Charts
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Click to reveal visual analytics
                      </p>

                    </div>

                  </div>

                  {showCharts
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {showCharts && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      {Array.isArray(
                        analysis.charts
                      ) &&
                      analysis.charts.length >
                        0 ? (

                        <div className="grid lg:grid-cols-2 gap-5">

                          {analysis.charts.map(
                            (
                              chart,
                              index
                            ) => {

                              if (
                                chart.type ===
                                "correlation"
                              ) {

                                return (

                                  <div
                                    key={
                                      `chart-${index}`
                                    }
                                    className="lg:col-span-2"
                                  >

                                    <CorrelationChart
                                      chart={
                                        chart
                                      }
                                    />

                                  </div>

                                );

                              }

                              return (

                                <SimpleChart
                                  key={
                                    `chart-${index}`
                                  }
                                  chart={
                                    chart
                                  }
                                />

                              );

                            }
                          )}

                        </div>

                      ) : (

                        <div className="bg-slate-800 rounded-2xl p-10 text-center">

                          <FaChartBar className="mx-auto text-4xl text-gray-600 mb-4" />

                          <p className="text-gray-400">
                            No chartable data was found in this sheet.
                          </p>

                        </div>

                      )}

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  TARGET / ML INFO
              ================================================= */}

              <div className="bg-slate-900 border border-purple-500/20 rounded-3xl overflow-hidden">

                <button
                  onClick={() =>
                    toggleSection(
                      "ml"
                    )
                  }
                  className="w-full p-6 flex items-center justify-between text-left"
                >

                  <div className="flex items-center gap-3">

                    <FaBullseye className="text-purple-400" />

                    <div>

                      <h2 className="text-xl font-bold">
                        Machine Learning Readiness
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Features detected for model training
                      </p>

                    </div>

                  </div>

                  {openSection ===
                  "ml"
                    ? <FaChevronUp />
                    : <FaChevronDown />}

                </button>


                <AnimatePresence>

                  {openSection ===
                    "ml" && (

                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1
                      }}
                      exit={{
                        height: 0,
                        opacity: 0
                      }}
                      className="px-6 pb-6"
                    >

                      <div className="grid md:grid-cols-4 gap-4">

                        <div className="bg-slate-800 rounded-xl p-5">
                          <p className="text-gray-500 text-sm">
                            Numeric Features
                          </p>
                          <p className="text-3xl font-black text-cyan-400 mt-1">
                            {(
                              mlReadiness.numericFeatures || []
                            ).length}
                          </p>
                        </div>

                        <div className="bg-slate-800 rounded-xl p-5">
                          <p className="text-gray-500 text-sm">
                            Categorical Features
                          </p>
                          <p className="text-3xl font-black text-purple-400 mt-1">
                            {(
                              mlReadiness.categoricalFeatures || []
                            ).length}
                          </p>
                        </div>

                        <div className="bg-slate-800 rounded-xl p-5">
                          <p className="text-gray-500 text-sm">
                            Date Features
                          </p>
                          <p className="text-3xl font-black text-green-400 mt-1">
                            {(
                              mlReadiness.dateFeatures || []
                            ).length}
                          </p>
                        </div>

                        <div className="bg-slate-800 rounded-xl p-5">
                          <p className="text-gray-500 text-sm">
                            Target Candidates
                          </p>
                          <p className="text-3xl font-black text-yellow-400 mt-1">
                            {(
                              mlReadiness.targetCandidates || []
                            ).length}
                          </p>
                        </div>

                      </div>

                      {(
                        mlReadiness.targetCandidates || []
                      ).length > 0 && (

                        <div className="mt-5 bg-slate-800 rounded-xl p-5">

                          <h3 className="font-bold mb-3">
                            Potential Target Columns
                          </h3>

                          <div className="flex flex-wrap gap-2">

                            {(
                              mlReadiness.targetCandidates || []
                            ).map(
                              candidate => (

                                <span
                                  key={candidate.column}
                                  className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-2 rounded-lg text-sm"
                                >
                                  {candidate.column}
                                </span>

                              )
                            )}

                          </div>

                        </div>

                      )}

                      <div className="mt-5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">

                        <p className="text-yellow-300 text-sm">
                          ⚠ These are readiness signals, not a trained model. The ML Agent should validate the target and preprocessing before training.
                        </p>

                      </div>

                    </motion.div>

                  )}

                </AnimatePresence>

              </div>


              {/* =================================================
                  FINAL STATUS
              ================================================= */}

              <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-3xl p-6">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <FaCheckCircle className="text-green-400 text-2xl" />

                    <div>

                      <h3 className="font-bold">
                        Analysis Completed
                      </h3>

                      <p className="text-gray-500 text-sm mt-1">

                        NexusDS AI has profiled the selected dataset.

                      </p>

                    </div>

                  </div>


                  <button
                    onClick={() => {
                      if (selectedDataset?.id) {
                        localStorage.setItem(
                          "selectedDatasetId",
                          String(selectedDataset.id)
                        );
                      }

                      if (selectedDataset?.fileName) {
                        localStorage.setItem(
                          "selectedDatasetName",
                          selectedDataset.fileName
                        );
                      }

                      navigate(
                        "/agents/data-cleaning"
                      );
                    }}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 px-6 py-3 rounded-xl font-black transition"
                  >

                    Continue to Data Cleaning

                  </button>

                </div>

              </div>

            </div>

          )}

        </div>

      </div>

    </>
  );
}


export default Analytics;