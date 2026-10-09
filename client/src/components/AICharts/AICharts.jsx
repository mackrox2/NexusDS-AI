import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

function AICharts({ analysis, datasetInfo }) {
  if (!analysis || !datasetInfo) return null;

  const barData = {
    labels: ["Numeric Columns", "Categorical Columns"],
    datasets: [
      {
        label: "Columns",
        data: [
          analysis.numericColumns.length,
          analysis.categoricalColumns.length,
        ],
        backgroundColor: ["#06b6d4", "#22c55e"],
      },
    ],
  };

  const pieData = {
    labels: ["Numeric", "Categorical"],
    datasets: [
      {
        data: [
          analysis.numericColumns.length,
          analysis.categoricalColumns.length,
        ],
        backgroundColor: ["#06b6d4", "#22c55e"],
      },
    ],
  };

  const lineData = {
    labels: ["Rows", "Columns", "Missing Values"],
    datasets: [
      {
        label: "Dataset Statistics",
        data: [
          datasetInfo.rows,
          datasetInfo.columns,
          analysis.missingValues,
        ],
        borderColor: "#06b6d4",
        backgroundColor: "#06b6d4",
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="mt-12">

      <h2 className="text-4xl font-bold text-cyan-400 mb-8">
        📊 AI Analytics Dashboard
      </h2>

      <div className="grid lg:grid-cols-2 gap-8">

        <div className="bg-slate-900 rounded-3xl p-8">
          <Bar data={barData} />
        </div>

        <div className="bg-slate-900 rounded-3xl p-8">
          <Pie data={pieData} />
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 lg:col-span-2">
          <Line data={lineData} />
        </div>

      </div>

    </div>
  );
}

export default AICharts;