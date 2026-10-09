import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";
const API_URL = API_BASE_URL;;

/* =========================================================
   AUTH HELPER
========================================================= */

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login";
    return null;
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const handleUnauthorized = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("selectedDatasetId");
  localStorage.removeItem("selectedDatasetName");
  window.location.href = "/login";
};

function Visualization() {
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [analysis, setAnalysis] = useState(null);

  const [activeTool, setActiveTool] = useState("auto");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [groupColumn, setGroupColumn] = useState("");
  const [chartType, setChartType] = useState("bar");

  const [loading, setLoading] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* =====================================================
     LOAD
  ===================================================== */

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    const savedId =
      localStorage.getItem("selectedDatasetId");

    if (savedId) {
      setSelectedDataset(String(savedId));
    }
  }, []);

  /* =====================================================
     DATASETS
  ===================================================== */

  const loadDatasets = async () => {
    try {
      setLoadingDatasets(true);
      setError("");

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/datasets`,
        {
          headers,
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load datasets."
        );
      }

      const list = Array.isArray(data.datasets)
        ? data.datasets
        : [];

      setDatasets(list);

      const savedId =
        localStorage.getItem("selectedDatasetId");

      if (
        savedId &&
        list.some(
          (item) =>
            String(item.id) ===
            String(savedId)
        )
      ) {
        setSelectedDataset(String(savedId));
        await loadAnalysis(String(savedId));
      } else if (list.length > 0) {
        setSelectedDataset(
          String(list[0].id)
        );

        localStorage.setItem(
          "selectedDatasetId",
          String(list[0].id)
        );

        if (list[0].fileName) {
          localStorage.setItem(
            "selectedDatasetName",
            list[0].fileName
          );
        }

        await loadAnalysis(
          String(list[0].id)
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load datasets. Make sure FastAPI is running."
      );
    } finally {
      setLoadingDatasets(false);
    }
  };

  /* =====================================================
     ANALYSIS
  ===================================================== */

  const loadAnalysis = async (datasetId) => {
    if (!datasetId) return;

    try {
      setLoading(true);
      setError("");
      setNotice("");

      const headers = getAuthHeaders();

      if (!headers) return;

      const response = await fetch(
        `${API_URL}/api/dataset/datasets/${datasetId}/analyze`,
        {
          headers,
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to analyze selected dataset."
        );
      }

      setAnalysis(data);

      const cols = Array.isArray(
        data.columns
      )
        ? data.columns
        : [];

      const kinds =
        data.columnKinds || {};

      const nums = cols.filter(
        (column) =>
          kinds[column] === "numeric"
      );

      const cats = cols.filter(
        (column) =>
          kinds[column] === "categorical"
      );

      const dates = cols.filter(
        (column) =>
          kinds[column] === "date"
      );

      setSelectedColumn(
        nums[0] ||
          cats[0] ||
          dates[0] ||
          cols[0] ||
          ""
      );

      setXColumn(
        cats[0] ||
          dates[0] ||
          nums[0] ||
          cols[0] ||
          ""
      );

      setYColumn(
        nums[0] ||
          cols.find(
            (column) =>
              column !==
              (cats[0] || dates[0])
          ) ||
          cols[1] ||
          cols[0] ||
          ""
      );

      setGroupColumn(
        cats[0] || ""
      );
    } catch (err) {
      console.error(err);

      setAnalysis(null);

      setError(
        err.message ||
          "Unable to analyze selected dataset."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     DATASET CHANGE
  ===================================================== */

  const handleDatasetChange = async (
    event
  ) => {
    const datasetId =
      event.target.value;

    setSelectedDataset(datasetId);
    setAnalysis(null);
    setError("");
    setNotice("");

    if (!datasetId) {
      localStorage.removeItem(
        "selectedDatasetId"
      );

      localStorage.removeItem(
        "selectedDatasetName"
      );

      return;
    }

    localStorage.setItem(
      "selectedDatasetId",
      String(datasetId)
    );

    const dataset = datasets.find(
      (item) =>
        String(item.id) ===
        String(datasetId)
    );

    if (dataset?.fileName) {
      localStorage.setItem(
        "selectedDatasetName",
        dataset.fileName
      );
    }

    await loadAnalysis(datasetId);
  };

  /* =====================================================
     ANALYSIS DATA
  ===================================================== */

  const columns =
    analysis?.columns || [];

  const kinds =
    analysis?.columnKinds || {};

  const dataTypes =
    analysis?.dataTypes || {};

  const distributions =
    analysis?.distributions || {};

  const statistics =
    analysis?.statistics || {};

  const outliers =
    analysis?.outliers || {};

  const correlations =
    Array.isArray(
      analysis?.correlations
    )
      ? analysis.correlations
      : [];

  const preview =
    Array.isArray(
      analysis?.preview
    )
      ? analysis.preview
      : [];

  /* =====================================================
     COLUMN TYPES
  ===================================================== */

  const numericColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          kinds[column] ===
          "numeric"
      ),
    [columns, kinds]
  );

  const categoricalColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          kinds[column] ===
          "categorical"
      ),
    [columns, kinds]
  );

  const dateColumns = useMemo(
    () =>
      columns.filter(
        (column) =>
          kinds[column] ===
          "date"
      ),
    [columns, kinds]
  );

  const selectedDatasetInfo =
    datasets.find(
      (item) =>
        String(item.id) ===
        String(selectedDataset)
    );

  /* =====================================================
     NUMBER HELPERS
  ===================================================== */

  const safeNumber = (
    value,
    fallback = 0
  ) => {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  };

  const formatNumber = (
    value
  ) => {
    const number =
      Number(value);

    if (!Number.isFinite(number))
      return "0";

    return number.toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    );
  };

  const clamp = (
    value,
    min,
    max
  ) =>
    Math.max(
      min,
      Math.min(max, value)
    );

  /* =====================================================
     DISTRIBUTION
  ===================================================== */

  const getDistribution = (
    column
  ) => {
    const item =
      distributions?.[column];

    if (
      !item ||
      !Array.isArray(
        item.labels
      ) ||
      !Array.isArray(
        item.values
      )
    ) {
      return {
        labels: [],
        values: [],
      };
    }

    return {
      labels: item.labels,
      values: item.values.map(
        (value) =>
          safeNumber(value)
      ),
    };
  };

  /* =====================================================
     PREVIEW NUMERIC
  ===================================================== */

  const getPreviewNumericRows = (
    x,
    y
  ) => {
    if (!x || !y) return [];

    return preview
      .map((row) => ({
        x: safeNumber(
          row[x],
          NaN
        ),
        y: safeNumber(
          row[y],
          NaN
        ),
        label: String(
          row[x] ?? ""
        ),
      }))
      .filter(
        (row) =>
          Number.isFinite(
            row.x
          ) &&
          Number.isFinite(
            row.y
          )
      );
  };

  /* =====================================================
     AUTO CHARTS
  ===================================================== */

  const getAutoCharts =
    useMemo(() => {
      if (!analysis) return [];

      const result = [];

      numericColumns
        .slice(0, 8)
        .forEach((column) => {
          const distribution =
            getDistribution(
              column
            );

          if (
            distribution.labels
              .length
          ) {
            result.push({
              id: `hist-${column}`,
              title: `${column} — Distribution`,
              type: "histogram",
              column,
              data: distribution,
            });
          }
        });

      categoricalColumns
        .slice(0, 6)
        .forEach((column) => {
          const distribution =
            getDistribution(
              column
            );

          if (
            distribution.labels
              .length
          ) {
            result.push({
              id: `bar-${column}`,
              title: `${column} — Category Comparison`,
              type: "bar",
              column,
              data: distribution,
            });

            if (
              distribution.labels
                .length <= 8
            ) {
              result.push({
                id: `pie-${column}`,
                title: `${column} — Composition`,
                type: "pie",
                column,
                data: distribution,
              });
            }
          }
        });

      dateColumns
        .slice(0, 4)
        .forEach((column) => {
          const distribution =
            getDistribution(
              column
            );

          if (
            distribution.labels
              .length
          ) {
            result.push({
              id: `line-${column}`,
              title: `${column} — Timeline`,
              type: "line",
              column,
              data: distribution,
            });

            result.push({
              id: `area-${column}`,
              title: `${column} — Trend Area`,
              type: "area",
              column,
              data: distribution,
            });
          }
        });

      if (
        numericColumns.length >= 2
      ) {
        result.push({
          id: "scatter-main",
          title: `${numericColumns[0]} vs ${numericColumns[1]}`,
          type: "scatter",
          x: numericColumns[0],
          y: numericColumns[1],
          data:
            getPreviewNumericRows(
              numericColumns[0],
              numericColumns[1]
            ),
        });
      }

      numericColumns
        .slice(0, 8)
        .forEach((column) => {
          const stats =
            statistics[column];

          if (stats) {
            result.push({
              id: `box-${column}`,
              title: `${column} — Box Plot`,
              type: "box",
              column,
              stats,
              outlierCount:
                safeNumber(
                  outliers?.[
                    column
                  ]?.count
                ),
            });
          }
        });

      if (
        correlations.length
      ) {
        result.push({
          id: "heatmap",
          title:
            "Strong Correlation Heatmap",
          type: "heatmap",
          data: correlations,
        });
      }

      return result;
    }, [
      analysis,
      numericColumns,
      categoricalColumns,
      dateColumns,
      distributions,
      statistics,
      outliers,
      correlations,
      preview,
    ]);

  /* =====================================================
     CHART OPTIONS
  ===================================================== */

  const chartOptions = [
    {
      value: "bar",
      label: "Bar Chart",
      description:
        "Compare categories or ranked values.",
      available:
        categoricalColumns.length >
          0 ||
        numericColumns.length >
          0,
    },
    {
      value: "line",
      label: "Line Chart",
      description:
        "Show ordered or time-based trends.",
      available:
        dateColumns.length >
          0 ||
        numericColumns.length >
          0,
    },
    {
      value: "area",
      label: "Area Chart",
      description:
        "Show trend magnitude over an ordered axis.",
      available:
        dateColumns.length >
          0 ||
        numericColumns.length >
          0,
    },
    {
      value: "pie",
      label: "Pie Chart",
      description:
        "Show part-to-whole composition.",
      available:
        categoricalColumns.length >
        0,
    },
    {
      value: "donut",
      label: "Donut Chart",
      description:
        "Part-to-whole view with a cleaner center.",
      available:
        categoricalColumns.length >
        0,
    },
    {
      value: "histogram",
      label: "Histogram",
      description:
        "Show numerical distribution.",
      available:
        numericColumns.length >
        0,
    },
    {
      value: "scatter",
      label: "Scatter Plot",
      description:
        "Explore relationships between two numbers.",
      available:
        numericColumns.length >=
        2,
    },
    {
      value: "box",
      label: "Box Plot",
      description:
        "Show spread, quartiles and outlier signals.",
      available:
        numericColumns.length >
        0,
    },
    {
      value: "heatmap",
      label: "Correlation Heatmap",
      description:
        "Inspect strong numeric relationships.",
      available:
        correlations.length >
        0,
    },
    {
      value: "bubble",
      label: "Bubble Chart",
      description:
        "Compare two numbers with a third numeric size.",
      available:
        numericColumns.length >=
        3,
    },
    {
      value: "radar",
      label: "Radar Profile",
      description:
        "Compare normalized numeric column profiles.",
      available:
        numericColumns.length >=
        3,
    },
  ];

  /* =====================================================
     BUILDER DATA
  ===================================================== */

  const getBuilderData =
    () => {
      if (!analysis) return null;

      if (
        chartType ===
        "scatter"
      ) {
        return {
          type: "scatter",
          title: `${xColumn} vs ${yColumn}`,
          x: xColumn,
          y: yColumn,
          data:
            getPreviewNumericRows(
              xColumn,
              yColumn
            ),
        };
      }

      if (
        chartType ===
        "bubble"
      ) {
        const z =
          numericColumns.find(
            (column) =>
              column !== xColumn &&
              column !== yColumn
          ) ||
          numericColumns[2];

        const rows =
          preview
            .map((row) => ({
              x: safeNumber(
                row[xColumn],
                NaN
              ),
              y: safeNumber(
                row[yColumn],
                NaN
              ),
              z: safeNumber(
                row[z],
                NaN
              ),
            }))
            .filter(
              (row) =>
                Number.isFinite(
                  row.x
                ) &&
                Number.isFinite(
                  row.y
                ) &&
                Number.isFinite(
                  row.z
                )
            );

        return {
          type: "bubble",
          title: `${xColumn} vs ${yColumn} sized by ${z}`,
          x: xColumn,
          y: yColumn,
          z,
          data: rows,
        };
      }

      if (
        chartType ===
        "radar"
      ) {
        const selected =
          numericColumns.slice(
            0,
            6
          );

        const values =
          selected.map(
            (column) => {
              const stats =
                statistics[
                  column
                ] || {};

              const max =
                safeNumber(
                  stats.max,
                  1
                );

              const mean =
                safeNumber(
                  stats.mean,
                  0
                );

              return {
                label: column,
                value:
                  max === 0
                    ? 0
                    : clamp(
                        (mean /
                          Math.abs(
                            max
                          )) *
                          100,
                        0,
                        100
                      ),
              };
            }
          );

        return {
          type: "radar",
          title:
            "Numeric Column Profile",
          data: values,
        };
      }

      if (
        chartType ===
        "heatmap"
      ) {
        return {
          type: "heatmap",
          title:
            "Strong Correlation Heatmap",
          data: correlations,
        };
      }

      const sourceColumn =
        chartType ===
          "histogram" ||
        chartType === "box"
          ? selectedColumn
          : categoricalColumns.includes(
                xColumn
              ) ||
              dateColumns.includes(
                xColumn
              )
            ? xColumn
            : selectedColumn;

      const distribution =
        getDistribution(
          sourceColumn
        );

      if (
        !distribution.labels
          .length
      ) {
        return null;
      }

      return {
        type: chartType,
        title: `${sourceColumn} — ${chartType}`,
        column: sourceColumn,
        data: distribution,
        stats:
          statistics[
            sourceColumn
          ],
        outlierCount:
          safeNumber(
            outliers?.[
              sourceColumn
            ]?.count
          ),
      };
    };

  const builderConfig =
    getBuilderData();

  /* =====================================================
     BAR
  ===================================================== */

  const renderBars = (
    data,
    horizontal = false
  ) => {
    const values =
      data.values || [];

    const labels =
      data.labels || [];

    const max = Math.max(
      ...values.map(
        Math.abs
      ),
      1
    );

    if (horizontal) {
      return (
        <div className="space-y-3 p-6">
          {values.map(
            (
              value,
              index
            ) => (
              <div
                key={index}
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 truncate max-w-[70%]">
                    {
                      labels[
                        index
                      ]
                    }
                  </span>

                  <span className="text-cyan-300">
                    {formatNumber(
                      value
                    )}
                  </span>
                </div>

                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{
                      width: `${Math.max(
                        2,
                        (Math.abs(
                          value
                        ) /
                          max) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      );
    }

    return (
      <div className="h-80 flex items-end gap-2 overflow-x-auto p-6">
        {values.map(
          (
            value,
            index
          ) => {
            const height =
              (Math.abs(
                value
              ) /
                max) *
              240;

            return (
              <div
                key={index}
                className="min-w-12 flex-1 h-full flex flex-col justify-end items-center"
              >
                <span className="text-[10px] text-gray-300 mb-1">
                  {formatNumber(
                    value
                  )}
                </span>

                <div
                  className="w-full max-w-10 bg-cyan-400 rounded-t-md"
                  style={{
                    height: `${Math.max(
                      4,
                      height
                    )}px`,
                  }}
                />

                <span className="text-[10px] text-gray-500 mt-2 max-w-14 truncate">
                  {
                    labels[
                      index
                    ]
                  }
                </span>
              </div>
            );
          }
        )}
      </div>
    );
  };

  /* =====================================================
     LINE
  ===================================================== */

  const renderLine = (
    data,
    filled = false
  ) => {
    const values =
      data.values || [];

    const labels =
      data.labels || [];

    if (!values.length)
      return null;

    const width = 900;
    const height = 320;
    const padding = 35;

    const min =
      Math.min(...values);

    const max =
      Math.max(...values);

    const range =
      max - min || 1;

    const points = values
      .map(
        (
          value,
          index
        ) => {
          const x =
            values.length ===
            1
              ? width / 2
              : padding +
                (index /
                  (values.length -
                    1)) *
                  (width -
                    padding *
                      2);

          const y =
            height -
            padding -
            ((value - min) /
              range) *
              (height -
                padding *
                  2);

          return `${x},${y}`;
        }
      )
      .join(" ");

    const areaPoints = `${padding},${
      height - padding
    } ${points} ${
      width - padding
    },${height - padding}`;

    return (
      <div className="overflow-x-auto p-5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[700px] h-80"
        >
          {filled && (
            <polygon
              points={
                areaPoints
              }
              fill="currentColor"
              className="text-cyan-400/10"
            />
          )}

          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-cyan-400"
          />

          {values.map(
            (
              value,
              index
            ) => {
              const x =
                values.length ===
                1
                  ? width / 2
                  : padding +
                    (index /
                      (values.length -
                        1)) *
                      (width -
                        padding *
                          2);

              const y =
                height -
                padding -
                ((value - min) /
                  range) *
                  (height -
                    padding *
                      2);

              return (
                <g
                  key={index}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="currentColor"
                    className="text-cyan-300"
                  />

                  {(index ===
                    0 ||
                    index ===
                      values.length -
                        1 ||
                    values.length <=
                      12) && (
                    <text
                      x={x}
                      y={
                        height -
                        8
                      }
                      textAnchor="middle"
                      fontSize="11"
                      fill="currentColor"
                      className="text-gray-500"
                    >
                      {String(
                        labels[
                          index
                        ]
                      ).slice(
                        0,
                        14
                      )}
                    </text>
                  )}
                </g>
              );
            }
          )}
        </svg>
      </div>
    );
  };

  /* =====================================================
     PIE
  ===================================================== */

  const renderPie = (
    data,
    donut = false
  ) => {
    const values =
      data.values || [];

    const labels =
      data.labels || [];

    const total =
      values.reduce(
        (
          sum,
          value
        ) =>
          sum +
          Math.max(
            0,
            value
          ),
        0
      ) || 1;

    let current = 0;

    const radius = 100;
    const cx = 140;
    const cy = 140;

    const circumference =
      2 *
      Math.PI *
      radius;

    return (
      <div className="flex flex-col lg:flex-row items-center gap-8 p-6">
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 280 280"
            className="w-64 h-64"
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="48"
              className="text-slate-800"
            />

            {values.map(
              (
                value,
                index
              ) => {
                const percentage =
                  Math.max(
                    0,
                    value
                  ) / total;

                const dash =
                  percentage *
                  circumference;

                const offset =
                  -current *
                  circumference;

                current +=
                  percentage;

                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="48"
                    strokeDasharray={`${dash} ${
                      circumference -
                      dash
                    }`}
                    strokeDashoffset={
                      offset
                    }
                    transform={`rotate(-90 ${cx} ${cy})`}
                    className={
                      index %
                        5 ===
                      0
                        ? "text-cyan-400"
                        : index %
                              5 ===
                            1
                          ? "text-purple-400"
                          : index %
                                5 ===
                              2
                            ? "text-emerald-400"
                            : index %
                                  5 ===
                                3
                              ? "text-amber-400"
                              : "text-pink-400"
                    }
                  />
                );
              }
            )}

            {donut && (
              <circle
                cx={cx}
                cy={cy}
                r="55"
                className="fill-slate-950"
              />
            )}
          </svg>
        </div>

        <div className="flex-1 space-y-2 w-full">
          {values.map(
            (
              value,
              index
            ) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-gray-300 truncate">
                  {
                    labels[
                      index
                    ]
                  }
                </span>

                <span className="text-cyan-300 shrink-0">
                  {formatNumber(
                    value
                  )}{" "}
                  <span className="text-gray-500">
                    (
                    {(
                      (value /
                        total) *
                      100
                    ).toFixed(
                      1
                    )}
                    %)
                  </span>
                </span>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  /* =====================================================
     SCATTER
  ===================================================== */

  const renderScatter = (
    items,
    bubble = false
  ) => {
    if (!items?.length) {
      return (
        <EmptyChart
          text="Not enough numeric preview data for this chart."
        />
      );
    }

    const width = 900;
    const height = 340;
    const pad = 45;

    const xs = items.map(
      (item) => item.x
    );

    const ys = items.map(
      (item) => item.y
    );

    const minX =
      Math.min(...xs);

    const maxX =
      Math.max(...xs);

    const minY =
      Math.min(...ys);

    const maxY =
      Math.max(...ys);

    const rangeX =
      maxX - minX || 1;

    const rangeY =
      maxY - minY || 1;

    const maxZ =
      Math.max(
        ...items.map(
          (row) =>
            Math.abs(
              row.z
            )
        )
      ) || 1;

    return (
      <div className="overflow-x-auto p-5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[700px] h-80"
        >
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke="currentColor"
            className="text-slate-700"
          />

          <line
            x1={pad}
            y1={pad}
            x2={pad}
            y2={height - pad}
            stroke="currentColor"
            className="text-slate-700"
          />

          {items.map(
            (
              item,
              index
            ) => {
              const x =
                pad +
                ((item.x -
                  minX) /
                  rangeX) *
                  (width -
                    pad *
                      2);

              const y =
                height -
                pad -
                ((item.y -
                  minY) /
                  rangeY) *
                  (height -
                    pad *
                      2);

              const bubbleSize =
                bubble
                  ? clamp(
                      5 +
                        (Math.abs(
                          item.z
                        ) /
                          maxZ) *
                          18,
                      5,
                      24
                    )
                  : 6;

              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={
                    bubbleSize
                  }
                  fill="currentColor"
                  className="text-cyan-400/80"
                >
                  <title>
                    {item.x},{" "}
                    {item.y}
                    {bubble
                      ? `, size: ${item.z}`
                      : ""}
                  </title>
                </circle>
              );
            }
          )}
        </svg>
      </div>
    );
  };

  /* =====================================================
     BOX
  ===================================================== */

  const renderBox = (
    stats,
    outlierCount
  ) => {
    if (!stats) {
      return (
        <EmptyChart
          text="Box plot statistics are unavailable."
        />
      );
    }

    const min =
      safeNumber(
        stats.min
      );

    const q1 =
      safeNumber(
        stats.q1
      );

    const median =
      safeNumber(
        stats.median ??
          stats["50%"]
      );

    const q3 =
      safeNumber(
        stats.q3
      );

    const max =
      safeNumber(
        stats.max
      );

    const range =
      max - min || 1;

    const pos = (
      value
    ) =>
      10 +
      ((value - min) /
        range) *
        80;

    return (
      <div className="p-10">
        <div className="relative h-32">
          <div className="absolute left-[10%] right-[10%] top-1/2 h-1 bg-slate-700 rounded" />

          <div
            className="absolute top-[38%] h-16 bg-cyan-400/20 border border-cyan-400 rounded-xl"
            style={{
              left: `${pos(
                q1
              )}%`,
              width: `${Math.max(
                2,
                pos(q3) -
                  pos(q1)
              )}%`,
            }}
          />

          <div
            className="absolute top-[28%] w-1 h-20 bg-white rounded"
            style={{
              left: `${pos(
                median
              )}%`,
            }}
          />

          <div
            className="absolute top-1/2 w-3 h-3 bg-cyan-400 rounded-full -translate-y-1/2"
            style={{
              left: `${pos(
                min
              )}%`,
            }}
          />

          <div
            className="absolute top-1/2 w-3 h-3 bg-cyan-400 rounded-full -translate-y-1/2"
            style={{
              left: `${pos(
                max
              )}%`,
            }}
          />

          <div
            className="absolute top-[35%] h-12 w-px bg-cyan-300"
            style={{
              left: `${pos(
                min
              )}%`,
            }}
          />

          <div
            className="absolute top-[35%] h-12 w-px bg-cyan-300"
            style={{
              left: `${pos(
                max
              )}%`,
            }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {[
            ["Min", min],
            ["Q1", q1],
            ["Median", median],
            ["Q3", q3],
            ["Max", max],
          ].map(
            ([
              label,
              value,
            ]) => (
              <div
                key={label}
                className="bg-slate-800 rounded-xl p-3"
              >
                <p className="text-gray-500">
                  {label}
                </p>

                <p className="font-semibold mt-1">
                  {formatNumber(
                    value
                  )}
                </p>
              </div>
            )
          )}
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Possible outliers detected:{" "}
          <span className="text-amber-400 font-semibold">
            {formatNumber(
              outlierCount
            )}
          </span>
        </p>
      </div>
    );
  };

  /* =====================================================
     HEATMAP
  ===================================================== */

  const renderHeatmap = (
    items
  ) => {
    if (!items?.length) {
      return (
        <EmptyChart
          text="No strong correlations were detected."
        />
      );
    }

    return (
      <div className="p-6 overflow-x-auto">
        <div className="min-w-[520px] space-y-2">
          {items.map(
            (
              item,
              index
            ) => {
              const value =
                safeNumber(
                  item.correlation
                );

              const intensity =
                Math.abs(
                  value
                ) * 100;

              return (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_70px_1fr_90px] items-center gap-3"
                >
                  <span className="text-sm text-gray-300 truncate">
                    {
                      item.feature1
                    }
                  </span>

                  <span className="text-gray-600 text-center">
                    ↔
                  </span>

                  <span className="text-sm text-gray-300 truncate">
                    {
                      item.feature2
                    }
                  </span>

                  <div
                    className="rounded-lg px-3 py-2 text-center font-bold"
                    style={{
                      opacity:
                        0.35 +
                        intensity /
                          150,
                      background:
                        value >=
                        0
                          ? "rgba(34, 211, 238, 0.25)"
                          : "rgba(244, 114, 182, 0.25)",
                    }}
                  >
                    {value.toFixed(
                      2
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>

        <p className="text-xs text-gray-500 mt-5">
          Showing strong relationships returned by the
          dataset analysis engine (absolute correlation ≥ 0.70).
        </p>
      </div>
    );
  };

  /* =====================================================
     RADAR
  ===================================================== */

  const renderRadar = (
    items
  ) => {
    if (!items?.length) {
      return (
        <EmptyChart
          text="At least three numeric columns are required."
        />
      );
    }

    const cx = 250;
    const cy = 180;
    const radius = 125;
    const n = items.length;

    const point = (
      index,
      value
    ) => {
      const angle =
        -Math.PI / 2 +
        (index / n) *
          Math.PI *
          2;

      const r =
        radius *
        (value / 100);

      return {
        x:
          cx +
          Math.cos(
            angle
          ) *
            r,

        y:
          cy +
          Math.sin(
            angle
          ) *
            r,
      };
    };

    const polygon =
      items
        .map(
          (
            item,
            index
          ) => {
            const p =
              point(
                index,
                item.value
              );

            return `${p.x},${p.y}`;
          }
        )
        .join(" ");

    return (
      <div className="flex justify-center overflow-x-auto p-6">
        <svg
          viewBox="0 0 500 360"
          className="w-full max-w-2xl min-w-[500px] h-80"
        >
          {[25, 50, 75, 100].map(
            (level) => {
              const points =
                items
                  .map(
                    (
                      _,
                      index
                    ) => {
                      const angle =
                        -Math.PI /
                          2 +
                        (index /
                          n) *
                          Math.PI *
                          2;

                      const r =
                        radius *
                        (level /
                          100);

                      return `${
                        cx +
                        Math.cos(
                          angle
                        ) *
                          r
                      },${
                        cy +
                        Math.sin(
                          angle
                        ) *
                          r
                      }`;
                    }
                  )
                  .join(" ");

              return (
                <polygon
                  key={level}
                  points={points}
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-800"
                />
              );
            }
          )}

          {items.map(
            (
              item,
              index
            ) => {
              const angle =
                -Math.PI /
                  2 +
                (index / n) *
                  Math.PI *
                  2;

              return (
                <line
                  key={
                    item.label
                  }
                  x1={cx}
                  y1={cy}
                  x2={
                    cx +
                    Math.cos(
                      angle
                    ) *
                      radius
                  }
                  y2={
                    cy +
                    Math.sin(
                      angle
                    ) *
                      radius
                  }
                  stroke="currentColor"
                  className="text-slate-800"
                />
              );
            }
          )}

          <polygon
            points={
              polygon
            }
            fill="currentColor"
            className="text-cyan-400/20"
            stroke="currentColor"
            strokeWidth="3"
          />

          {items.map(
            (
              item,
              index
            ) => {
              const p =
                point(
                  index,
                  item.value
                );

              const angle =
                -Math.PI /
                  2 +
                (index / n) *
                  Math.PI *
                  2;

              return (
                <g
                  key={
                    item.label
                  }
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="currentColor"
                    className="text-cyan-400"
                  />

                  <text
                    x={
                      cx +
                      Math.cos(
                        angle
                      ) *
                        (radius +
                          25)
                    }
                    y={
                      cy +
                      Math.sin(
                        angle
                      ) *
                        (radius +
                          25)
                    }
                    textAnchor="middle"
                    fontSize="11"
                    fill="currentColor"
                    className="text-gray-400"
                  >
                    {String(
                      item.label
                    ).slice(
                      0,
                      12
                    )}
                  </text>
                </g>
              );
            }
          )}
        </svg>
      </div>
    );
  };

  /* =====================================================
     EMPTY
  ===================================================== */

  function EmptyChart({
    text,
  }) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500 p-8 text-center">
        {text}
      </div>
    );
  }

  /* =====================================================
     RENDER CHART
  ===================================================== */

  const renderChartByConfig = (
    config
  ) => {
    if (!config) {
      return (
        <EmptyChart
          text="This chart cannot be generated from the selected dataset."
        />
      );
    }

    if (
      config.type ===
      "bar"
    ) {
      return renderBars(
        config.data
      );
    }

    if (
      config.type ===
      "line"
    ) {
      return renderLine(
        config.data
      );
    }

    if (
      config.type ===
      "area"
    ) {
      return renderLine(
        config.data,
        true
      );
    }

    if (
      config.type ===
      "pie"
    ) {
      return renderPie(
        config.data,
        false
      );
    }

    if (
      config.type ===
      "donut"
    ) {
      return renderPie(
        config.data,
        true
      );
    }

    if (
      config.type ===
      "histogram"
    ) {
      return renderBars(
        config.data
      );
    }

    if (
      config.type ===
      "scatter"
    ) {
      return renderScatter(
        config.data
      );
    }

    if (
      config.type ===
      "bubble"
    ) {
      return renderScatter(
        config.data,
        true
      );
    }

    if (
      config.type ===
      "box"
    ) {
      return renderBox(
        config.stats,
        config.outlierCount
      );
    }

    if (
      config.type ===
      "heatmap"
    ) {
      return renderHeatmap(
        config.data
      );
    }

    if (
      config.type ===
      "radar"
    ) {
      return renderRadar(
        config.data
      );
    }

    return (
      <EmptyChart
        text="Unsupported visualization type."
      />
    );
  };

  /* =====================================================
     BUILDER
  ===================================================== */

  const runBuilder = () => {
    if (!builderConfig) {
      setNotice(
        "This chart type is not supported by the selected columns."
      );

      return;
    }

    setNotice(
      `Visualization generated for ${
        builderConfig.column ||
        `${builderConfig.x} vs ${builderConfig.y}` ||
        "selected data"
      }.`
    );
  };

  const scrollToBuilder =
    () => {
      document
        .getElementById(
          "chart-builder"
        )
        ?.scrollIntoView({
          behavior:
            "smooth",
          block: "start",
        });
    };

  /* =====================================================
     EXPORT
  ===================================================== */

  const exportVisualization = (
    config
  ) => {
    if (!config) return;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1000,height=800"
      );

    if (!printWindow) {
      setNotice(
        "Please allow pop-ups to export the visualization."
      );

      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${String(
            config.title ||
              "NexusDS Visualization"
          ).replace(
            /</g,
            "&lt;"
          )}</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #111827;
            }

            h1 {
              margin-bottom: 8px;
            }

            p {
              color: #4b5563;
            }

            pre {
              white-space: pre-wrap;
              background: #f3f4f6;
              padding: 20px;
              border-radius: 12px;
            }
          </style>
        </head>

        <body>
          <h1>${String(
            config.title ||
              "NexusDS Visualization"
          ).replace(
            /</g,
            "&lt;"
          )}</h1>

          <p>
            Generated from ${String(
              selectedDatasetInfo?.fileName ||
                "selected dataset"
            ).replace(
              /</g,
              "&lt;"
            )}
          </p>

          <pre>${JSON.stringify(
            config.data ||
              config.stats ||
              config,
            null,
            2
          )
            .replace(
              /&/g,
              "&amp;"
            )
            .replace(
              /</g,
              "&lt;"
            )
            .replace(
              />/g,
              "&gt;"
            )}</pre>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* BACK */}

        <button
          onClick={() =>
            navigate(
              "/agents"
            )
          }
          className="text-gray-400 hover:text-cyan-400 transition mb-8"
        >
          ← Back to AI Agents
        </button>

        {/* HEADER */}

        <div className="mb-10">
          <p className="text-cyan-400 font-semibold">
            📊 AI AGENT
          </p>

          <h1 className="text-5xl font-bold mt-3">
            Data{" "}
            <span className="text-cyan-400">
              Visualization
            </span>
          </h1>

          <p className="text-gray-400 mt-4 max-w-4xl">
            Automatically discover distributions,
            trends, relationships, outliers and
            category patterns, then build your own
            visualizations from the same analyzed dataset.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-8 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-5">
            {error}
          </div>
        )}

        {/* NOTICE */}

        {notice && (
          <div className="mb-8 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-2xl p-5">
            {notice}
          </div>
        )}

        {/* DATASET SELECTOR */}

        <section className="bg-slate-900 border border-cyan-500/20 rounded-3xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <p className="text-cyan-400 font-semibold">
                STEP 1
              </p>

              <h2 className="text-2xl font-bold mt-1">
                Select Dataset
              </h2>

              <p className="text-gray-500 mt-1">
                Visualization always uses the actual selected
                dataset analysis.
              </p>
            </div>

            <button
              onClick={
                loadDatasets
              }
              disabled={
                loadingDatasets
              }
              className="border border-cyan-500/40 hover:border-cyan-400 px-5 py-3 rounded-xl text-cyan-400 transition disabled:opacity-50"
            >
              ↻ Refresh Datasets
            </button>
          </div>

          <select
            value={
              selectedDataset
            }
            onChange={
              handleDatasetChange
            }
            className="w-full mt-6 bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 outline-none focus:border-cyan-400"
          >
            <option value="">
              {loadingDatasets
                ? "Loading datasets..."
                : "Select Dataset"}
            </option>

            {datasets.map(
              (dataset) => (
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
            )}
          </select>

          {loadingDatasets && (
            <p className="text-cyan-400 mt-4">
              Loading datasets...
            </p>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-3 text-cyan-400">
              <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              Analyzing dataset and preparing visual tools...
            </div>
          )}

          {selectedDatasetInfo &&
            !loading && (
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-2 rounded-lg bg-slate-800 text-gray-300">
                  {
                    selectedDatasetInfo.fileName
                  }
                </span>

                <span className="px-3 py-2 rounded-lg bg-slate-800 text-gray-400">
                  {formatNumber(
                    selectedDatasetInfo.rows
                  )}{" "}
                  rows
                </span>

                <span className="px-3 py-2 rounded-lg bg-slate-800 text-gray-400">
                  {formatNumber(
                    selectedDatasetInfo.columns
                  )}{" "}
                  columns
                </span>
              </div>
            )}
        </section>

        {analysis && (
          <>
            {/* INTELLIGENCE */}

            <section className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                [
                  "Rows",
                  analysis.summary
                    ?.rows,
                ],
                [
                  "Columns",
                  analysis.summary
                    ?.columns,
                ],
                [
                  "Numeric",
                  numericColumns.length,
                ],
                [
                  "Categorical",
                  categoricalColumns.length,
                ],
                [
                  "Date",
                  dateColumns.length,
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
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
                  >
                    <p className="text-gray-500 text-sm">
                      {label}
                    </p>

                    <p className="text-2xl font-bold mt-2 text-cyan-400">
                      {formatNumber(
                        value
                      )}
                    </p>
                  </div>
                )
              )}
            </section>

            {/* TOOL NAVIGATION */}

            <section className="mt-8 bg-slate-900 border border-cyan-500/20 rounded-3xl p-8">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                <div>
                  <p className="text-cyan-400 font-semibold">
                    STEP 2
                  </p>

                  <h2 className="text-2xl font-bold mt-1">
                    Visualization Studio
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Choose automatic discovery or build a
                    custom chart.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    [
                      "auto",
                      "⚡ Auto Insights",
                    ],
                    [
                      "builder",
                      "🛠 Chart Builder",
                    ],
                    [
                      "relationships",
                      "🔗 Relationships",
                    ],
                    [
                      "profiles",
                      "📐 Distributions",
                    ],
                  ].map(
                    ([
                      value,
                      label,
                    ]) => (
                      <button
                        key={
                          value
                        }
                        onClick={() =>
                          setActiveTool(
                            value
                          )
                        }
                        className={
                          "px-4 py-2 rounded-xl text-sm font-semibold transition " +
                          (activeTool ===
                          value
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-slate-800 text-gray-300 hover:bg-slate-700")
                        }
                      >
                        {
                          label
                        }
                      </button>
                    )
                  )}
                </div>
              </div>
            </section>

            {/* AUTO */}

            {activeTool ===
              "auto" && (
              <section className="mt-8">
                <div className="flex items-end justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Automatic Visualizations
                    </h2>

                    <p className="text-gray-500 mt-1">
                      Charts selected from the actual column
                      types and analysis results.
                    </p>
                  </div>

                  <button
                    onClick={
                      scrollToBuilder
                    }
                    className="text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    Create Custom →
                  </button>
                </div>

                {getAutoCharts.length ===
                0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-gray-500">
                    No suitable visualizations could be
                    generated from this dataset.
                  </div>
                ) : (
                  <div className="grid xl:grid-cols-2 gap-6">
                    {getAutoCharts.map(
                      (
                        chart
                      ) => (
                        <div
                          key={
                            chart.id
                          }
                          className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
                        >
                          <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-cyan-400 text-xs uppercase tracking-wider font-bold">
                                {
                                  chart.type
                                }
                              </p>

                              <h3 className="text-xl font-bold mt-1">
                                {
                                  chart.title
                                }
                              </h3>
                            </div>

                            <button
                              onClick={() =>
                                exportVisualization(
                                  chart
                                )
                              }
                              className="text-sm px-3 py-2 rounded-lg border border-slate-700 hover:border-cyan-400 hover:text-cyan-400 transition"
                            >
                              Export
                            </button>
                          </div>

                          <div className="bg-slate-950">
                            {renderChartByConfig(
                              chart
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            {/* BUILDER */}

            {activeTool ===
              "builder" && (
              <section
                id="chart-builder"
                className="mt-8 bg-slate-900 border border-cyan-500/20 rounded-3xl p-8"
              >
                <p className="text-cyan-400 font-semibold">
                  STEP 3
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  Chart Builder
                </h2>

                <p className="text-gray-500 mt-1">
                  Build a visualization from the real
                  dataset fields.
                </p>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 mt-7">
                  <div>
                    <label className="text-gray-400 text-sm">
                      Chart Type
                    </label>

                    <select
                      value={
                        chartType
                      }
                      onChange={(
                        event
                      ) =>
                        setChartType(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {chartOptions.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option.value
                            }
                            value={
                              option.value
                            }
                            disabled={
                              !option.available
                            }
                          >
                            {
                              option.label
                            }
                            {!option.available
                              ? " — unavailable"
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      X / Category
                    </label>

                    <select
                      value={
                        xColumn
                      }
                      onChange={(
                        event
                      ) =>
                        setXColumn(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {columns.map(
                        (
                          column
                        ) => (
                          <option
                            key={
                              column
                            }
                            value={
                              column
                            }
                          >
                            {
                              column
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      Y / Numeric
                    </label>

                    <select
                      value={
                        yColumn
                      }
                      onChange={(
                        event
                      ) =>
                        setYColumn(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {(numericColumns.length
                        ? numericColumns
                        : columns
                      ).map(
                        (
                          column
                        ) => (
                          <option
                            key={
                              column
                            }
                            value={
                              column
                            }
                          >
                            {
                              column
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      Distribution Column
                    </label>

                    <select
                      value={
                        selectedColumn
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedColumn(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                    >
                      {columns.map(
                        (
                          column
                        ) => (
                          <option
                            key={
                              column
                            }
                            value={
                              column
                            }
                          >
                            {
                              column
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={
                      runBuilder
                    }
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition"
                  >
                    Generate Visualization
                  </button>

                  <button
                    onClick={() =>
                      setActiveTool(
                        "auto"
                      )
                    }
                    className="border border-slate-700 hover:border-cyan-400 text-gray-300 hover:text-cyan-400 px-6 py-3 rounded-xl transition"
                  >
                    Back to Auto
                  </button>
                </div>

                <div className="mt-8 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="text-xl font-bold">
                      Custom Preview
                    </h3>

                    <p className="text-gray-500 text-sm mt-1">
                      {builderConfig?.title ||
                        "Choose a compatible chart type and columns."}
                    </p>
                  </div>

                  {renderChartByConfig(
                    builderConfig
                  )}
                </div>
              </section>
            )}

            {/* RELATIONSHIPS */}

            {activeTool ===
              "relationships" && (
              <section className="mt-8 grid lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <p className="text-cyan-400 text-xs uppercase font-bold">
                      Relationships
                    </p>

                    <h2 className="text-2xl font-bold mt-1">
                      Correlation Analysis
                    </h2>

                    <p className="text-gray-500 text-sm mt-1">
                      Strong numeric relationships detected
                      by the backend.
                    </p>
                  </div>

                  {renderHeatmap(
                    correlations
                  )}
                </div>

                <div className="bg-slate-900 border border-purple-500/20 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <p className="text-purple-400 text-xs uppercase font-bold">
                      Scatter Analysis
                    </p>

                    <h2 className="text-2xl font-bold mt-1">
                      Numeric Relationship
                    </h2>

                    <p className="text-gray-500 text-sm mt-1">
                      Uses the dataset preview for the selected
                      numeric pair.
                    </p>
                  </div>

                  {numericColumns.length >=
                  2 ? (
                    renderScatter(
                      getPreviewNumericRows(
                        numericColumns[0],
                        numericColumns[1]
                      )
                    )
                  ) : (
                    <EmptyChart
                      text="At least two numeric columns are required."
                    />
                  )}
                </div>
              </section>
            )}

            {/* PROFILES */}

            {activeTool ===
              "profiles" && (
              <section className="mt-8">
                <div className="grid lg:grid-cols-2 gap-6">
                  {numericColumns.map(
                    (
                      column
                    ) => {
                      const distribution =
                        getDistribution(
                          column
                        );

                      return (
                        <div
                          key={
                            column
                          }
                          className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
                        >
                          <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold">
                              {
                                column
                              }
                            </h3>

                            <p className="text-gray-500 text-sm mt-1">
                              {dataTypes[
                                column
                              ] ||
                                "numeric"}{" "}
                              • Mean{" "}
                              {formatNumber(
                                statistics[
                                  column
                                ]?.mean
                              )}{" "}
                              • Outliers{" "}
                              {formatNumber(
                                outliers?.[
                                  column
                                ]?.count
                              )}
                            </p>
                          </div>

                          {renderBars(
                            distribution,
                            false
                          )}
                        </div>
                      );
                    }
                  )}

                  {categoricalColumns.map(
                    (
                      column
                    ) => {
                      const distribution =
                        getDistribution(
                          column
                        );

                      return (
                        <div
                          key={
                            column
                          }
                          className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
                        >
                          <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold">
                              {
                                column
                              }
                            </h3>

                            <p className="text-gray-500 text-sm mt-1">
                              Category frequency • Top values
                            </p>
                          </div>

                          {renderBars(
                            distribution,
                            true
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </section>
            )}

            {/* TOOLKIT */}

            <section className="mt-10 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-purple-500/10 border border-cyan-400/20 rounded-3xl p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <p className="text-cyan-400 font-bold">
                    VISUALIZATION TOOLKIT
                  </p>

                  <h2 className="text-2xl font-bold mt-1">
                    {
                      chartOptions.filter(
                        (
                          item
                        ) =>
                          item.available
                      ).length
                    }{" "}
                    chart types available for this dataset
                  </h2>

                  <p className="text-gray-500 mt-2 max-w-3xl">
                    Available charts are determined by the
                    actual column types and analysis results,
                    so NexusDS AI does not generate meaningless
                    visualizations for unsupported data.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActiveTool(
                      "builder"
                    );

                    setTimeout(
                      scrollToBuilder,
                      50
                    );
                  }}
                  className="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-7 py-4 rounded-xl transition"
                >
                  Open Chart Builder →
                </button>
              </div>
            </section>

            {/* DATASET PREVIEW */}

            {preview.length >
              0 && (
              <section className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <h2 className="text-2xl font-bold mb-5">
                  Dataset Preview
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {columns.map(
                          (
                            column
                          ) => (
                            <th
                              key={
                                column
                              }
                              className="text-left px-4 py-3 text-cyan-400 whitespace-nowrap"
                            >
                              {
                                column
                              }
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {preview.map(
                        (
                          row,
                          rowIndex
                        ) => (
                          <tr
                            key={
                              rowIndex
                            }
                            className="border-b border-slate-800"
                          >
                            {columns.map(
                              (
                                column
                              ) => (
                                <td
                                  key={
                                    column
                                  }
                                  className="px-4 py-3 text-gray-300 whitespace-nowrap"
                                >
                                  {String(
                                    row[
                                      column
                                    ] ??
                                      "—"
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
              </section>
            )}
          </>
        )}

        {!analysis &&
          !loading &&
          !error && (
            <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
              <div className="text-5xl mb-5">
                📊
              </div>

              <h2 className="text-2xl font-bold">
                Select a dataset to start visualization
              </h2>

              <p className="text-gray-500 mt-2">
                NexusDS AI will inspect its columns and prepare
                the visualization toolkit automatically.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}

export default Visualization;