import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaMagic,
  FaEye,
  FaDownload,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";

const API_URL = API_BASE_URL;

const card =
  "bg-slate-900/90 border border-slate-800 rounded-3xl";

/* =========================================================
   AUTH HELPER
========================================================= */

const getAuthHeaders = (json = false) => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login";
    return null;
  }

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
};

function DataCleaning() {
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedColumn, setSelectedColumn] = useState("");
  // Keep the missing-value method independently for every column.
  // Example: { Unit_Sold: "zero", Quantity: "mean" }
  const [missingMethods, setMissingMethods] = useState({});

  const [duplicateMethod, setDuplicateMethod] =
    useState("remove");

  const [typeColumn, setTypeColumn] = useState("");
  const [typeTarget, setTypeTarget] = useState("string");

  const [preview, setPreview] = useState(null);
  const [aiText, setAiText] = useState("");
  const [appliedActions, setAppliedActions] = useState([]);
  const [lastOperation, setLastOperation] = useState("");
  const [selectedRecommendation, setSelectedRecommendation] =
    useState(null);

  const [showTools, setShowTools] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAI, setShowAI] = useState(false);

  /* =====================================================
     HELPERS
  ===================================================== */

  const normalizeColumnName = (column) => {
    if (typeof column === "string") return column;

    if (column && typeof column === "object") {
      return (
        column.name ||
        column.column ||
        column.columnName ||
        ""
      );
    }

    return "";
  };

  const normalizeAnalysis = (data) => {
    const rawColumns =
      Array.isArray(data?.columns)
        ? data.columns
        : Array.isArray(data?.columnNames)
        ? data.columnNames
        : [];

    const columnInfoFromArray = {};

    rawColumns.forEach((item) => {
      if (item && typeof item === "object") {
        const name = normalizeColumnName(item);
        if (name) columnInfoFromArray[name] = item;
      }
    });

    const names = rawColumns
      .map(normalizeColumnName)
      .filter(Boolean);

    const fallbackNames =
      Object.keys(data?.dataTypes || {});

    return {
      ...data,
      columns: names.length ? names : fallbackNames,
      columnsInfo:
        data?.columnsInfo &&
        !Array.isArray(data.columnsInfo)
          ? data.columnsInfo
          : columnInfoFromArray,
      columnKinds:
        data?.columnKinds ||
        data?.columnTypes ||
        {},
      dataTypes: data?.dataTypes || {},
      cleaningRecommendations:
        data?.cleaningRecommendations ||
        data?.suggestions ||
        [],
      charts: data?.charts || [],
      health:
        data?.health || {
          score: data?.healthScore || 0,
          status: data?.healthStatus || "unknown",
        },
      summary: data?.summary || {},
    };
  };

  const columns = Array.isArray(result?.columns)
    ? result.columns
        .map(normalizeColumnName)
        .filter(Boolean)
    : [];

  const columnKind = (column) =>
    String(
      result?.columnKinds?.[column] ||
        result?.dataTypes?.[column] ||
        result?.columnsInfo?.[column]?.detectedType ||
        result?.columnsInfo?.[column]?.dtype ||
        ""
    ).toLowerCase();

  const numeric = (column) =>
    ["numeric", "int", "float", "double", "number"].some(
      (x) => columnKind(column).includes(x)
    );

  const format = (value) =>
    Number(value || 0).toLocaleString();

  const clearNotice = () => {
    setError("");
    setMessage("");
  };

  const safeJson = async (response) => {
    return response.json().catch(() => ({}));
  };

  /* =====================================================
     DATASETS
  ===================================================== */

  const loadDatasets = async () => {
    try {
      setLoading(true);
      clearNotice();

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/datasets`,
        {
          headers,
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        throw new Error(
          data.detail || "Unable to load datasets."
        );
      }

      const list = data.datasets || [];

      setDatasets(list);

      if (!selectedDataset && list.length > 0) {
        setSelectedDataset(list[0].id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  /* =====================================================
     ANALYZE
  ===================================================== */

  const analyze = async () => {
    if (!selectedDataset) {
      setError("Please select a dataset.");
      return;
    }

    try {
      setWorking(true);
      clearNotice();

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${selectedDataset}/analyze`,
        {
          headers,
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        throw new Error(
          data.detail || "Analysis failed."
        );
      }

      const normalized = normalizeAnalysis(data);

      setResult(normalized);

      const first =
        normalized.columns?.[0] || "";

      // Do not jump back to the first column after a cleaning operation.
      setSelectedColumn((current) =>
        normalized.columns?.includes(current)
          ? current
          : first
      );

      setTypeColumn((current) =>
        normalized.columns?.includes(current)
          ? current
          : first
      );

      // Give every column a default only if it has no saved choice.
      setMissingMethods((previous) => {
        const next = { ...previous };

        (normalized.columns || []).forEach((column) => {
          if (next[column]) return;

          const kind = String(
            normalized.columnKinds?.[column] ||
              normalized.dataTypes?.[column] ||
              normalized.columnsInfo?.[column]?.detectedType ||
              ""
          ).toLowerCase();

          const isNumericColumn = [
            "numeric",
            "int",
            "float",
            "double",
            "number",
          ].some((x) => kind.includes(x));

          next[column] = isNumericColumn
            ? "median"
            : "mode";
        });

        return next;
      });

      setPreview(null);

      setMessage(
        "Dataset analyzed successfully."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     SMART AI ANALYSIS
  ===================================================== */

  const analyzeWithAI = async () => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    try {
      setWorking(true);
      clearNotice();

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/ai/clean/${selectedDataset}`,
        {
          headers,
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        throw new Error(
          data.detail ||
            "Smart analysis failed."
        );
      }

      const recommendations =
        (data.suggestions || []).map(
          (item, index) => ({
            id:
              item.id ||
              `recommendation_${index}`,

            issue:
              item.issue ||
              "Data quality issue",

            column:
              item.column || null,

            priority:
              item.priority ||
              (
                item.missingPercentage >= 50
                  ? "HIGH"
                  : "MEDIUM"
              ),

            reason:
              item.recommendation ||
              item.reason ||
              "Review this issue.",

            action:
              item.action === "fill"
                ? `Fill using ${item.method}`
                : item.action === "remove"
                ? "Remove duplicates"
                : item.method ||
                  item.action ||
                  "Review",

            method:
              item.method || "review",

            payload:
              item.payload ||
              (
                item.type === "missing_values"
                  ? {
                      column: item.column,
                      method:
                        item.method || "mode",
                      autoFillOtherMissing: true,
                    }
                  : item.type === "duplicates"
                  ? {
                      method:
                        item.method ||
                        "remove",
                    }
                  : {}
              ),

            autoApplicable:
              item.autoApplicable !== false,
          })
        );

      const normalized = normalizeAnalysis({
        ...data,
        cleaningRecommendations: recommendations,
      });

      setResult(normalized);

      const first =
        normalized.columns?.[0] || "";

      if (!selectedColumn && first) {
        setSelectedColumn(first);
      }

      if (!typeColumn && first) {
        setTypeColumn(first);
      }

      setMessage(
        "Smart AI analysis completed."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     CLEAN OPERATION
  ===================================================== */

  const clean = async (
    operation,
    payload = {},
    successMessage = ""
  ) => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return null;
    }

    try {
      setWorking(true);
      clearNotice();

      const headers = getAuthHeaders(true);

      if (!headers) return null;

      const response = await fetch(
        `${API_URL}/api/dataset/clean/${selectedDataset}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            operation,
            ...payload,
          }),
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return null;
        }

        throw new Error(
          data.detail ||
            data.message ||
            "Cleaning failed."
        );
      }

      const operationLabel =
        successMessage ||
        data.message ||
        `${operation.replaceAll(
          "_",
          " "
        )} completed successfully.`;

      setMessage(operationLabel);
      setLastOperation(operation);

      setAppliedActions((previous) => [
        ...previous,
        {
          operation,
          payload,
          message: operationLabel,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      setPreview(null);

      await analyze();

      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     MISSING VALUES
  ===================================================== */

  const applyMissing = async () => {
    if (!selectedColumn) {
      setError("Select a column first.");
      return;
    }

    clearNotice();

    const selectedMethod =
      missingMethods[selectedColumn] ||
      (numeric(selectedColumn) ? "median" : "mode");

    if (
      !numeric(selectedColumn) &&
      ["mean", "median", "zero"].includes(selectedMethod)
    ) {
      setError(
        `${selectedColumn} is not numeric. Mean, Median and Fill with 0 can only be used on numeric columns.`
      );
      return;
    }

    const headers = getAuthHeaders(true);
    if (!headers) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/dataset/clean/${selectedDataset}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            operation: "missing_values",
            column: selectedColumn,
            method: selectedMethod,
            autoFillOtherMissing: true,
          }),
        }
      );

      const data = await safeJson(response);

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("selectedDatasetId");
        localStorage.removeItem("selectedDatasetName");
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Missing-value cleaning failed."
        );
      }

      setAppliedActions((previous) => [
        ...previous,
        {
          operation: "missing_values",
          payload: {
            column: selectedColumn,
            method: selectedMethod,
            autoFillOtherMissing: true,
          },
          message:
            data.message ||
            `${selectedColumn} cleaned using ${selectedMethod}; other missing columns were auto-filled.`,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      setPreview(null);
      setLastOperation("missing_values");
      setMessage(
        data.message ||
        "Missing values cleaned successfully. Other numeric columns used median and text/category columns used mode."
      );

      await analyze();
    } catch (e) {
      console.error("Automatic missing-value cleaning error:", e);
      setError(
        e.message || "Automatic missing-value cleaning failed."
      );
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     DUPLICATES
  ===================================================== */

  const applyDuplicates = async () => {
    await clean(
      "duplicates",
      {
        method: duplicateMethod,
      }
    );
  };

  /* =====================================================
     DATA TYPE
  ===================================================== */

  const applyType = async () => {
    if (!typeColumn) {
      setError("Select a column first.");
      return;
    }

    await clean(
      "data_type",
      {
        column: typeColumn,
        dataType: typeTarget,
      }
    );
  };

  /* =====================================================
     AUTO CLEAN
  ===================================================== */

  const autoClean = async () => {
    await clean(
      "auto_clean",
      {},
      "Safe automatic cleaning completed. Dataset health has been refreshed."
    );
  };

  /* =====================================================
     RECOMMENDATION NORMALIZER
  ===================================================== */

  const normalizeRecommendation = (
    recommendation
  ) => {
    if (!recommendation) {
      return null;
    }

    let method =
      recommendation.method;

    let payload =
      recommendation.payload || {};

    if (
      recommendation.type ===
        "missing_values" &&
      recommendation.column
    ) {
      method =
        recommendation.method ||
        (
          recommendation.columnType ===
          "numeric"
            ? "median"
            : "mode"
        );

      return {
        operation: "missing_values",
        payload: {
          column:
            recommendation.column,
          method:
            method === "mean" ||
            method === "median" ||
            method === "mode" ||
            method === "zero" ||
            method === "ffill" ||
            method === "bfill"
              ? method
              : "mode",
          autoFillOtherMissing: true,
        },
      };
    }

    if (
      recommendation.type ===
      "duplicates"
    ) {
      return {
        operation: "duplicates",
        payload: {
          method:
            recommendation.method ||
            "remove",
        },
      };
    }

    if (
      recommendation.type ===
      "constant_column"
    ) {
      return {
        operation: "drop_column",
        payload: {
          column:
            recommendation.column,
        },
      };
    }

    // AI recommendations can use human/AI method names that are
    // not themselves backend operation names. Normalize them to the
    // exact operations supported by /api/dataset/clean/{datasetId}.
    const normalizedMethod = String(method || "").trim().toLowerCase();

    if (
      recommendation.type === "missing_values" ||
      recommendation.action === "fill"
    ) {
      const safeMethod = [
        "mean",
        "median",
        "mode",
        "zero",
        "ffill",
        "bfill",
      ].includes(normalizedMethod)
        ? normalizedMethod
        : "mode";

      if (!recommendation.column) {
        return null;
      }

      return {
        operation: "missing_values",
        payload: {
          column: recommendation.column,
          method: safeMethod,
          autoFillOtherMissing: true,
        },
      };
    }

    if (
      recommendation.type === "duplicates" ||
      normalizedMethod === "drop_duplicates" ||
      normalizedMethod === "remove_duplicates"
    ) {
      return {
        operation: "duplicates",
        payload: {
          method:
            normalizedMethod === "keep_last"
              ? "keep_last"
              : "remove",
        },
      };
    }

    if (
      recommendation.type === "constant_column" ||
      normalizedMethod === "drop_column"
    ) {
      if (!recommendation.column) {
        return null;
      }

      return {
        operation: "drop_column",
        payload: {
          column: recommendation.column,
        },
      };
    }

    if (normalizedMethod === "auto_clean") {
      return {
        operation: "auto_clean",
        payload: {},
      };
    }

    // Only pass operations that the backend cleaning engine explicitly
    // supports. Unknown AI methods must become manual-review items.
    const supportedOperations = new Set([
      "missing_values",
      "duplicates",
      "drop_column",
      "data_type",
      "auto_clean",
    ]);

    if (supportedOperations.has(normalizedMethod)) {
      return {
        operation: normalizedMethod,
        payload,
      };
    }

    return null;
  };

  /* =====================================================
     PREVIEW RECOMMENDATION
  ===================================================== */

  const previewRecommendation = async (
    recommendation
  ) => {
    setSelectedRecommendation(
      recommendation
    );

    const normalized =
      normalizeRecommendation(
        recommendation
      );

    if (!normalized) {
      setError(
        "This recommendation cannot be previewed."
      );
      return;
    }

    await makePreview(
      normalized.operation,
      normalized.payload
    );

    setShowPreview(true);
  };

  /* =====================================================
     APPLY RECOMMENDATION
  ===================================================== */

  const applyRecommendation = async (
    recommendation
  ) => {
    const normalized =
      normalizeRecommendation(
        recommendation
      );

    if (!normalized) {
      setError(
        "This recommendation needs manual review."
      );
      return;
    }

    if (
      recommendation.action ===
        "review" ||
      recommendation.method ===
        "review"
    ) {
      setError(
        "This recommendation requires manual review."
      );
      return;
    }

    await clean(
      normalized.operation,
      normalized.payload,
      "AI recommended cleaning applied successfully."
    );
  };

  /* =====================================================
     PREVIEW
  ===================================================== */

  const makePreview = async (
    operation,
    payload = {}
  ) => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    try {
      setPreviewLoading(true);
      clearNotice();

      const headers = getAuthHeaders(true);

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/clean/${selectedDataset}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            operation: "preview",
            previewOperation:
              operation,
            ...payload,
          }),
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        throw new Error(
          data.detail ||
            "Preview failed."
        );
      }

      setPreview(data);
      setShowPreview(true);

      setMessage(
        "Preview generated. No changes have been applied."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* =====================================================
     AI CHAT
  ===================================================== */

  const askAI = async () => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    try {
      setWorking(true);
      clearNotice();
      setAiText("");

      const headers = getAuthHeaders(true);

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            datasetId:
              selectedDataset,

            question:
              "Analyze this dataset and give me a practical column-by-column data cleaning plan. Tell me exactly what should be filled, dropped, converted or reviewed and why. Do not claim that anything has already been changed.",
          }),
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        throw new Error(
          data.detail ||
            "AI recommendation failed."
        );
      }

      setAiText(
        data.answer ||
          "No AI explanation was returned."
      );

      setShowAI(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  const download = async () => {
    if (!selectedDataset) {
      setError("Please select a dataset first.");
      return;
    }

    try {
      setWorking(true);
      clearNotice();

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/clean/${selectedDataset}/download`,
        {
          headers,
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("selectedDatasetId");
          localStorage.removeItem("selectedDatasetName");
          window.location.href = "/login";
          return;
        }

        const data =
          await safeJson(response);

        throw new Error(
          data.detail ||
            "Apply a cleaning operation first."
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      const contentDisposition =
        response.headers.get(
          "content-disposition"
        );

      const filename =
        contentDisposition
          ?.match(
            /filename="?([^"]+)"?/
          )?.[1] ||
        "cleaned_dataset.xlsx";

      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      setMessage(
        "Cleaned dataset downloaded successfully."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };

  /* =====================================================
     CHARTS
  ===================================================== */

  const charts = useMemo(
    () => result?.charts || [],
    [result]
  );

  const Chart = ({ chart }) => {
    const data = chart?.data || [];

    if (!data.length) {
      return (
        <div className="bg-slate-950 rounded-2xl p-6 text-gray-400">
          No chart data available.
        </div>
      );
    }

    if (
      !["bar", "histogram", "line"].includes(
        chart.type
      )
    ) {
      return (
        <div className="bg-slate-950 rounded-2xl p-6">
          <h4 className="font-bold">
            {chart.title || "Chart"}
          </h4>

          <pre className="text-xs text-gray-400 mt-4 overflow-auto">
            {JSON.stringify(
              data,
              null,
              2
            )}
          </pre>
        </div>
      );
    }

    const max = Math.max(
      ...data.map(
        (x) =>
          Number(x.value) || 0
      ),
      1
    );

    const width = 760;
    const height = 300;
    const left = 55;
    const right = 20;
    const top = 25;
    const bottom = 60;

    const usableW =
      width - left - right;

    const usableH =
      height - top - bottom;

    const step =
      usableW /
      Math.max(data.length, 1);

    const points =
      data.map((item, index) => [
        left +
          index * step +
          step / 2,

        top +
          usableH -
          ((Number(item.value) || 0) /
            max) *
            usableH,
      ]);

    return (
      <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800">
        <h4 className="font-black text-lg mb-4">
          {chart.title ||
            chart.name ||
            "Visualization"}
        </h4>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[650px] w-full h-72"
          >
            <line
              x1={left}
              y1={top}
              x2={left}
              y2={height - bottom}
              stroke="currentColor"
              opacity=".2"
            />

            <line
              x1={left}
              y1={height - bottom}
              x2={width - right}
              y2={height - bottom}
              stroke="currentColor"
              opacity=".2"
            />

            {chart.type ===
            "line" ? (
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                points={points
                  .map((p) =>
                    p.join(",")
                  )
                  .join(" ")}
              />
            ) : (
              data.map(
                (item, index) => {
                  const value =
                    Number(
                      item.value
                    ) || 0;

                  const barHeight =
                    (value / max) *
                    usableH;

                  return (
                    <rect
                      key={index}
                      x={
                        left +
                        index *
                          step +
                        step *
                          0.15
                      }
                      y={
                        top +
                        usableH -
                        barHeight
                      }
                      width={
                        step * 0.7
                      }
                      height={
                        barHeight
                      }
                      rx="6"
                      opacity=".8"
                    />
                  );
                }
              )
            )}

            {points.map(
              (point, index) => (
                <circle
                  key={index}
                  cx={point[0]}
                  cy={point[1]}
                  r="4"
                  fill="currentColor"
                />
              )
            )}

            {data.map(
              (item, index) => (
                <text
                  key={index}
                  x={
                    left +
                    index *
                      step +
                    step / 2
                  }
                  y={
                    height -
                    25
                  }
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  opacity=".7"
                >
                  {String(
                    item.label ??
                      item.name ??
                      ""
                  ).slice(
                    0,
                    14
                  )}
                </text>
              )
            )}
          </svg>
        </div>
      </div>
    );
  };

  /* =====================================================
     TABLE
  ===================================================== */

  const DataTable = ({
    data,
    title,
  }) => {
    if (
      !Array.isArray(data) ||
      !data.length
    ) {
      return (
        <div className="bg-slate-950 rounded-2xl p-6 text-gray-400">
          No preview data available.
        </div>
      );
    }

    const cols =
      Object.keys(data[0]);

    return (
      <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800 font-black">
          {title}
        </div>

        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {cols.map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left px-5 py-3 text-cyan-400 whitespace-nowrap bg-slate-950 sticky top-0"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {data.map(
                (row, index) => (
                  <tr
                    key={index}
                    className="border-t border-slate-900"
                  >
                    {cols.map(
                      (col) => {
                        const value =
                          row[col];

                        return (
                          <td
                            key={col}
                            className="px-5 py-3 whitespace-nowrap text-gray-300"
                          >
                            {value ===
                              null ||
                            value ===
                              undefined ||
                            value === ""
                              ? "—"
                              : String(
                                  value
                                )}
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
      </div>
    );
  };

  /* =====================================================
     RECOMMENDATIONS
  ===================================================== */

  const recommendations =
    result?.cleaningRecommendations ||
    [];

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* BACK */}
        <button
          onClick={() =>
            navigate("/agents")
          }
          className="text-gray-400 hover:text-cyan-400 mb-8"
        >
          ← Back to AI Agents
        </button>

        {/* HEADER */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-4 py-2 rounded-full text-sm font-black">
                🤖 INTELLIGENT DATA CLEANING
              </div>

              <h1 className="text-5xl font-black mt-5">
                Data Cleaning{" "}
                <span className="text-cyan-400">
                  Agent
                </span>
              </h1>

              <p className="text-gray-400 text-lg mt-4 max-w-3xl">
                AI inspects the real dataset, prioritizes quality issues,
                previews safe transformations and keeps every applied action
                traceable.
              </p>
            </div>

            {selectedDataset && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 min-w-[240px]">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-black">
                  Active Dataset
                </p>

                <p className="font-bold mt-1 truncate">
                  {datasets.find(
                    (d) =>
                      String(d.id) ===
                      String(
                        selectedDataset
                      )
                  )?.fileName ||
                    "Selected dataset"}
                </p>

                <p className="text-xs text-green-400 mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Ready for cleaning
                </p>
              </div>
            )}
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-5">
            <b>Error:</b>{" "}
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="mb-5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-2xl p-5">
            ✓ {message}
          </div>
        )}

        {/* DATASET */}
        <section
          className={`${card} p-7`}
        >
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-cyan-400 text-sm font-black">
                STEP 01
              </p>

              <h2 className="text-2xl font-black mt-1">
                Select Dataset
              </h2>

              <p className="text-gray-400 mt-2">
                Choose the uploaded CSV or Excel
                dataset you want NexusDS AI to inspect.
              </p>
            </div>

            <button
              onClick={
                loadDatasets
              }
              disabled={loading}
              className="border border-slate-700 px-5 py-3 rounded-xl hover:border-cyan-400 disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <select
              value={
                selectedDataset
              }
              onChange={(e) => {
                setSelectedDataset(
                  e.target.value
                );

                setResult(null);
                setPreview(null);
                setAiText("");
                setAppliedActions([]);
                setLastOperation("");
                setSelectedRecommendation(null);

                clearNotice();
              }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 outline-none focus:border-cyan-400"
            >
              <option value="">
                {loading
                  ? "Loading datasets..."
                  : "Select Dataset"}
              </option>

              {datasets.map(
                (dataset) => (
                  <option
                    key={dataset.id}
                    value={
                      dataset.id
                    }
                  >
                    {dataset.fileName}
                  </option>
                )
              )}
            </select>

            <button
              onClick={
                analyze
              }
              disabled={
                !selectedDataset ||
                working
              }
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-4 rounded-xl font-black disabled:bg-slate-700 disabled:text-gray-500"
            >
              {working
                ? "Processing..."
                : "Analyze Dataset →"}
            </button>

            <button
              onClick={
                analyzeWithAI
              }
              disabled={
                !selectedDataset ||
                working
              }
              className="bg-purple-500 hover:bg-purple-400 text-white px-8 py-4 rounded-xl font-black disabled:bg-slate-700 disabled:text-gray-500"
            >
              ✦ Smart AI Scan
            </button>
          </div>
        </section>

        {result && (
          <>
            {/* HEALTH */}
            <section className="mt-8">
              <div className="flex justify-between items-end mb-5">
                <div>
                  <p className="text-cyan-400 text-sm font-black">
                    DATA QUALITY
                  </p>

                  <h2 className="text-3xl font-black">
                    Dataset Health
                  </h2>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
                <div
                  className={`${card} p-6`}
                >
                  <p className="text-gray-400">
                    Health Score
                  </p>

                  <p className="text-5xl font-black text-cyan-400 mt-2">
                    {format(
                      result.health?.score
                    )}
                    <span className="text-xl">
                      /100
                    </span>
                  </p>

                  <p className="text-gray-500 mt-2 capitalize">
                    {result.health?.status ||
                      "unknown"}
                  </p>
                </div>

                <div
                  className={`${card} p-6`}
                >
                  <p className="text-gray-400">
                    Rows
                  </p>

                  <p className="text-4xl font-black mt-2">
                    {format(
                      result.dataset
                        ?.rows
                    )}
                  </p>
                </div>

                <div
                  className={`${card} p-6`}
                >
                  <p className="text-gray-400">
                    Missing Values
                  </p>

                  <p className="text-4xl font-black text-yellow-400 mt-2">
                    {format(
                      result.summary
                        ?.totalMissingValues
                    )}
                  </p>
                </div>

                <div
                  className={`${card} p-6`}
                >
                  <p className="text-gray-400">
                    Duplicate Rows
                  </p>

                  <p className="text-4xl font-black text-orange-400 mt-2">
                    {format(
                      result.summary
                        ?.duplicateRows
                    )}
                  </p>
                </div>

                <div className={`${card} p-6`}>
                  <p className="text-gray-400">
                    Applied Actions
                  </p>

                  <p className="text-4xl font-black text-green-400 mt-2">
                    {appliedActions.length}
                  </p>

                  <p className="text-gray-500 mt-2 text-sm">
                    This cleaning session
                  </p>
                </div>
              </div>

              {lastOperation && (
                <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-2xl px-5 py-3 text-sm text-green-300 flex items-center gap-2">
                  <FaCheckCircle />
                  Last operation:{" "}
                  <span className="font-bold">
                    {lastOperation.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>
              )}
            </section>

            {/* SMART PLAN */}
            <section
              className={`${card} mt-8 p-7`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                  <p className="text-green-400 text-sm font-black">
                    STEP 02
                  </p>

                  <h2 className="text-3xl font-black">
                    Smart Cleaning Plan
                  </h2>

                  <p className="text-gray-400 mt-2">
                    Recommendations are based on
                    the actual dataset structure.
                  </p>
                </div>

                <button
                  onClick={
                    autoClean
                  }
                  disabled={
                    working
                  }
                  className="bg-green-500 hover:bg-green-400 text-slate-950 px-6 py-3 rounded-xl font-black disabled:bg-slate-700"
                >
                  ⚡ Auto Clean Safe Issues
                </button>
              </div>

              <div className="space-y-4 mt-7">
                {recommendations.length >
                0 ? (
                  recommendations.map(
                    (rec, index) => {
                      const normalized =
                        normalizeRecommendation(
                          rec
                        );

                      const manual =
                        !normalized ||
                        rec.action ===
                          "review" ||
                        rec.method ===
                          "review";

                      return (
                        <div
                          key={
                            rec.id ||
                            index
                          }
                          className={`bg-slate-800/70 border rounded-2xl p-5 transition ${
                            selectedRecommendation ===
                            rec
                              ? "border-cyan-400/60 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
                              : "border-slate-700"
                          }`}
                        >
                          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                            <div>
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="font-black text-lg">
                                  {rec.issue ||
                                    "Data quality issue"}

                                  {rec.column
                                    ? ` — ${rec.column}`
                                    : ""}
                                </span>

                                <span className="text-xs font-black px-2 py-1 rounded-md bg-slate-700 text-gray-300">
                                  {rec.priority ||
                                    "REVIEW"}
                                </span>
                              </div>

                              <p className="text-gray-400 mt-2">
                                {rec.reason ||
                                  rec.recommendation ||
                                  "Review this issue."}
                              </p>

                              <p className="text-cyan-400 text-sm font-black mt-2">
                                Recommended:{" "}
                                {rec.action ||
                                  rec.method ||
                                  "Review"}
                              </p>
                            </div>

                            <div className="flex gap-3 shrink-0">
                              <button
                                onClick={() =>
                                  previewRecommendation(
                                    rec
                                  )
                                }
                                disabled={
                                  manual ||
                                  previewLoading
                                }
                                className="border border-cyan-500/50 text-cyan-400 px-4 py-3 rounded-xl font-black disabled:opacity-30"
                              >
                                👁 Preview
                              </button>

                              <button
                                onClick={() =>
                                  applyRecommendation(
                                    rec
                                  )
                                }
                                disabled={
                                  working ||
                                  manual
                                }
                                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-3 rounded-xl font-black disabled:bg-slate-700 disabled:text-gray-500"
                              >
                                ✓ Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                ) : (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 text-green-300">
                    ✓ No obvious automatic cleaning
                    issue was detected.
                  </div>
                )}
              </div>
            </section>

            {/* PREVIEW */}
            {preview && showPreview && (
              <section
                className={`${card} mt-8 p-7`}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-cyan-400 text-sm font-black">
                      READ-ONLY PREVIEW
                    </p>

                    <h2 className="text-3xl font-black">
                      Before → After
                    </h2>

                    <p className="text-gray-400 mt-2">
                      {preview.message ||
                        "Simulated result. Nothing has been applied yet."}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setShowPreview(
                        false
                      )
                    }
                    className="text-gray-400 hover:text-white text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-gray-400">
                      Rows
                    </p>

                    <b className="text-xl">
                      {format(
                        preview.beforeRows
                      )}{" "}
                      →{" "}
                      {format(
                        preview.afterRows
                      )}
                    </b>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-gray-400">
                      Missing
                    </p>

                    <b className="text-xl">
                      {format(
                        preview.beforeMissing
                      )}{" "}
                      →{" "}
                      {format(
                        preview.afterMissing
                      )}
                    </b>
                  </div>

                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-gray-400">
                      Duplicates
                    </p>

                    <b className="text-xl">
                      {format(
                        preview.beforeDuplicates
                      )}{" "}
                      →{" "}
                      {format(
                        preview.afterDuplicates
                      )}
                    </b>
                  </div>
                </div>

                <div className="grid xl:grid-cols-2 gap-6 mt-7">
                  <DataTable
                    data={
                      preview.before
                    }
                    title="BEFORE — Original"
                  />

                  <DataTable
                    data={
                      preview.after
                    }
                    title="AFTER — Simulated"
                  />
                </div>
              </section>
            )}

            {/* MANUAL TOOLS */}
            <section className="mt-8">
              <button
                onClick={() =>
                  setShowTools(
                    !showTools
                  )
                }
                className={`${card} w-full p-6 flex justify-between items-center hover:border-cyan-500/40`}
              >
                <div className="text-left">
                  <p className="text-cyan-400 text-sm font-black">
                    ADVANCED
                  </p>

                  <h2 className="text-2xl font-black">
                    Manual Cleaning Tools
                  </h2>
                </div>

                <span className="text-2xl">
                  {showTools
                    ? "−"
                    : "+"}
                </span>
              </button>

              {showTools && (
                <div className="grid lg:grid-cols-2 gap-6 mt-5">
                  {/* MISSING */}
                  <div
                    className={`${card} p-7`}
                  >
                    <h3 className="text-2xl font-black">
                      Missing Values
                    </h3>

                    <p className="text-gray-400 mt-2">
                      Choose a method appropriate
                      for the selected column.
                    </p>

                    <select
                      value={
                        selectedColumn
                      }
                      onChange={(e) => {
                        const column =
                          e.target
                            .value;

                        setSelectedColumn(
                          column
                        );

                        setMissingMethods(
                          (previous) => ({
                            ...previous,
                            [column]:
                              previous[column] ||
                              (numeric(column)
                                ? "median"
                                : "mode"),
                          })
                        );
                      }}
                      className="w-full mt-6 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {columns.map(
                        (column) => (
                          <option
                            key={
                              column
                            }
                            value={
                              column
                            }
                          >
                            {column}
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={
                        missingMethods[selectedColumn] ||
                        (numeric(selectedColumn)
                          ? "median"
                          : "mode")
                      }
                      onChange={(e) =>
                        setMissingMethods(
                          (previous) => ({
                            ...previous,
                            [selectedColumn]:
                              e.target.value,
                          })
                        )
                      }
                      className="w-full mt-4 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {numeric(
                        selectedColumn
                      ) ? (
                        <>
                          <option value="median">
                            Median
                          </option>

                          <option value="mean">
                            Mean
                          </option>

                          <option value="zero">
                            Fill with 0
                          </option>

                          <option value="ffill">
                            Forward Fill (Previous Value)
                          </option>

                          <option value="bfill">
                            Backward Fill (Next Value)
                          </option>
                        </>
                      ) : (
                        <>
                          <option value="mode">
                            Most Frequent Value
                          </option>

                          <option value="ffill">
                            Forward Fill (Previous Value)
                          </option>

                          <option value="bfill">
                            Backward Fill (Next Value)
                          </option>
                        </>
                      )}
                    </select>

                    <button
                      onClick={
                        applyMissing
                      }
                      disabled={
                        working
                      }
                      className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-3 rounded-xl font-black disabled:bg-slate-700"
                    >
                      Apply Missing-Value Cleaning
                    </button>
                  </div>

                  {/* DUPLICATES */}
                  <div
                    className={`${card} p-7`}
                  >
                    <h3 className="text-2xl font-black">
                      Duplicate Rows
                    </h3>

                    <p className="text-gray-400 mt-2">
                      Remove exact duplicate rows.
                    </p>

                    <select
                      value={
                        duplicateMethod
                      }
                      onChange={(e) =>
                        setDuplicateMethod(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-6 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      <option value="remove">
                        Remove Duplicates
                      </option>
                    </select>

                    <button
                      onClick={
                        applyDuplicates
                      }
                      disabled={
                        working
                      }
                      className="w-full mt-4 bg-orange-500 hover:bg-orange-400 text-slate-950 py-3 rounded-xl font-black disabled:bg-slate-700"
                    >
                      Remove Duplicate Rows
                    </button>
                  </div>

                  {/* DATA TYPE */}
                  <div
                    className={`${card} p-7 lg:col-span-2`}
                  >
                    <h3 className="text-2xl font-black">
                      Data Type Conversion
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                      <select
                        value={
                          typeColumn
                        }
                        onChange={(e) =>
                          setTypeColumn(
                            e.target
                              .value
                          )
                        }
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                      >
                        {columns.map(
                          (column) => (
                            <option
                              key={
                                column
                              }
                              value={
                                column
                              }
                            >
                              {column}
                            </option>
                          )
                        )}
                      </select>

                      <select
                        value={
                          typeTarget
                        }
                        onChange={(e) =>
                          setTypeTarget(
                            e.target
                              .value
                          )
                        }
                        className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                      >
                        <option value="string">
                          String
                        </option>

                        <option value="numeric">
                          Numeric
                        </option>

                        <option value="datetime">
                          Date / Time
                        </option>
                      </select>
                    </div>

                    <button
                      onClick={
                        applyType
                      }
                      disabled={
                        working
                      }
                      className="mt-4 bg-purple-500 hover:bg-purple-400 px-6 py-3 rounded-xl font-black"
                    >
                      Convert Data Type
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* CHARTS */}
            <section className="mt-8">
              <button
                onClick={() =>
                  setShowCharts(
                    !showCharts
                  )
                }
                className={`${card} w-full p-6 flex justify-between items-center hover:border-cyan-500/40`}
              >
                <div className="text-left">
                  <p className="text-cyan-400 text-sm font-black">
                    VISUAL ANALYSIS
                  </p>

                  <h2 className="text-2xl font-black">
                    Dataset Charts
                  </h2>
                </div>

                <span className="text-2xl">
                  {showCharts
                    ? "−"
                    : "+"}
                </span>
              </button>

              {showCharts && (
                <div className="grid xl:grid-cols-2 gap-6 mt-5">
                  {charts.length ? (
                    charts.map(
                      (
                        chart,
                        index
                      ) => (
                        <Chart
                          key={
                            chart.id ||
                            index
                          }
                          chart={
                            chart
                          }
                        />
                      )
                    )
                  ) : (
                    <div
                      className={`${card} p-7 text-gray-400 xl:col-span-2`}
                    >
                      No charts were returned
                      by the dataset analyzer.
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* AI EXPLANATION */}
            <section className="mt-8">
              <button
                onClick={() =>
                  setShowAI(
                    !showAI
                  )
                }
                className={`${card} w-full p-6 flex justify-between items-center hover:border-purple-500/40`}
              >
                <div className="text-left">
                  <p className="text-purple-400 text-sm font-black">
                    AI INSIGHT
                  </p>

                  <h2 className="text-2xl font-black">
                    Ask NexusDS AI
                  </h2>
                </div>

                <span className="text-2xl">
                  {showAI
                    ? "−"
                    : "+"}
                </span>
              </button>

              {showAI && (
                <div
                  className={`${card} mt-5 p-7`}
                >
                  <button
                    onClick={
                      askAI
                    }
                    disabled={
                      working
                    }
                    className="bg-purple-500 hover:bg-purple-400 px-6 py-3 rounded-xl font-black"
                  >
                    ✦ Generate AI Cleaning Explanation
                  </button>

                  {aiText && (
                    <div className="mt-6 bg-slate-950 rounded-2xl p-6 whitespace-pre-wrap text-gray-300 leading-7">
                      {aiText}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ACTION HISTORY */}
            {appliedActions.length > 0 && (
              <section className={`${card} mt-8 p-7`}>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-green-400 text-sm font-black">
                      AUDIT TRAIL
                    </p>

                    <h2 className="text-2xl font-black">
                      Cleaning Session History
                    </h2>

                    <p className="text-gray-400 mt-1 text-sm">
                      Actions applied to this dataset during the current session.
                    </p>
                  </div>

                  <FaCheckCircle className="text-green-400 text-2xl" />
                </div>

                <div className="space-y-3">
                  {appliedActions.map(
                    (action, index) => (
                      <div
                        key={`${action.time}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
                            <FaCheckCircle />
                          </span>

                          <div>
                            <p className="font-bold capitalize">
                              {action.operation.replaceAll(
                                "_",
                                " "
                              )}
                            </p>

                            <p className="text-xs text-gray-500">
                              {action.message}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs text-gray-500">
                          {action.time}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {/* DOWNLOAD */}
            <section
              className={`${card} mt-8 p-7`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <p className="text-cyan-400 text-sm font-black">
                    FINAL OUTPUT
                  </p>

                  <h2 className="text-2xl font-black">
                    Download Clean Dataset
                  </h2>

                  <p className="text-gray-400 mt-2">
                    Download the current cleaned dataset after applying the required
                    transformations. Re-analyze anytime to verify the updated quality.
                  </p>
                </div>

                <button
                  onClick={
                    download
                  }
                  disabled={
                    working
                  }
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-7 py-4 rounded-xl font-black disabled:bg-slate-700"
                >
                  ↓ Download Clean File
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default DataCleaning;