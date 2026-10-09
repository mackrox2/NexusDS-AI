import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import {
  FaArrowLeft,
  FaBrain,
  FaChartBar,
  FaCheckCircle,
  FaDatabase,
  FaExclamationTriangle,
  FaRocket,
  FaSyncAlt,
  FaTrophy,
} from "react-icons/fa";

const API_URL = API_BASE_URL;

function getAuthHeaders(json = false) {
  const token = localStorage.getItem("token");

  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function normalizeColumn(value) {
  return value == null
    ? ""
    : String(value)
        .replace(/\ufeff/g, "")
        .replace(/\u200b/g, "")
        .trim();
}

function formatName(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isClassificationType(type) {
  const value = String(type || "").toLowerCase();

  return (
    value.includes("categor") ||
    value.includes("class") ||
    value.includes("bool") ||
    value.includes("object")
  );
}

function isNumericType(type) {
  const value = String(type || "").toLowerCase();

  return (
    value.includes("numeric") ||
    value.includes("integer") ||
    value.includes("float") ||
    value.includes("number")
  );
}

function isIdentifierColumn(column) {
  const value = normalizeColumn(column).toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (!value) return false;

  return (
    /(^|_)(id|uuid|guid|identifier|key)(_|$)/.test(value) ||
    /(^|_)(product|customer|user|order|transaction|invoice|employee|account|record)_?(id|key)$/.test(value)
  );
}

function targetOutcomeScore(column, type, suggestionItem = null) {
  const name = normalizeColumn(column).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const compact = name.replace(/_/g, "");

  if (isIdentifierColumn(column)) return -1000;

  let score = 0;

  if (suggestionItem) {
    score += 35;
    const rawSuggestionScore = Number(suggestionItem.score);
    if (Number.isFinite(rawSuggestionScore)) {
      score += Math.min(20, Math.max(-10, rawSuggestionScore));
    }
  }

  const outcomeKeywords = [
    "sales", "sale", "revenue", "profit", "income", "amount",
    "units_sold", "unit_sold", "quantity", "qty", "demand",
    "price", "target", "score", "rating", "churn", "approved",
    "approval", "default", "fraud", "conversion", "response",
    "outcome", "prediction", "label", "class"
  ];

  if (outcomeKeywords.some((keyword) => name === keyword || name.includes(keyword))) {
    score += 45;
  }

  if (isNumericType(type)) score += 12;
  if (isClassificationType(type)) score += 8;

  if (compact.endsWith("name") || compact.endsWith("date")) score -= 8;

  return score;
}

function formatMetricValue(key, value) {
  if (typeof value !== "number") {
    return String(value ?? "—");
  }

  const percentageMetrics = [
    "accuracy",
    "precision",
    "recall",
    "f1Score",
    "cvAccuracy",
    "cvPrecision",
    "cvRecall",
    "cvF1",
  ];

  if (percentageMetrics.includes(key) && value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }

  return value.toFixed(4);
}

function MLTraining() {
  const navigate = useNavigate();

  // ======================================================
  // STATE
  // ======================================================

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");

  const [columns, setColumns] = useState([]);
  const [dataTypes, setDataTypes] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState(null);

  const [targetColumn, setTargetColumn] = useState("");
  const [problemType, setProblemType] = useState("classification");
  const [algorithm, setAlgorithm] = useState("auto");
  const [autoMLTune, setAutoMLTune] = useState(true);
  const [testSize, setTestSize] = useState("20");

  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [training, setTraining] = useState(false);

  const [trainingResult, setTrainingResult] = useState(null);
  const [xaiResult, setXaiResult] = useState(null);
  const [xaiLoading, setXaiLoading] = useState(false);
  const [xaiError, setXaiError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ======================================================
  // AUTH
  // ======================================================

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDatasetId");
    localStorage.removeItem("selectedDatasetName");

    navigate("/login", {
      replace: true,
    });
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      handleUnauthorized();
      return null;
    }

    if (!response.ok) {
      throw new Error(
        data.detail ||
          data.message ||
          "Request failed."
      );
    }

    return data;
  };

  // ======================================================
  // LOAD DATASETS
  // ======================================================

  const loadDatasets = async () => {
    try {
      setDatasetsLoading(true);
      setError("");

      const headers = getAuthHeaders();

      if (!headers) {
        handleUnauthorized();
        return;
      }

      const data = await fetchJson(
        `${API_URL}/api/dataset/datasets`,
        {
          headers,
        }
      );

      if (!data) return;

      const list = Array.isArray(data.datasets)
        ? data.datasets
        : [];

      setDatasets(list);

      const savedId =
        localStorage.getItem("selectedDatasetId");

      const savedExists = list.some(
        (item) =>
          String(item.id || item._id) ===
          String(savedId)
      );

      if (savedExists) {
        setSelectedDataset(String(savedId));
      } else if (list.length > 0) {
        setSelectedDataset(
          String(list[0].id || list[0]._id)
        );
      } else {
        setSelectedDataset("");
      }
    } catch (err) {
      console.error("DATASET LOAD ERROR:", err);

      setError(
        err.message ||
          "Unable to load datasets."
      );
    } finally {
      setDatasetsLoading(false);
    }
  };

  // ======================================================
  // ANALYZE DATASET
  // ======================================================

  const loadMLInfo = async (datasetId) => {
    if (!datasetId) {
      setColumns([]);
      setDataTypes({});
      setAnalysis(null);
      setSuggestions(null);
      setTargetColumn("");
      setTrainingResult(null);
      setXaiResult(null);
      setXaiError("");

      return;
    }

    try {
      setAnalysisLoading(true);
      setError("");
      setSuccess("");
      setTrainingResult(null);
      setXaiResult(null);
      setXaiError("");

      const headers = getAuthHeaders();

      if (!headers) {
        handleUnauthorized();
        return;
      }

      const [
        analysisData,
        suggestionData,
      ] = await Promise.all([
        fetchJson(
          `${API_URL}/api/dataset/datasets/${datasetId}/analyze`,
          {
            headers,
          }
        ),

        fetchJson(
          `${API_URL}/api/ml/suggest/${datasetId}`,
          {
            headers,
          }
        ),
      ]);

      if (!analysisData || !suggestionData) {
        return;
      }

      setAnalysis(analysisData);
      setSuggestions(suggestionData);

      // --------------------------------------------------
      // COLUMNS
      // --------------------------------------------------

      const detectedColumns = (
        Array.isArray(analysisData.columns)
          ? analysisData.columns
          : Array.isArray(suggestionData.columns)
          ? suggestionData.columns
          : Object.keys(
              analysisData.dataTypes ||
                analysisData.columnKinds ||
                suggestionData.dataTypes ||
                {}
            )
      )
        .map(normalizeColumn)
        .filter(Boolean);

      const uniqueColumns = [
        ...new Set(detectedColumns),
      ];

      setColumns(uniqueColumns);

      // --------------------------------------------------
      // DATA TYPES
      // --------------------------------------------------

      const detectedTypes =
        analysisData.columnKinds ||
        analysisData.dataTypes ||
        suggestionData.dataTypes ||
        {};

      setDataTypes(detectedTypes);

      // --------------------------------------------------
      // TARGET SUGGESTION
      // --------------------------------------------------

      const candidates =
        analysisData.mlReadiness
          ?.targetCandidates ||
        suggestionData.targetCandidates ||
        [];

      const validCandidate =
        Array.isArray(candidates)
          ? candidates.find((item) =>
              uniqueColumns.some(
                (column) =>
                  normalizeColumn(column).toLowerCase() ===
                  normalizeColumn(
                    item?.column
                  ).toLowerCase()
              )
            )
          : null;

      const firstTarget =
        (Array.isArray(candidates)
          ? candidates
              .filter((item) =>
                uniqueColumns.some(
                  (column) =>
                    normalizeColumn(column).toLowerCase() ===
                    normalizeColumn(item?.column).toLowerCase()
                ) && !isIdentifierColumn(item?.column)
              )
              .sort((a, b) =>
                targetOutcomeScore(
                  b?.column,
                  detectedTypes?.[b?.column] || "",
                  b
                ) -
                targetOutcomeScore(
                  a?.column,
                  detectedTypes?.[a?.column] || "",
                  a
                )
              )[0]?.column
          : null) ||
        validCandidate?.column ||
        uniqueColumns.find((column) => !isIdentifierColumn(column)) ||
        (uniqueColumns.length
          ? uniqueColumns[uniqueColumns.length - 1]
          : "");

      const normalizedTarget =
        normalizeColumn(firstTarget);

      setTargetColumn(normalizedTarget);

      // --------------------------------------------------
      // SMART PROBLEM TYPE
      // --------------------------------------------------

      const targetType =
        detectedTypes?.[normalizedTarget] ||
        detectedTypes?.[firstTarget] ||
        "";

      const suggestedProblem =
        suggestionData.problemType ||
        suggestionData.recommendedProblemType ||
        (isClassificationType(targetType)
          ? "classification"
          : isNumericType(targetType)
          ? "regression"
          : "classification");

      setProblemType(
        suggestedProblem === "regression"
          ? "regression"
          : "classification"
      );

      setAlgorithm("auto");
    } catch (err) {
      console.error(
        "ML PREPARATION ERROR:",
        err
      );

      setError(
        err.message ||
          "Unable to prepare dataset for ML."
      );

      setColumns([]);
      setDataTypes({});
      setAnalysis(null);
      setSuggestions(null);
      setTargetColumn("");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    loadDatasets();
  }, []);

  // ======================================================
  // DATASET CHANGE
  // ======================================================

  useEffect(() => {
    loadMLInfo(selectedDataset);
  }, [selectedDataset]);

  // ======================================================
  // DERIVED DATA
  // ======================================================

  const targetSuggestions = useMemo(() => {
    const values =
      analysis?.mlReadiness
        ?.targetCandidates ||
      suggestions?.targetCandidates ||
      [];

    const raw = Array.isArray(values) ? values : [];
    const byName = new Map(
      raw.map((item) => [
        normalizeColumn(item?.column).toLowerCase(),
        item,
      ])
    );

    return columns
      .map((column) => {
        const type =
          dataTypes?.[column] ||
          dataTypes?.[normalizeColumn(column)] ||
          "";
        const suggestionItem =
          byName.get(normalizeColumn(column).toLowerCase()) || null;

        return {
          column,
          score: targetOutcomeScore(column, type, suggestionItem),
          reason: suggestionItem?.reason || null,
          isIdentifier: isIdentifierColumn(column),
          type,
        };
      })
      .filter((item) => item.column)
      .sort((a, b) => b.score - a.score);
  }, [
    columns,
    dataTypes,
    analysis,
    suggestions,
  ]);

  const recommendedTarget =
    targetSuggestions.find((item) => !item.isIdentifier)?.column ||
    targetSuggestions[0]?.column ||
    "";

  const selectedTargetIsIdentifier =
    Boolean(targetColumn) && isIdentifierColumn(targetColumn);

  const recommendedTargetType =
    dataTypes?.[recommendedTarget] ||
    dataTypes?.[normalizeColumn(recommendedTarget)] ||
    "";

  const mlReadiness =
    analysis?.mlReadiness || {};

  const numericFeatures =
    Array.isArray(
      mlReadiness.numericFeatures
    )
      ? mlReadiness.numericFeatures
      : [];

  const categoricalFeatures =
    Array.isArray(
      mlReadiness.categoricalFeatures
    )
      ? mlReadiness.categoricalFeatures
      : [];

  const selectedTargetType =
    dataTypes?.[
      normalizeColumn(targetColumn)
    ] || "";

  const datasetName = useMemo(() => {
    const dataset = datasets.find(
      (item) =>
        String(item.id || item._id) ===
        String(selectedDataset)
    );

    return (
      dataset?.fileName ||
      dataset?.filename ||
      dataset?.name ||
      analysis?.dataset?.fileName ||
      "Selected Dataset"
    );
  }, [
    datasets,
    selectedDataset,
    analysis,
  ]);

  const comparisonRows =
    Array.isArray(
      trainingResult?.modelComparison
    )
      ? trainingResult.modelComparison
      : [];

  const metrics =
    trainingResult?.metrics || {};

  const bestModel =
    trainingResult?.bestModel ||
    trainingResult?.model ||
    trainingResult?.algorithm ||
    "—";

  // ======================================================
  // PROFESSIONAL ML INTELLIGENCE
  // ======================================================

  const datasetRows =
    Number(
      analysis?.summary?.rows ??
        analysis?.dataset?.rows ??
        0
    ) || 0;

  const featureCount =
    numericFeatures.length + categoricalFeatures.length;

  const readinessScoreRaw =
    mlReadiness?.score ??
    mlReadiness?.readinessScore ??
    mlReadiness?.percentage ??
    null;

  const readinessScore =
    typeof readinessScoreRaw === "number"
      ? Math.max(
          0,
          Math.min(
            100,
            readinessScoreRaw <= 1
              ? readinessScoreRaw * 100
              : readinessScoreRaw
          )
        )
      : null;

  const readinessLabel =
    readinessScore == null
      ? "Analyzing"
      : readinessScore >= 80
      ? "Ready for ML"
      : readinessScore >= 60
      ? "Mostly Ready"
      : "Needs Preparation";

  const topFeature =
    Array.isArray(trainingResult?.featureImportance) &&
    trainingResult.featureImportance.length > 0
      ? trainingResult.featureImportance[0]?.feature
      : null;

  const topMetricEntry =
    Object.entries(metrics).find(
      ([key, value]) =>
        typeof value === "number" &&
        ["accuracy", "r2", "f1Score", "cvAccuracy", "cvF1", "cvR2"].includes(key)
    ) || null;

  const trainingHeadline = trainingResult
    ? `${formatName(bestModel)} completed the ${formatName(
        trainingResult.problemType || problemType
      )} run on ${formatName(targetColumn)}.`
    : `NexusDS is ready to train a ${formatName(
        problemType
      )} model from ${formatName(targetColumn)}.`;

  const workflowSteps = [
    { label: "Dataset", done: Boolean(selectedDataset) },
    { label: "Target", done: Boolean(targetColumn) },
    { label: "Problem", done: Boolean(problemType) },
    { label: "Model", done: Boolean(trainingResult) },
  ];

  // ======================================================
  // TRAIN MODEL
  // ======================================================

  const trainModel = async () => {
    setError("");
    setSuccess("");
    setTrainingResult(null);
    setXaiResult(null);
    setXaiError("");

    if (!selectedDataset) {
      setError(
        "Please select a dataset."
      );
      return;
    }

    if (!targetColumn) {
      setError(
        "Please select a target column."
      );
      return;
    }

    const exactColumn =
      columns.find(
        (column) =>
          normalizeColumn(column).toLowerCase() ===
          normalizeColumn(
            targetColumn
          ).toLowerCase()
      );

    if (!exactColumn) {
      setError(
        "Selected target column does not exist in the dataset."
      );
      return;
    }

    try {
      setTraining(true);

      const headers =
        getAuthHeaders(true);

      if (!headers) {
        handleUnauthorized();
        return;
      }

      const data = await fetchJson(
        `${API_URL}/api/ml/train`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            datasetId:
              selectedDataset,

            targetColumn:
              exactColumn,

            problemType:
              problemType,

            algorithm:
              algorithm,

            testSize:
              Number(testSize) / 100,
            tune:
              algorithm === "auto"
                ? autoMLTune
                : false,
          }),
        }
      );

      if (!data) return;

      setTrainingResult(data);

      // Keep the latest trained model connected to Prediction Studio.
      if (data?.modelId) {
        localStorage.setItem("lastMLModelId", String(data.modelId));
        localStorage.setItem(
          "lastMLDatasetId",
          String(data.datasetId || selectedDataset)
        );
        localStorage.setItem(
          "selectedDatasetId",
          String(data.datasetId || selectedDataset)
        );
      }

      setSuccess(
        data.message ||
          "Machine learning training completed successfully."
      );
    } catch (err) {
      console.error(
        "ML TRAINING ERROR:",
        err
      );

      setError(
        err.message ||
          "Model training failed."
      );
    } finally {
      setTraining(false);
    }
  };


  // ======================================================
  // EXPLAINABLE AI
  // ======================================================

  const runExplainability = async () => {
    setXaiError("");
    setXaiResult(null);

    if (!selectedDataset || !trainingResult?.modelId) {
      setXaiError("Train a model first to generate an explanation.");
      return;
    }

    try {
      setXaiLoading(true);

      const headers = getAuthHeaders(true);

      if (!headers) {
        handleUnauthorized();
        return;
      }

      const row =
        trainingResult?.featureDefaults &&
        typeof trainingResult.featureDefaults === "object"
          ? trainingResult.featureDefaults
          : {};

      const data = await fetchJson(
        `${API_URL}/api/ml/explain`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            datasetId: selectedDataset,
            modelId: trainingResult.modelId,
            row,
          }),
        }
      );

      if (!data) return;

      setXaiResult(data);
    } catch (err) {
      console.error("XAI ERROR:", err);
      setXaiError(
        err.message ||
          "Unable to generate model explanation."
      );
    } finally {
      setXaiLoading(false);
    }
  };

  // ======================================================
  // RESET
  // ======================================================

  const resetTrainingState = () => {
    setTrainingResult(null);
    setXaiResult(null);
    setXaiError("");
    setSuccess("");
    setError("");
  };

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">

        {/* BACK */}

        <button
          type="button"
          onClick={() =>
            navigate("/agents")
          }
          className="inline-flex items-center gap-2 text-slate-400 hover:text-purple-300 transition mb-7"
        >
          <FaArrowLeft />
          Back to AI Agents
        </button>

        {/* HEADER */}

        <header className="mb-9">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-black tracking-wider">
            <FaBrain />
            MACHINE LEARNING AGENT
          </div>

          <h1 className="text-4xl md:text-5xl font-black mt-4">
            Machine Learning{" "}
            <span className="text-purple-400">
              Training
            </span>
          </h1>

          <p className="text-slate-400 mt-3 max-w-3xl text-base md:text-lg">
            Train and evaluate real machine
            learning models from your dataset.
            NexusDS analyzes the target, compares
            available models and reports the actual
            evaluation results.
          </p>
        </header>

        {/* ERROR */}

        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-5 py-4">
            <FaExclamationTriangle className="mt-1 shrink-0" />

            <div>
              <p className="font-bold">
                Training Error
              </p>

              <p className="text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="mb-6 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 rounded-2xl px-5 py-4">
            <FaCheckCircle className="mt-1 shrink-0" />

            <p>{success}</p>
          </div>
        )}

        {/* =================================================
            STEP 1
        ================================================= */}

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">

          <div className="flex items-center gap-4 mb-6">

            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-300 flex items-center justify-center font-black">
              1
            </div>

            <div>
              <h2 className="text-xl font-black">
                Select Dataset
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Choose one of your own datasets.
              </p>
            </div>

          </div>

          <div className="flex flex-col md:flex-row gap-3">

            <select
              value={selectedDataset}
              onChange={(event) => {
                const id =
                  event.target.value;

                setSelectedDataset(id);

                const dataset =
                  datasets.find(
                    (item) =>
                      String(
                        item.id ||
                          item._id
                      ) === String(id)
                  );

                if (id) {
                  localStorage.setItem(
                    "selectedDatasetId",
                    id
                  );

                  localStorage.setItem(
                    "selectedDatasetName",
                    dataset?.fileName ||
                      dataset?.filename ||
                      dataset?.name ||
                      ""
                  );
                }
              }}
              disabled={
                datasetsLoading ||
                training
              }
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 outline-none focus:border-purple-400"
            >
              <option value="">
                {datasetsLoading
                  ? "Loading datasets..."
                  : "Select Dataset"}
              </option>

              {datasets.map(
                (dataset) => {
                  const id = String(
                    dataset.id ||
                      dataset._id
                  );

                  const name =
                    dataset.fileName ||
                    dataset.filename ||
                    dataset.name ||
                    "Unnamed Dataset";

                  return (
                    <option
                      key={id}
                      value={id}
                    >
                      {name}
                    </option>
                  );
                }
              )}
            </select>

            <button
              type="button"
              onClick={loadDatasets}
              disabled={
                datasetsLoading ||
                training
              }
              className="px-5 py-3.5 rounded-xl border border-slate-700 hover:border-purple-400/50 text-slate-300 hover:text-purple-300 transition inline-flex items-center justify-center gap-2"
            >
              <FaSyncAlt
                className={
                  datasetsLoading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

          </div>

        </section>

        {/* =================================================
            DATASET READINESS
        ================================================= */}

        {selectedDataset && (
          <>
            {/* =================================================
                ML COMMAND CENTER
            ================================================= */}

            <section className="mt-5 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 border border-purple-500/20 rounded-3xl p-5 md:p-7 overflow-hidden">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black tracking-wider">
                    <FaBrain />
                    ML COMMAND CENTER
                  </div>

                  <h2 className="text-2xl md:text-3xl font-black mt-4">
                    From dataset to{" "}
                    <span className="text-purple-400">
                      production-ready insight
                    </span>
                  </h2>

                  <p className="text-slate-400 mt-3 leading-relaxed">
                    NexusDS automatically inspects your dataset, identifies useful
                    features, suggests a target and prepares the training workflow.
                    You stay in control of the final configuration.
                  </p>
                </div>

                <div className="w-full xl:w-72">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-500">Workflow progress</span>
                    <span className="text-purple-300 font-bold">
                      {workflowSteps.filter((step) => step.done).length}/4
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {workflowSteps.map((step, index) => (
                      <div key={step.label}>
                        <div
                          className={`h-2 rounded-full ${
                            step.done
                              ? "bg-gradient-to-r from-purple-500 to-cyan-400"
                              : "bg-slate-800"
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-2 truncate">
                          {index + 1}. {step.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Dataset Scale</p>
                  <p className="text-2xl font-black mt-2">
                    {datasetRows ? datasetRows.toLocaleString() : "—"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">rows available</p>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">ML Features</p>
                  <p className="text-2xl font-black mt-2 text-cyan-300">
                    {featureCount || columns.length || "—"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    numeric + categorical
                  </p>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Readiness</p>
                  <p className="text-2xl font-black mt-2 text-purple-300">
                    {readinessScore == null
                      ? "—"
                      : `${readinessScore.toFixed(0)}%`}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {readinessLabel}
                  </p>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Current Target</p>
                  <p className="text-lg font-black mt-2 text-amber-300 truncate">
                    {targetColumn || "Not selected"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {formatName(problemType)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 bg-slate-900 border border-purple-500/20 rounded-3xl p-5 md:p-7">

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

                <div>
                  <div className="flex items-center gap-3">
                    <FaDatabase className="text-purple-400" />

                    <h2 className="text-xl font-black">
                      Dataset Readiness
                    </h2>
                  </div>

                  <p className="text-sm text-slate-500 mt-1 break-all">
                    {datasetName}
                  </p>
                </div>

                {analysisLoading && (
                  <div className="text-sm text-purple-300 inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />

                    Analyzing dataset...
                  </div>
                )}

              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">
                    Rows
                  </p>

                  <p className="text-2xl font-black mt-2">
                    {analysis?.summary?.rows ??
                      analysis?.dataset?.rows ??
                      "—"}
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">
                    Columns
                  </p>

                  <p className="text-2xl font-black mt-2">
                    {columns.length}
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">
                    Numeric Features
                  </p>

                  <p className="text-2xl font-black text-cyan-300 mt-2">
                    {numericFeatures.length}
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">
                    Categorical Features
                  </p>

                  <p className="text-2xl font-black text-purple-300 mt-2">
                    {categoricalFeatures.length}
                  </p>
                </div>

              </div>

            </section>

            {/* =================================================
                AI TRAINING BRIEF
            ================================================= */}

            <section className="mt-5 grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                    <FaChartBar />
                  </div>
                  <div>
                    <p className="text-xs font-black tracking-wider text-cyan-300">
                      AI TRAINING BRIEF
                    </p>
                    <h3 className="text-lg font-black mt-1">
                      {trainingHeadline}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                      {trainingResult
                        ? topFeature
                          ? `The strongest reported feature is ${topFeature}. Review model comparison and evaluation metrics before using the model for decisions.`
                          : "Review the returned metrics and model comparison before using the trained model."
                        : "The configuration below is generated from the selected dataset and can be overridden before training."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6">
                <p className="text-xs font-black tracking-wider text-slate-500">
                  RECOMMENDED FLOW
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    ["01", "Confirm target", Boolean(targetColumn)],
                    ["02", "Review problem type", Boolean(problemType)],
                    ["03", "Compare models", Boolean(algorithm === "auto")],
                    ["04", "Evaluate results", Boolean(trainingResult)],
                  ].map(([number, label, done]) => (
                    <div key={number} className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          done
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {number}
                      </span>
                      <span className={done ? "text-slate-200 text-sm" : "text-slate-500 text-sm"}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* =================================================
                STEP 2
            ================================================= */}

            <section className="mt-5 bg-slate-900 border border-purple-500/20 rounded-3xl p-5 md:p-7">

              <div className="flex items-center gap-4 mb-7">

                <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-300 flex items-center justify-center font-black">
                  2
                </div>

                <div>
                  <h2 className="text-xl font-black">
                    Training Configuration
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    NexusDS suggests the target and
                    problem type from your dataset.
                  </p>
                </div>

              </div>

              {/* TARGET SUGGESTIONS */}

              {targetSuggestions.length > 0 && (
                <div className="mb-6 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5">

                  <div className="flex items-center justify-between gap-3 mb-4">

                    <h3 className="font-black">
                      Suggested Target Columns
                    </h3>

                    <span className="text-xs text-purple-300">
                      AI / dataset analysis
                    </span>

                  </div>

                  <div className="grid md:grid-cols-2 gap-2">

                    {targetSuggestions
                      .slice(0, 6)
                      .map(
                        (
                          item,
                          index
                        ) => {
                          const name =
                            normalizeColumn(
                              item?.column
                            );

                          if (!name)
                            return null;

                          const selected =
                            normalizeColumn(
                              targetColumn
                            ) === name;

                          return (
                            <button
                              key={`${name}-${index}`}
                              type="button"
                              onClick={() => {
                                setTargetColumn(
                                  name
                                );

                                const type =
                                  dataTypes?.[
                                    name
                                  ] || "";

                                if (
                                  isClassificationType(
                                    type
                                  )
                                ) {
                                  setProblemType(
                                    "classification"
                                  );
                                } else if (
                                  isNumericType(
                                    type
                                  )
                                ) {
                                  setProblemType(
                                    "regression"
                                  );
                                }

                                setTrainingResult(
                                  null
                                );
                              }}
                              className={`text-left p-3 rounded-xl border transition ${
                                selected
                                  ? "border-purple-400 bg-purple-500/10"
                                  : "border-slate-800 bg-slate-800/50 hover:border-purple-400/40"
                              }`}
                            >

                              <div className="flex items-center justify-between gap-3">

                                <span className="font-semibold truncate">
                                  {name}
                                </span>

                                {item?.score !=
                                  null && (
                                  <span className="text-xs text-slate-500 shrink-0">
                                    score{" "}
                                    {
                                      item.score
                                    }
                                  </span>
                                )}

                              </div>

                              {item?.reason && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {item.reason}
                                </p>
                              )}

                            </button>
                          );
                        }
                      )}

                  </div>

                </div>
              )}

              {/* CONFIG GRID */}

              <div className="grid lg:grid-cols-2 gap-5">

                {/* TARGET */}

                <div>
                  <label className="text-sm font-bold text-slate-300">
                    Target Column
                  </label>

                  <select
                    value={targetColumn}
                    onChange={(event) => {
                      const value =
                        event.target.value;

                      setTargetColumn(
                        value
                      );

                      const type =
                        dataTypes?.[
                          value
                        ] || "";

                      if (
                        isClassificationType(
                          type
                        )
                      ) {
                        setProblemType(
                          "classification"
                        );
                      } else if (
                        isNumericType(
                          type
                        )
                      ) {
                        setProblemType(
                          "regression"
                        );
                      }

                      setTrainingResult(
                        null
                      );
                    }}
                    disabled={
                      analysisLoading ||
                      training ||
                      !columns.length
                    }
                    className="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 outline-none focus:border-purple-400"
                  >

                    <option value="">
                      Select target column
                    </option>

                    {columns.map(
                      (column) => (
                        <option
                          key={column}
                          value={column}
                        >
                          {column}
                        </option>
                      )
                    )}

                  </select>

                  <div className="mt-3 bg-slate-800/60 rounded-xl p-3 text-xs">

                    <span className="text-slate-500">
                      Detected type:{" "}
                    </span>

                    <span className="text-cyan-300">
                      {selectedTargetType ||
                        "Automatic"}
                    </span>

                  </div>

                  {selectedTargetIsIdentifier && (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <FaExclamationTriangle className="text-amber-300 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-amber-200">
                            This looks like an identifier column
                          </p>
                          <p className="text-xs text-amber-100/70 mt-1">
                            {formatName(targetColumn)} is likely an ID/key rather than a meaningful outcome. Predicting identifiers usually does not produce useful business insights.
                          </p>
                          {recommendedTarget && recommendedTarget !== targetColumn && (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetColumn(recommendedTarget);
                                if (isClassificationType(recommendedTargetType)) {
                                  setProblemType("classification");
                                } else if (isNumericType(recommendedTargetType)) {
                                  setProblemType("regression");
                                }
                                setTrainingResult(null);
                              }}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-400/15 border border-amber-400/30 px-3 py-2 text-xs font-black text-amber-200 hover:bg-amber-400/25 transition"
                            >
                              Use recommended: {formatName(recommendedTarget)}
                            </button>
                          )}
                          <p className="text-[11px] text-slate-500 mt-2">
                            You can still continue with this target if you have a specific reason.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedTargetIsIdentifier && recommendedTarget && (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs">
                      <span className="text-emerald-300 font-bold">AI recommended target:</span>{" "}
                      <span className="text-slate-300">{formatName(recommendedTarget)}</span>
                    </div>
                  )}
                </div>

                {/* PROBLEM TYPE */}

                <div>
                  <label className="text-sm font-bold text-slate-300">
                    Problem Type
                  </label>

                  <select
                    value={problemType}
                    onChange={(event) => {
                      setProblemType(
                        event.target.value
                      );

                      setTrainingResult(
                        null
                      );
                    }}
                    disabled={training}
                    className="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 outline-none focus:border-purple-400"
                  >
                    <option value="classification">
                      Classification
                    </option>

                    <option value="regression">
                      Regression
                    </option>
                  </select>

                  <p className="text-xs text-slate-500 mt-2">
                    Automatically suggested from
                    the selected target. You can
                    manually override it.
                  </p>
                </div>

                {/* ALGORITHM */}

                <div>
                  <label className="text-sm font-bold text-slate-300">
                    Algorithm
                  </label>

                  <select
                    value={algorithm}
                    onChange={(event) => {
                      setAlgorithm(
                        event.target.value
                      );

                      setTrainingResult(
                        null
                      );
                    }}
                    disabled={training}
                    className="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 outline-none focus:border-purple-400"
                  >

                    <option value="auto">
                      Auto — Compare Models
                    </option>

                    {problemType ===
                    "classification" ? (
                      <>
                        <option value="random_forest">
                          Random Forest
                        </option>

                        <option value="logistic_regression">
                          Logistic Regression
                        </option>

                        <option value="decision_tree">
                          Decision Tree
                        </option>

                        <option value="knn">
                          K-Nearest Neighbors
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="random_forest">
                          Random Forest
                        </option>

                        <option value="linear_regression">
                          Linear Regression
                        </option>

                        <option value="decision_tree">
                          Decision Tree
                        </option>
                      </>
                    )}

                  </select>

                  <p className="text-xs text-slate-500 mt-2">
                    AutoML compares all suitable models and selects the strongest candidate using cross-validation when supported.
                  </p>

                  {algorithm === "auto" && (
                    <label className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 cursor-pointer">
                      <span>
                        <span className="block text-xs font-black text-purple-200">AutoML Hyperparameter Tuning</span>
                        <span className="block text-[11px] text-slate-500 mt-1">Tune supported models before selecting the winner.</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={autoMLTune}
                        onChange={(event) => {
                          setAutoMLTune(event.target.checked);
                          setTrainingResult(null);
                        }}
                        disabled={training}
                        className="h-5 w-5 accent-purple-500"
                      />
                    </label>
                  )}
                </div>

                {/* TEST SIZE */}

                <div>
                  <label className="text-sm font-bold text-slate-300">
                    Test Size
                  </label>

                  <select
                    value={testSize}
                    onChange={(event) => {
                      setTestSize(
                        event.target.value
                      );

                      setTrainingResult(
                        null
                      );
                    }}
                    disabled={training}
                    className="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 outline-none focus:border-purple-400"
                  >

                    <option value="10">
                      10%
                    </option>

                    <option value="20">
                      20%
                    </option>

                    <option value="25">
                      25%
                    </option>

                    <option value="30">
                      30%
                    </option>

                    <option value="40">
                      40%
                    </option>

                    <option value="50">
                      50%
                    </option>

                  </select>

                  <p className="text-xs text-slate-500 mt-2">
                    Percentage of data reserved for
                    final testing.
                  </p>
                </div>

              </div>

              {/* TRAIN */}

              <button
                type="button"
                onClick={trainModel}
                disabled={
                  training ||
                  analysisLoading ||
                  !selectedDataset ||
                  !targetColumn ||
                  !columns.length
                }
                className="w-full mt-7 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 rounded-xl py-4 font-black text-lg transition flex items-center justify-center gap-3"
              >

                {training ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />

                    Training & Evaluating...
                  </>
                ) : (
                  <>
                    <FaRocket />

                    {algorithm === "auto"
                      ? "Run AutoML & Select Best Model"
                      : "Train Machine Learning Model"}
                  </>
                )}

              </button>

            </section>

            {/* =================================================
                RESULTS
            ================================================= */}

            {trainingResult && (
              <section className="mt-5 bg-slate-900 border border-emerald-500/20 rounded-3xl p-5 md:p-7">

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-7">

                  <div>

                    <div className="flex items-center gap-3">

                      <FaCheckCircle className="text-emerald-400 text-2xl" />

                      <h2 className="text-xl md:text-2xl font-black">
                        Model Evaluation Complete
                      </h2>

                    </div>

                    <p className="text-sm text-slate-500 mt-2">
                      Actual training and evaluation
                      results returned by the backend.
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={
                      resetTrainingState
                    }
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-purple-400/50 hover:text-purple-300 transition"
                  >
                    New Training Run
                  </button>

                </div>

                {/* SUMMARY CARDS */}

                <div className="grid md:grid-cols-3 gap-4">

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      Target
                    </p>

                    <p className="font-black text-purple-300 mt-2 break-all">
                      {trainingResult.targetColumn ||
                        targetColumn}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      Problem Type
                    </p>

                    <p className="font-black mt-2">
                      {formatName(
                        trainingResult.problemType ||
                          problemType
                      )}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      Best Model
                    </p>

                    <p className="font-black text-emerald-300 mt-2 break-all">
                      {formatName(
                        bestModel
                      )}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      Training Rows
                    </p>

                    <p className="text-xl font-black mt-2">
                      {trainingResult.trainingRows ??
                        "—"}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      Testing Rows
                    </p>

                    <p className="text-xl font-black mt-2">
                      {trainingResult.testingRows ??
                        "—"}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">
                      CV Method
                    </p>

                    <p className="font-black mt-2">
                      {trainingResult.cvMethod ||
                        "—"}
                    </p>
                  </div>

                </div>

                {/* METRICS */}

                {Object.keys(metrics).length >
                  0 && (
                  <div className="mt-8">

                    <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                      <FaChartBar className="text-purple-400" />
                      Model Performance
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                      {Object.entries(
                        metrics
                      ).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl p-5"
                          >

                            <p className="text-xs text-slate-500">
                              {formatName(
                                key
                              )}
                            </p>

                            <p className="text-2xl font-black text-purple-300 mt-2">
                              {formatMetricValue(
                                key,
                                value
                              )}
                            </p>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

                {/* MODEL COMPARISON */}

                {comparisonRows.length >
                  0 && (
                  <div className="mt-8">

                    <div className="flex items-center gap-2 mb-4">

                      <FaTrophy className="text-amber-300" />

                      <h3 className="font-black text-lg">
                        Model Comparison
                      </h3>

                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-800">

                      <table className="w-full text-sm">

                        <thead className="bg-slate-800/80">

                          <tr>

                            <th className="text-left px-4 py-3">
                              Model
                            </th>

                            <th className="text-left px-4 py-3">
                              Selection Score
                            </th>

                            <th className="text-left px-4 py-3">
                              CV Score
                            </th>

                            <th className="text-left px-4 py-3">
                              Status
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {comparisonRows.map(
                            (
                              row,
                              index
                            ) => {
                              const name =
                                row?.model ||
                                row?.algorithm ||
                                row?.name ||
                                "Model";

                              const selectionScore =
                                row?.selectionScore ??
                                row?.score ??
                                row?.cvF1 ??
                                row?.cvR2 ??
                                row?.cvScore;

                              const cvScore =
                                row?.cvScore ??
                                row?.cvF1 ??
                                row?.cvR2;

                              const isBest =
                                String(
                                  name
                                ).toLowerCase() ===
                                String(
                                  bestModel
                                ).toLowerCase();

                              return (
                                <tr
                                  key={`${name}-${index}`}
                                  className="border-t border-slate-800"
                                >

                                  <td className="px-4 py-3 font-semibold">
                                    {formatName(
                                      name
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-cyan-300">
                                    {typeof selectionScore ===
                                    "number"
                                      ? selectionScore.toFixed(
                                          4
                                        )
                                      : "—"}
                                  </td>

                                  <td className="px-4 py-3">
                                    {typeof cvScore ===
                                    "number"
                                      ? cvScore.toFixed(
                                          4
                                        )
                                      : "—"}
                                  </td>

                                  <td className="px-4 py-3">

                                    {isBest ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold">
                                        <FaTrophy />
                                        Best Model
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 text-xs">
                                        Compared
                                      </span>
                                    )}

                                  </td>

                                </tr>
                              );
                            }
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>
                )}

                {/* EXPLAINABLE AI */}

                <div className="mt-8 bg-gradient-to-br from-cyan-500/5 via-slate-900 to-purple-500/5 border border-cyan-500/20 rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black tracking-wider">
                        <FaBrain />
                        EXPLAINABLE AI
                      </div>

                      <h3 className="text-xl font-black mt-3">
                        Why did the model make this decision?
                      </h3>

                      <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
                        NexusDS compares the model output with a learned baseline and
                        estimates which features push the selected prediction upward
                        or downward. This explanation is model-aware and uses the same
                        trained pipeline used for prediction.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={runExplainability}
                      disabled={xaiLoading || !trainingResult?.modelId}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black transition"
                    >
                      <FaBrain className={xaiLoading ? "animate-pulse" : ""} />
                      {xaiLoading
                        ? "Explaining..."
                        : "Explain This Model"}
                    </button>
                  </div>

                  {xaiError && (
                    <div className="mt-5 bg-red-500/10 border border-red-500/25 text-red-300 rounded-xl px-4 py-3 text-sm">
                      {xaiError}
                    </div>
                  )}

                  {xaiResult && (
                    <div className="mt-6">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                          <p className="text-xs text-slate-500">Prediction</p>
                          <p className="text-lg font-black text-cyan-300 mt-1 break-all">
                            {xaiResult.prediction ?? "—"}
                          </p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                          <p className="text-xs text-slate-500">Baseline Output</p>
                          <p className="text-lg font-black text-slate-200 mt-1">
                            {xaiResult.baselinePrediction ?? "—"}
                          </p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                          <p className="text-xs text-slate-500">Model</p>
                          <p className="text-lg font-black text-purple-300 mt-1">
                            {formatName(xaiResult.algorithm)}
                          </p>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                          <p className="text-xs text-slate-500">Confidence</p>
                          <p className="text-lg font-black text-emerald-300 mt-1">
                            {typeof xaiResult.confidence === "number"
                              ? `${(xaiResult.confidence * 100).toFixed(1)}%`
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {Array.isArray(xaiResult.contributions) &&
                        xaiResult.contributions.length > 0 && (
                          <div className="mt-6">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div>
                                <p className="font-black">Local Feature Contributions</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Positive values increase the selected output; negative values decrease it.
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {xaiResult.contributions
                                .slice(0, 10)
                                .map((item, index) => {
                                  const contribution = Number(item?.contribution);
                                  const magnitude = Number(item?.absoluteContribution);
                                  const maxMagnitude = Math.max(
                                    ...xaiResult.contributions
                                      .slice(0, 10)
                                      .map((entry) =>
                                        Number(entry?.absoluteContribution) || 0
                                      ),
                                    1
                                  );
                                  const width = Math.max(
                                    4,
                                    Math.min(
                                      100,
                                      (magnitude / maxMagnitude) * 100
                                    )
                                  );

                                  const positive = contribution >= 0;

                                  return (
                                    <div key={`${item?.feature}-${index}`}>
                                      <div className="flex justify-between gap-3 text-sm mb-1">
                                        <span className="truncate text-slate-200">
                                          {item?.feature || "Feature"}
                                        </span>
                                        <span
                                          className={
                                            positive
                                              ? "text-emerald-300 shrink-0 font-bold"
                                              : "text-rose-300 shrink-0 font-bold"
                                          }
                                        >
                                          {Number.isFinite(contribution)
                                            ? `${positive ? "+" : ""}${contribution.toFixed(4)}`
                                            : "—"}
                                        </span>
                                      </div>

                                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            positive
                                              ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                                              : "bg-gradient-to-r from-rose-500 to-purple-400"
                                          }`}
                                          style={{ width: `${width}%` }}
                                        />
                                      </div>

                                      <p className="text-[11px] text-slate-600 mt-1">
                                        Value: {String(item?.value ?? "—")} · Baseline:{" "}
                                        {String(item?.baselineValue ?? "—")}
                                      </p>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                      <div className="mt-5 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-500">Explanation method</p>
                        <p className="text-sm text-slate-300 mt-1">
                          {xaiResult.method ||
                            "Baseline replacement contribution analysis"}
                        </p>
                        <p className="text-xs text-slate-600 mt-2">
                          Local explanations show model behavior, not causal relationships.
                          Always interpret them together with validation metrics.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* FEATURE IMPORTANCE */}

                {Array.isArray(
                  trainingResult.featureImportance
                ) &&
                  trainingResult
                    .featureImportance
                    .length > 0 && (
                    <div className="mt-8">

                      <h3 className="font-black text-lg mb-4">
                        Top Feature Importance
                      </h3>

                      <div className="space-y-3">

                        {trainingResult
                          .featureImportance
                          .slice(0, 10)
                          .map(
                            (
                              item,
                              index
                            ) => {
                              const importance =
                                Number(
                                  item?.importance
                                );

                              const width =
                                Number.isFinite(
                                  importance
                                )
                                  ? Math.max(
                                      3,
                                      Math.min(
                                        100,
                                        importance *
                                          100
                                      )
                                    )
                                  : 3;

                              return (
                                <div
                                  key={`${item?.feature}-${index}`}
                                >

                                  <div className="flex justify-between gap-3 text-sm mb-1">

                                    <span className="truncate">
                                      {item?.feature ||
                                        "Feature"}
                                    </span>

                                    <span className="text-cyan-300 shrink-0">
                                      {Number.isFinite(
                                        importance
                                      )
                                        ? importance.toFixed(
                                            4
                                          )
                                        : "—"}
                                    </span>

                                  </div>

                                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">

                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                      style={{
                                        width: `${width}%`,
                                      }}
                                    />

                                  </div>

                                </div>
                              );
                            }
                          )}

                      </div>

                    </div>
                  )}

                {/* CONFUSION MATRIX */}

                {trainingResult
                  .confusionMatrix
                  ?.matrix && (
                  <div className="mt-8">

                    <h3 className="font-black text-lg mb-4">
                      Confusion Matrix
                    </h3>

                    <div className="overflow-x-auto">

                      <table className="text-sm border-collapse">

                        <tbody>

                          {trainingResult
                            .confusionMatrix
                            .matrix
                            .map(
                              (
                                row,
                                rowIndex
                              ) => (
                                <tr
                                  key={
                                    rowIndex
                                  }
                                >

                                  {row.map(
                                    (
                                      value,
                                      columnIndex
                                    ) => (
                                      <td
                                        key={
                                          columnIndex
                                        }
                                        className="border border-slate-700 px-5 py-3 text-center bg-slate-800"
                                      >
                                        {
                                          value
                                        }
                                      </td>
                                    )
                                  )}

                                </tr>
                              )
                            )}

                        </tbody>

                      </table>

                    </div>

                    {trainingResult
                      .confusionMatrix
                      .labels
                      ?.length >
                      0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        Class order:{" "}
                        {trainingResult.confusionMatrix.labels.join(
                          ", "
                        )}
                      </p>
                    )}

                  </div>
                )}

                {/* TARGET CLASSES */}

                {Array.isArray(
                  trainingResult.targetClasses
                ) &&
                  trainingResult.targetClasses
                    .length > 0 && (
                    <div className="mt-7">

                      <p className="text-sm font-black mb-3">
                        Target Classes
                      </p>

                      <div className="flex flex-wrap gap-2">

                        {trainingResult.targetClasses.map(
                          (
                            item,
                            index
                          ) => (
                            <span
                              key={`${item}-${index}`}
                              className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs"
                            >
                              {item}
                            </span>
                          )
                        )}

                      </div>

                    </div>
                  )}

                {/* FEATURES */}

                {Array.isArray(
                  trainingResult.featureColumns
                ) &&
                  trainingResult
                    .featureColumns
                    .length > 0 && (
                    <div className="mt-7">

                      <p className="text-sm font-black mb-3">
                        Features Used
                      </p>

                      <div className="flex flex-wrap gap-2">

                        {trainingResult.featureColumns.map(
                          (column) => (
                            <span
                              key={column}
                              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs"
                            >
                              {column}
                            </span>
                          )
                        )}

                      </div>

                    </div>
                  )}

                {/* FINAL STATUS */}

                <div className="mt-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-emerald-300">

                  <div className="flex items-start gap-3">

                    <FaCheckCircle className="mt-1 shrink-0" />

                    <div>

                      <p className="font-bold">
                        {trainingResult.message ||
                          "Model training completed successfully."}
                      </p>

                      <p className="text-xs text-emerald-300/60 mt-1">
                        Training metadata has been
                        saved for this dataset.
                      </p>

                    </div>

                  </div>

                {trainingResult?.modelId && (
                  <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/agents/prediction-studio")
                      }
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black transition shadow-lg shadow-purple-500/10"
                    >
                      <FaRocket />
                      Open Prediction Studio
                    </button>

                    <span className="text-xs text-slate-500">
                      Model {trainingResult.modelId} is ready for live prediction.
                    </span>
                  </div>
                )}

                <div className="mt-5 grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Model Decision</p>
                    <p className="font-black text-emerald-300 mt-2 break-all">
                      {formatName(bestModel)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Selected from the returned training result.
                    </p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Primary Metric</p>
                    <p className="font-black text-cyan-300 mt-2">
                      {topMetricEntry
                        ? `${formatName(topMetricEntry[0])}: ${formatMetricValue(
                            topMetricEntry[0],
                            topMetricEntry[1]
                          )}`
                        : "See metrics above"}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Reported directly by the backend.
                    </p>
                  </div>

                  <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5">
                    <p className="text-xs text-slate-500">Next Review</p>
                    <p className="font-black text-purple-300 mt-2">
                      Validate before deployment
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Check model comparison, features and evaluation output.
                    </p>
                  </div>
                </div>

                </div>

              </section>
            )}

          </>
        )}

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {!selectedDataset &&
          !datasetsLoading && (
            <div className="mt-5 bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center">

              <FaDatabase className="mx-auto text-4xl text-slate-700" />

              <h3 className="text-lg font-bold mt-4">
                No dataset selected
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Upload a dataset first, then return
                here to train a model.
              </p>

            </div>
          )}

      </div>
    </div>
  );
}

export default MLTraining;