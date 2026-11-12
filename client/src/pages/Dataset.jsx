import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaDatabase,
  FaShieldAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaArrowRight,
  FaBrain,
  FaChartLine,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL || "https://nexusds-ai.onrender.com";

const SUPPORTED_EXTENSIONS = [
  "csv",
  "xlsx",
  "xls",
  "pdf",
  "docx",
  "doc",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
];

const SUPPORTED_LABELS = [
  "CSV",
  "Excel",
  "PDF",
  "Word",
  "JPG",
  "PNG",
  "WEBP",
  "BMP",
  "TIFF",
];

function Dataset() {
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [deletingId, setDeletingId] = useState("");

  // Dataset preview modal state
  const [previewDataset, setPreviewDataset] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [convertedDatasetId, setConvertedDatasetId] = useState("");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [search, setSearch] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [analysis, setAnalysis] = useState(null);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const logoutToLogin = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDatasetId");
    localStorage.removeItem("selectedDatasetName");
    localStorage.removeItem("datasetPath");

    window.location.href = "/login";
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/dataset/datasets`,
        {
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Failed to load datasets."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message || "Unable to load datasets."
        );
      }

      setDatasets(data.datasets || []);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to connect to backend server."
      );
    } finally {
      setLoading(false);
    }
  };

  const processSelectedFile = (file) => {
    if (!file) return;

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setSelectedFile(null);
      setError(
        "Unsupported file. Use CSV, Excel, PDF, Word, JPG, PNG, WEBP, BMP or TIFF."
      );
      return;
    }

    setSelectedFile(file);
    setError("");
    setMessage("");
    setAnalysis(null);
    setAnalysisError("");
    setConversion(null);
    setConvertedDatasetId("");
  };

  const handleFileChange = (event) => {
    processSelectedFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    processSelectedFile(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a supported file first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");
      setAnalysis(null);
      setAnalysisError("");

      const formData = new FormData();
      formData.append("dataset", selectedFile);

      const response = await fetch(
        `${API_URL}/api/dataset/upload`,
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Dataset upload failed."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message || "Dataset upload failed."
        );
      }

      setMessage(
        data.conversion?.created
          ? "File processed, converted to Excel/CSV, and saved successfully."
          : "Dataset uploaded successfully."
      );

      setConversion(data.conversion || null);
      setConvertedDatasetId(data.dataset?.id || "");
      setSelectedFile(null);

      const fileInput =
        document.getElementById("dataset-upload");

      if (fileInput) {
        fileInput.value = "";
      }

      await fetchDatasets();

      if (data.dataset?.id) {
        selectDataset(data.dataset.id);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to upload dataset."
      );
    } finally {
      setUploading(false);
    }
  };

  const selectDataset = (datasetId) => {
    setSelectedDataset(String(datasetId));
    setAnalysis(null);
    setAnalysisError("");

    const dataset = datasets.find(
      (item) => String(item.id) === String(datasetId)
    );

    if (dataset) {
      localStorage.setItem(
        "selectedDatasetId",
        String(dataset.id)
      );

      localStorage.setItem(
        "selectedDatasetName",
        dataset.fileName || ""
      );
    }
  };

  const handleDatasetChange = (event) => {
    const id = event.target.value;

    if (!id) {
      setSelectedDataset("");
      setAnalysis(null);
      setAnalysisError("");

      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");
      return;
    }

    selectDataset(id);
    setMessage("");
  };

  const downloadConvertedFile = async (
    datasetId,
    type,
    fallbackName
  ) => {
    if (!datasetId) return;

    try {
      setError("");

      const endpoint =
        type === "excel"
          ? `/api/dataset/datasets/${datasetId}/converted-excel`
          : `/api/dataset/datasets/${datasetId}/converted-csv`;

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.detail ||
            `Unable to download converted ${type.toUpperCase()} file.`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        fallbackName ||
        (type === "excel"
          ? "NexusDS_Converted_Dataset.xlsx"
          : "NexusDS_Converted_Dataset.csv");

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error(
        "Converted file download error:",
        err
      );

      setError(
        err.message ||
          "Unable to download converted file."
      );
    }
  };

  const handlePreviewDataset = async (dataset) => {
    if (!dataset?.id) return;

    try {
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewDataset({
        dataset,
        columns: [],
        preview: [],
        rows: 0,
      });

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${dataset.id}/analyze`,
        {
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load dataset preview."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to load dataset preview."
        );
      }

      setPreviewDataset({
        dataset,
        columns: Array.isArray(data.columns)
          ? data.columns
          : [],
        preview: Array.isArray(data.preview)
          ? data.preview
          : [],
        rows:
          Number(
            data.totalRows ??
              data.rows ??
              data.summary?.rows ??
              dataset.rows ??
              0
          ) || 0,
      });
    } catch (err) {
      console.error("Dataset preview error:", err);
      setPreviewDataset(null);
      setPreviewError(
        err.message ||
          "Unable to load dataset preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDataset(null);
    setPreviewError("");
    setPreviewLoading(false);
  };

  const handleDownloadDataset = async (dataset) => {
    if (!dataset?.id) return;

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${dataset.id}/download`,
        {
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.detail ||
            "Unable to download dataset."
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        dataset.fileName || "dataset";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error(
        "Dataset download error:",
        err
      );

      setError(
        err.message ||
          "Unable to download dataset."
      );
    }
  };

  const handleCleanDataset = (datasetId) => {
    if (!datasetId) return;

    selectDataset(datasetId);

    navigate("/agents/data-cleaning");
  };

  const handleDeleteDataset = async (dataset) => {
    if (!dataset?.id) return;

    const confirmed = window.confirm(
      `Delete "${dataset.fileName}" permanently?\n\nThis will remove the dataset from NexusDS AI storage and cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(String(dataset.id));
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${dataset.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to delete dataset."
        );
      }

      if (
        String(selectedDataset) ===
        String(dataset.id)
      ) {
        setSelectedDataset("");
        setAnalysis(null);
        setAnalysisError("");

        localStorage.removeItem(
          "selectedDatasetId"
        );
        localStorage.removeItem(
          "selectedDatasetName"
        );
        localStorage.removeItem("datasetPath");
      }

      if (
        String(convertedDatasetId) ===
        String(dataset.id)
      ) {
        setConversion(null);
        setConvertedDatasetId("");
      }

      setMessage(
        `"${dataset.fileName}" deleted successfully.`
      );

      await fetchDatasets();
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to delete dataset."
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleAnalyzeDataset = async () => {
    if (!selectedDataset) {
      setAnalysisError(
        "Please select a dataset first."
      );
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisError("");
      setAnalysis(null);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${selectedDataset}/analyze`,
        {
          headers: authHeaders(),
        }
      );

      if (response.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to analyze dataset."
        );
      }

      if (!data.success) {
        throw new Error(
          data.message ||
            "Dataset analysis failed."
        );
      }

      setAnalysis(data);
    } catch (err) {
      console.error(err);
      setAnalysisError(
        err.message ||
          "Unable to analyze dataset."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setConversion(null);
    setConvertedDatasetId("");

    const fileInput =
      document.getElementById("dataset-upload");

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const getFileType = (fileName = "") => {
    const extension = fileName
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "bmp",
        "tif",
        "tiff",
      ].includes(extension)
    ) {
      return "IMAGE";
    }

    if (extension === "pdf") return "PDF";

    if (["doc", "docx"].includes(extension)) {
      return "WORD";
    }

    if (extension === "csv") return "CSV";

    if (["xlsx", "xls"].includes(extension)) {
      return "EXCEL";
    }

    return "FILE";
  };

  const getTypeStyle = (type) => {
    const styles = {
      CSV:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      EXCEL:
        "border-green-400/20 bg-green-400/10 text-green-300",
      PDF:
        "border-red-400/20 bg-red-400/10 text-red-300",
      WORD:
        "border-blue-400/20 bg-blue-400/10 text-blue-300",
      IMAGE:
        "border-violet-400/20 bg-violet-400/10 text-violet-300",
      FILE:
        "border-slate-600 bg-slate-800 text-slate-300",
    };

    return styles[type] || styles.FILE;
  };

  const getTypeIcon = (type) => {
    const icons = {
      CSV: "▤",
      EXCEL: "▦",
      PDF: "▧",
      WORD: "▤",
      IMAGE: "▧",
      FILE: "□",
    };

    return icons[type] || "□";
  };

  const formatNumber = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "0";
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return String(value);
    }

    return numericValue.toLocaleString();
  };

  const formatBytes = (value) => {
    if (!value || Number(value) <= 0) {
      return "—";
    }

    const units = ["B", "KB", "MB", "GB"];
    let size = Number(value);
    let index = 0;

    while (
      size >= 1024 &&
      index < units.length - 1
    ) {
      size /= 1024;
      index += 1;
    }

    return `${size.toFixed(
      size >= 10 || index === 0 ? 0 : 1
    )} ${units[index]}`;
  };

  const getDatasetRows = (dataset) =>
    dataset?.rows ??
    dataset?.rowCount ??
    dataset?.totalRows ??
    dataset?.records ??
    null;

  const getDatasetColumns = (dataset) =>
    dataset?.columns ??
    dataset?.columnCount ??
    null;

  const getDatasetSize = (dataset) =>
    dataset?.size ??
    dataset?.fileSize ??
    dataset?.sizeBytes ??
    null;

  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return datasets;
    }

    return datasets.filter((dataset) => {
      const name = String(
        dataset.fileName || ""
      ).toLowerCase();

      const type = getFileType(
        dataset.fileName
      ).toLowerCase();

      return (
        name.includes(query) ||
        type.includes(query)
      );
    });
  }, [datasets, search]);

  // Active dataset information used by the professional workspace UI.
  const selectedDatasetInfo = datasets.find(
    (item) =>
      String(item.id) === String(selectedDataset)
  );

  const selectedRows = Number(
    analysis?.summary?.rows ??
      getDatasetRows(selectedDatasetInfo) ??
      0
  );

  const selectedDuplicates = Number(
    analysis?.summary?.duplicateRows ?? 0
  );

  const selectedMissing = Number(
    analysis?.summary?.totalMissingValues ?? 0
  );

  const missingRate =
    selectedRows > 0
      ? Math.min(100, (selectedMissing / Math.max(1, selectedRows)) * 100)
      : 0;

  const duplicateRate =
    selectedRows > 0
      ? Math.min(100, (selectedDuplicates / Math.max(1, selectedRows)) * 100)
      : 0;

  const dataHealthScore = analysis
    ? Math.max(
        0,
        Math.round(
          100 -
            Math.min(45, missingRate * 0.7) -
            Math.min(30, duplicateRate * 0.8)
        )
      )
    : null;

  const healthLabel =
    dataHealthScore === null
      ? "Awaiting analysis"
      : dataHealthScore >= 90
      ? "Excellent"
      : dataHealthScore >= 75
      ? "Good"
      : dataHealthScore >= 50
      ? "Needs attention"
      : "Needs improvement";

  const healthMessage =
    dataHealthScore === null
      ? "Run analysis to let NexusDS evaluate the dataset quality."
      : dataHealthScore >= 90
      ? "The dataset looks healthy and is ready for deeper analysis."
      : dataHealthScore >= 75
      ? "The dataset is usable, but a few quality improvements may help."
      : "Clean the dataset before relying on advanced analytics or ML results.";

  const numericColumnCount = analysis
    ? Object.keys(analysis.statistics || {}).length
    : 0;

  const categoricalColumnCount = analysis
    ? Math.max(
        0,
        (analysis.columns?.length || 0) - numericColumnCount
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Workspace header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-300 transition font-medium"
          >
            <span className="text-lg">←</span>
            Dashboard
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-bold tracking-wider text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            DATA WORKSPACE
          </div>
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-7 sm:p-10 shadow-2xl shadow-cyan-950/10">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -left-24 -bottom-32 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <div className="text-xs font-bold tracking-[0.25em] text-cyan-400 uppercase">
                NexusDS AI / Workspace
              </div>

              <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight">
                Data{" "}
                <span className="text-cyan-400">
                  Workspace
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-slate-400 text-base sm:text-lg leading-7">
                Upload, convert, inspect and prepare
                your data for autonomous analysis.
                NexusDS AI accepts structured files,
                documents, PDFs and images and turns
                them into analysis-ready datasets.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[250px]">
              <div className="rounded-2xl border border-white/5 bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">
                  Your Datasets
                </div>

                <div className="mt-1 text-2xl font-black">
                  {loading
                    ? "—"
                    : formatNumber(datasets.length)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">
                  Uploaded File Types
                </div>

                <div className="mt-1 text-2xl font-black text-cyan-300">
                  {new Set(
                    datasets.map((dataset) =>
                      getFileType(dataset.fileName)
                    )
                  ).size}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback */}
        {message && (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4">
            <div className="flex items-center gap-3 text-emerald-300">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 font-bold">
                ✓
              </span>

              <span className="text-sm font-medium">
                {message}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 px-5 py-4">
            <div className="flex items-start gap-3 text-red-300">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-400/10 font-bold">
                !
              </span>

              <div>
                <div className="font-semibold">
                  Something went wrong
                </div>

                <div className="mt-1 text-sm text-red-300/80">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload */}
        <section className="mt-8 rounded-[2rem] border border-white/5 bg-slate-900/80 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
                Universal Ingestion
              </div>

              <h2 className="mt-2 text-2xl sm:text-3xl font-black">
                Add a dataset
              </h2>

              <p className="mt-2 max-w-2xl text-slate-400">
                Drop any supported file below. The
                universal ingestion pipeline extracts,
                structures and prepares the content
                before analysis.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LABELS.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-400"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`mt-7 rounded-3xl border-2 border-dashed p-6 sm:p-10 text-center transition ${
              dragActive
                ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-950/20"
                : "border-slate-700 bg-slate-950/40 hover:border-cyan-500/40"
            }`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl font-bold text-cyan-300">
              ↑
            </div>

            <h3 className="mt-5 text-xl font-bold">
              {dragActive
                ? "Drop your file here"
                : "Drop your file here"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              or choose a file from your computer
            </p>

            <label
              htmlFor="dataset-upload"
              className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 hover:bg-cyan-300 transition"
            >
              Browse Files
            </label>

            <input
              id="dataset-upload"
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.json,.jsonl,.ndjson,.parquet,.pdf,.docx,.pptx,.txt,.md,.log,.html,.htm,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff"
              onChange={handleFileChange}
              className="hidden"
            />

            <p className="mt-4 text-xs text-slate-600">
              CSV · XLSX · XLS · PDF · DOCX · DOC ·
              JPG · JPEG · PNG · WEBP · BMP · TIFF
            </p>
          </div>

          {/* Selected file */}
          {selectedFile && (
            <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${getTypeStyle(
                      getFileType(
                        selectedFile.name
                      )
                    )}`}
                  >
                    {getTypeIcon(
                      getFileType(
                        selectedFile.name
                      )
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {selectedFile.name}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {getFileType(
                        selectedFile.name
                      )}{" "}
                      ·{" "}
                      {formatBytes(
                        selectedFile.size
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    disabled={uploading}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-50 transition"
                  >
                    Remove
                  </button>

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-500 transition"
                  >
                    {uploading
                      ? "Processing..."
                      : "Process Dataset →"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="text-cyan-300">
                  Scan
                </span>
                <span>→</span>
                <span>Extract</span>
                <span>→</span>
                <span>Structure</span>
                <span>→</span>
                <span>Validate</span>
                <span>→</span>
                <span className="text-emerald-300">
                  Excel + CSV
                </span>
              </div>
            </div>
          )}

          {/* Conversion */}
          {conversion?.created &&
            convertedDatasetId && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-300 font-bold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10">
                        ✓
                      </span>

                      Conversion complete
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Structured files are ready for
                      download and analysis.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        downloadConvertedFile(
                          convertedDatasetId,
                          "excel",
                          conversion.excel
                            ?.fileName
                        )
                      }
                      className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300 transition"
                    >
                      ↓ Excel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadConvertedFile(
                          convertedDatasetId,
                          "csv",
                          conversion.csv?.fileName
                        )
                      }
                      className="rounded-xl border border-emerald-400/30 px-5 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10 transition"
                    >
                      ↓ CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
        </section>

        {/* Dataset Library */}
        <section className="mt-8 rounded-[2rem] border border-white/5 bg-slate-900/80 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
                Dataset Library
              </div>

              <h2 className="mt-2 text-2xl sm:text-3xl font-black">
                Your datasets
              </h2>

              <p className="mt-2 text-slate-400">
                Select a dataset to inspect, analyze or
                send to an AI agent.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search datasets..."
                className="w-full sm:w-72 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 transition"
              />

              <button
                type="button"
                onClick={fetchDatasets}
                disabled={loading}
                className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-5 py-3 text-sm font-semibold text-cyan-300 hover:border-cyan-400/50 disabled:opacity-50 transition"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="mt-7 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-800 bg-slate-950/50 p-5"
                >
                  <div className="h-12 w-12 rounded-xl bg-slate-800" />
                  <div className="mt-5 h-4 w-3/4 rounded bg-slate-800" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-slate-800" />
                  <div className="mt-6 h-10 rounded-xl bg-slate-800" />
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading &&
            filteredDatasets.length === 0 && (
              <div className="mt-7 rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl text-slate-500">
                  □
                </div>

                <h3 className="mt-5 text-lg font-bold">
                  {search
                    ? "No matching datasets"
                    : "No datasets yet"}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {search
                    ? "Try another filename or file type."
                    : "Upload your first dataset above to start working."}
                </p>

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}

          {/* Cards */}
          {!loading &&
            filteredDatasets.length > 0 && (
              <div className="mt-7 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDatasets.map(
                  (dataset) => {
                    const type = getFileType(
                      dataset.fileName
                    );

                    const isSelected =
                      String(selectedDataset) ===
                      String(dataset.id);

                    const rows =
                      getDatasetRows(dataset);

                    const columns =
                      getDatasetColumns(dataset);

                    return (
                      <div
                        key={dataset.id}
                        className={`group rounded-2xl border p-5 transition ${
                          isSelected
                            ? "border-cyan-400/40 bg-cyan-400/[0.05] shadow-lg shadow-cyan-950/20"
                            : "border-slate-800 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-950/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${getTypeStyle(
                                type
                              )}`}
                            >
                              {getTypeIcon(type)}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 truncate">
                                {dataset.fileName ||
                                  "Untitled dataset"}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {type}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                              SELECTED ✓
                            </span>
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-600">
                              Rows
                            </div>

                            <div className="mt-1 text-sm font-semibold text-slate-300">
                              {rows === null
                                ? "—"
                                : formatNumber(rows)}
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-600">
                              Columns
                            </div>

                            <div className="mt-1 text-sm font-semibold text-slate-300">
                              {columns === null
                                ? "—"
                                : formatNumber(
                                    columns
                                  )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-slate-600">
                          {formatBytes(
                            getDatasetSize(
                              dataset
                            )
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewDataset(
                                dataset
                              )
                            }
                            disabled={
                              previewLoading &&
                              previewDataset?.dataset?.id ===
                                dataset.id
                            }
                            className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10 hover:border-cyan-400/40 disabled:opacity-50 transition"
                            title="Preview dataset rows"
                          >
                            {previewLoading &&
                            previewDataset?.dataset?.id ===
                              dataset.id
                              ? "Loading..."
                              : "Preview"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              selectDataset(
                                dataset.id
                              )
                            }
                            className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                              isSelected
                                ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/20"
                                : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                            }`}
                          >
                            {isSelected
                              ? "Selected ✓"
                              : "Select"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadDataset(
                                dataset
                              )
                            }
                            className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-600 transition"
                            title="Download original dataset"
                          >
                            ↓ Download
                          </button>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCleanDataset(
                                dataset.id
                              )
                            }
                            className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2.5 text-xs font-semibold text-violet-300 hover:bg-violet-400/10 transition"
                          >
                            Clean
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteDataset(
                                dataset
                              )
                            }
                            disabled={
                              deletingId ===
                              String(dataset.id)
                            }
                            className="rounded-xl border border-red-400/20 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50 transition"
                          >
                            {deletingId ===
                            String(dataset.id)
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

          {/* Active dataset */}
          {selectedDatasetInfo && (
            <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-400/[0.05] to-transparent p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Active Dataset
                  </div>

                  <div className="mt-1 text-lg font-black truncate">
                    {selectedDatasetInfo.fileName}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      {getFileType(
                        selectedDatasetInfo.fileName
                      )}
                    </span>

                    <span>•</span>

                    <span>
                      {formatNumber(
                        getDatasetRows(
                          selectedDatasetInfo
                        )
                      )}{" "}
                      rows
                    </span>

                    <span>•</span>

                    <span>
                      {formatNumber(
                        getDatasetColumns(
                          selectedDatasetInfo
                        )
                      )}{" "}
                      columns
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={
                      handleAnalyzeDataset
                    }
                    disabled={analyzing}
                    className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-500 transition"
                  >
                    {analyzing
                      ? "Analyzing..."
                      : "Analyze Dataset →"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/agents")
                    }
                    className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10 transition"
                  >
                    AI Agents →
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleCleanDataset(
                        selectedDatasetInfo.id
                      )
                    }
                    className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition"
                  >
                    Data Cleaning
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact selector */}
          {!selectedDatasetInfo &&
            datasets.length > 0 && (
              <div className="mt-6">
                <select
                  value={selectedDataset}
                  onChange={handleDatasetChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none focus:border-cyan-400 transition"
                >
                  <option value="">
                    Select a dataset to activate workspace actions
                  </option>

                  {datasets.map((dataset) => (
                    <option
                      key={dataset.id}
                      value={dataset.id}
                    >
                      {dataset.fileName}
                    </option>
                  ))}
                </select>
              </div>
            )}
        </section>

        {/* Analysis error */}
        {analysisError && !analysis && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-red-300">
            <div className="font-bold">
              Analysis Failed
            </div>

            <p className="mt-1 text-sm text-red-300/80">
              {analysisError}
            </p>
          </div>
        )}

        {/* Analysis result */}
        {analysis && (
          <section className="mt-8">
            <div className="rounded-[2rem] border border-emerald-400/15 bg-slate-900/80 p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-bold text-emerald-300">
                    <span>✓</span>
                    ANALYSIS COMPLETE
                  </div>

                  <h2 className="mt-4 text-3xl sm:text-4xl font-black break-words">
                    {analysis.dataset
                      ?.fileName}
                  </h2>

                  <p className="mt-2 text-slate-500">
                    Dataset intelligence generated
                    successfully.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/agents")
                  }
                  className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300 transition"
                >
                  Continue to AI Agents →
                </button>
              </div>

              {/* Summary */}
              <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  [
                    "Total Rows",
                    analysis.summary?.rows,
                  ],
                  [
                    "Total Columns",
                    analysis.summary?.columns,
                  ],
                  [
                    "Duplicate Rows",
                    analysis.summary
                      ?.duplicateRows,
                  ],
                  [
                    "Missing Values",
                    analysis.summary
                      ?.totalMissingValues,
                  ],
                  [
                    "Numeric Columns",
                    numericColumnCount,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/5 bg-slate-950/50 p-5"
                    >
                      <div className="text-xs uppercase tracking-wider text-slate-600">
                        {label}
                      </div>

                      <div className="mt-2 text-3xl font-black text-cyan-300">
                        {formatNumber(
                          value
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Analysis error */}
              {analysisError && (
                <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
                  {analysisError}
                </div>
              )}

              {/* Dataset Intelligence */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] to-slate-950/40 p-5">
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-cyan-300 font-bold">
                          Data Health
                        </div>
                        <div className="mt-1 text-3xl font-black">
                          {dataHealthScore}/100
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                        <FaShieldAlt className="text-cyan-300" />
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400 transition-all duration-700"
                        style={{ width: `${dataHealthScore}%` }}
                      />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-cyan-300">
                      {healthLabel}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {healthMessage}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                        Quality Signals
                      </div>
                      <div className="mt-1 text-lg font-black">
                        {selectedMissing + selectedDuplicates === 0
                          ? "Clean signals"
                          : "Attention required"}
                      </div>
                    </div>
                    <FaExclamationTriangle
                      className={
                        selectedMissing + selectedDuplicates === 0
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-600">
                        Missing
                      </div>
                      <div className="mt-1 font-bold text-slate-200">
                        {formatNumber(selectedMissing)}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {missingRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-600">
                        Duplicates
                      </div>
                      <div className="mt-1 font-bold text-slate-200">
                        {formatNumber(selectedDuplicates)}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {duplicateRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-violet-300 font-bold">
                        Schema Intelligence
                      </div>
                      <div className="mt-1 text-lg font-black">
                        {analysis?.columns?.length || 0} columns
                      </div>
                    </div>
                    <FaBrain className="text-violet-300" />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-600">
                        Numeric
                      </div>
                      <div className="mt-1 font-bold text-slate-200">
                        {numericColumnCount}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-600">
                        Other
                      </div>
                      <div className="mt-1 font-bold text-slate-200">
                        {categoricalColumnCount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Based on the analysis response available for this dataset.
                  </div>
                </div>
              </div>

              {/* Smart next step */}
              <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10">
                      <FaChartLine className="text-violet-300" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-violet-300 font-bold">
                        Recommended Next Step
                      </div>
                      <div className="mt-1 font-bold text-slate-200">
                        {selectedMissing > 0 || selectedDuplicates > 0
                          ? "Clean the dataset before advanced modeling"
                          : "Continue to analytics and discover patterns"}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        NexusDS uses the available analysis signals to guide the next workflow step.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      selectedMissing > 0 || selectedDuplicates > 0
                        ? handleCleanDataset(selectedDataset)
                        : navigate("/analytics")
                    }
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-violet-300 transition"
                  >
                    {selectedMissing > 0 || selectedDuplicates > 0
                      ? "Open Data Cleaning"
                      : "Open Analytics"}
                    <FaArrowRight className="text-xs" />
                  </button>
                </div>
              </div>

              {/* Columns */}
              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold">
                    Column Information
                  </h3>

                  <span className="text-xs text-slate-600">
                    {analysis.columns?.length || 0}{" "}
                    columns
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                        <th className="px-4 py-3">
                          Column
                        </th>

                        <th className="px-4 py-3">
                          Data Type
                        </th>

                        <th className="px-4 py-3">
                          Missing
                        </th>

                        <th className="px-4 py-3">
                          Missing %
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(analysis.columns ||
                        []).map(
                        (column) => (
                          <tr
                            key={column}
                            className="border-b border-slate-900 hover:bg-white/[0.02]"
                          >
                            <td className="px-4 py-4 font-semibold text-slate-200">
                              {column}
                            </td>

                            <td className="px-4 py-4 text-cyan-300">
                              {analysis
                                .dataTypes?.[
                                column
                              ] ??
                                "—"}
                            </td>

                            <td className="px-4 py-4 text-slate-400">
                              {analysis
                                .missingValues?.[
                                column
                              ] ??
                                "—"}
                            </td>

                            <td className="px-4 py-4 text-slate-400">
                              {analysis
                                .missingPercentage?.[
                                column
                              ] ??
                                "—"}
                              %
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold">
                    Dataset Preview
                  </h3>

                  <span className="text-xs text-slate-600">
                    Sample records
                  </span>
                </div>

                {analysis.preview?.length >
                0 ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[750px] text-left">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {(
                            analysis.columns ||
                            []
                          ).map(
                            (column) => (
                              <th
                                key={column}
                                className="px-4 py-3 text-xs uppercase tracking-wider text-cyan-300 whitespace-nowrap"
                              >
                                {column}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {analysis.preview.map(
                          (
                            row,
                            index
                          ) => (
                            <tr
                              key={index}
                              className="border-b border-slate-900 hover:bg-white/[0.02]"
                            >
                              {(
                                analysis.columns ||
                                []
                              ).map(
                                (
                                  column
                                ) => (
                                  <td
                                    key={
                                      column
                                    }
                                    className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap"
                                  >
                                    {row[
                                      column
                                    ] ===
                                      null ||
                                    row[
                                      column
                                    ] ===
                                      undefined
                                      ? "—"
                                      : String(
                                          row[
                                            column
                                          ]
                                        )}
                                  </td>
                                )
                              )}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No preview data available.
                  </p>
                )}
              </div>

              {/* Numerical statistics */}
              {Object.keys(
                analysis.statistics ||
                  {}
              ).length > 0 && (
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
                  <h3 className="text-xl font-bold">
                    Numerical Statistics
                  </h3>

                  <div className="mt-5 grid md:grid-cols-2 gap-4">
                    {Object.entries(
                      analysis.statistics
                    ).map(
                      ([
                        column,
                        stats,
                      ]) => (
                        <div
                          key={column}
                          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                        >
                          <h4 className="font-bold text-cyan-300">
                            {column}
                          </h4>

                          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                              [
                                "Count",
                                stats.count,
                              ],
                              [
                                "Mean",
                                stats.mean,
                              ],
                              [
                                "Min",
                                stats.min,
                              ],
                              [
                                "Max",
                                stats.max,
                              ],
                              [
                                "25%",
                                stats["25%"],
                              ],
                              [
                                "Median",
                                stats["50%"],
                              ],
                              [
                                "75%",
                                stats["75%"],
                              ],
                              [
                                "Std Dev",
                                stats.std,
                              ],
                            ].map(
                              ([
                                label,
                                value,
                              ]) => (
                                <div
                                  key={
                                    label
                                  }
                                >
                                  <div className="text-[10px] uppercase tracking-wider text-slate-600">
                                    {
                                      label
                                    }
                                  </div>

                                  <div className="mt-1 text-sm font-semibold text-slate-300 break-all">
                                    {label ===
                                    "Count"
                                      ? formatNumber(
                                          value
                                        )
                                      : value ??
                                        "—"}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Analysis actions */}
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAnalysis(null);
                    setSelectedDataset("");
                    setAnalysisError("");

                    localStorage.removeItem(
                      "selectedDatasetId"
                    );
                    localStorage.removeItem(
                      "selectedDatasetName"
                    );
                  }}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition"
                >
                  Analyze Another Dataset
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/agents")
                  }
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition"
                >
                  Open AI Agents
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Footer workflow */}
        <div className="mt-10 rounded-2xl border border-white/5 bg-slate-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-600">
            <span className="font-semibold text-cyan-400">
              NexusDS AI
            </span>

            <span>•</span>
            <span>Ingest</span>
            <span>→</span>
            <span>Structure</span>
            <span>→</span>
            <span>Analyze</span>
            <span>→</span>
            <span>AI Agents</span>
            <span>→</span>
            <span>Insights</span>
          </div>
        </div>
      </div>
      {/* =========================================================
          DATASET PREVIEW MODAL
      ========================================================= */}
      {(previewDataset || previewLoading || previewError) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-2xl shadow-cyan-950/30">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FaDatabase className="text-cyan-400" />
                  <h2 className="text-lg md:text-xl font-black text-white">
                    Dataset Preview
                  </h2>
                </div>
                <p className="mt-1 truncate text-xs md:text-sm text-slate-500">
                  {previewDataset?.dataset?.fileName || "Loading dataset..."}
                </p>
              </div>

              <button
                type="button"
                onClick={closePreview}
                className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-slate-400 hover:border-slate-500 hover:text-white transition"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            {previewError ? (
              <div className="p-6">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
                  <div className="font-bold">Preview unavailable</div>
                  <div className="mt-1 text-sm text-red-300/80">
                    {previewError}
                  </div>
                </div>
              </div>
            ) : previewLoading && !previewDataset?.columns?.length ? (
              <div className="flex min-h-[320px] items-center justify-center p-8">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    Preparing dataset preview...
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Reading sample records from NexusDS AI
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-[calc(90vh-82px)] overflow-auto">
                <div className="grid grid-cols-2 gap-3 border-b border-slate-800 p-5 md:grid-cols-4 md:p-6">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">Sample Rows</div>
                    <div className="mt-1 text-xl font-black text-cyan-300">
                      {formatNumber(previewDataset?.preview?.length || 0)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">Columns</div>
                    <div className="mt-1 text-xl font-black text-slate-200">
                      {formatNumber(previewDataset?.columns?.length || 0)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">Total Rows</div>
                    <div className="mt-1 text-xl font-black text-slate-200">
                      {previewDataset?.rows ? formatNumber(previewDataset.rows) : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">File Type</div>
                    <div className="mt-1 text-sm font-black text-violet-300">
                      {getFileType(previewDataset?.dataset?.fileName || "")}
                    </div>
                  </div>
                </div>

                <div className="p-5 md:p-6">
                  {previewDataset?.preview?.length > 0 &&
                  previewDataset?.columns?.length > 0 ? (
                    <div className="overflow-auto rounded-2xl border border-slate-800">
                      <table className="w-full min-w-max text-left">
                        <thead className="sticky top-0 z-10 bg-slate-900">
                          <tr className="border-b border-slate-800">
                            {previewDataset.columns.map((column) => (
                              <th
                                key={column}
                                className="whitespace-nowrap px-4 py-3 text-xs font-black uppercase tracking-wider text-cyan-300"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {previewDataset.preview.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="border-b border-slate-900 hover:bg-white/[0.025]"
                            >
                              {previewDataset.columns.map((column) => {
                                const value = row?.[column];

                                return (
                                  <td
                                    key={`${rowIndex}-${column}`}
                                    className="max-w-[320px] whitespace-nowrap px-4 py-3 text-sm text-slate-400"
                                    title={
                                      value === null || value === undefined
                                        ? ""
                                        : String(value)
                                    }
                                  >
                                    {value === null ||
                                    value === undefined ||
                                    value === ""
                                      ? "—"
                                      : String(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
                      <FaExclamationTriangle className="mx-auto text-2xl text-yellow-400" />
                      <p className="mt-3 font-bold text-slate-200">
                        No preview rows available
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        The dataset was found, but no sample records were returned.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>




  );
}

export default Dataset;