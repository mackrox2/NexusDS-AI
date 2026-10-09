import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowLeft,
  FaBrain,
  FaChartBar,
  FaCheckCircle,
  FaDatabase,
  FaInfoCircle,
  FaLightbulb,
  FaShieldAlt,
} from "react-icons/fa";

function readTrainingResult() {
  const keys = [
    "nexusds_last_training_result",
    "lastMLTrainingResult",
    "lastMLTraining",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // Ignore invalid/stale local storage and try the next key.
    }
  }

  return null;
  }

function prettyName(value) {
  return String(value || "Unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value >= 0 && value <= 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(3);
}

export default function Explainability() {
  const result = useMemo(() => readTrainingResult(), []);
  const importance = Array.isArray(result?.featureImportance)
    ? result.featureImportance
        .filter((item) => item && typeof item.feature === "string")
        .map((item) => ({
          feature: item.feature,
          importance: Number(item.importance) || 0,
        }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 12)
    : [];

  const metrics = result?.metrics || {};
  const hasResult = Boolean(result && (result.modelId || result.algorithm || result.featureImportance));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/agents/ml-training"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        >
          <FaArrowLeft /> Back to ML Training
        </Link>

        <header className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <FaLightbulb /> Model transparency
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Explainable <span className="text-cyan-300">AI</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Understand which features influenced your trained model, review its evaluation metrics,
            and see what the current training result can—and cannot—tell you.
          </p>
        </header>

        {!hasResult ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <FaInfoCircle className="text-xl" />
            </div>
            <h2 className="text-xl font-bold">Train a model to view explanations</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              No recent training result was found in this browser. Open ML Training, train a model,
              and return here. This page does not invent feature importance or model scores.
            </p>
            <Link
              to="/agents/ml-training"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <FaBrain /> Open ML Training
            </Link>
          </section>
        ) : (
            <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Algorithm", value: prettyName(result.algorithm), icon: FaBrain },
                { label: "Problem type", value: prettyName(result.problemType), icon: FaDatabase },
                { label: "Target column", value: result.targetColumn || "—", icon: FaChartBar },
                { label: "Model status", value: prettyName(result.modelStatus || "trained"), icon: FaCheckCircle },
              ].map(({ label, value, icon: Icon }) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="mb-3 flex items-center justify-between text-slate-400">
                    <span className="text-sm">{label}</span>
                    <Icon className="text-cyan-300" />
                  </div>
                  <p className="break-words text-lg font-bold text-white">{value}</p>
                </article>
              ))}
            </section>

            <section className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                    <FaChartBar />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Feature importance</h2>
                    <p className="text-xs text-slate-400">Top features returned by the training API</p>
                  </div>
                </div>

                {importance.length ? (
                  <div className="space-y-4">
                    {importance.map((item) => {
                      const max = Math.max(...importance.map((entry) => entry.importance), 0.00001);
                      const width = Math.max(2, (item.importance / max) * 100);
                      return (
                        <div key={item.feature}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="break-all text-slate-200">{item.feature}</span>
                            <span className="shrink-0 font-mono text-xs text-cyan-300">
                              {item.importance.toFixed(5)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${width}%` }}
                              title={`${item.feature}: ${item.importance}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">
                    The training result did not include feature-importance values. This can happen
                    for algorithms that do not expose native feature importance. No values are fabricated.
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <FaShieldAlt />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Evaluation metrics</h2>
                    <p className="text-xs text-slate-400">Values from the model training response</p>
                  </div>
                </div>
                {Object.keys(metrics).length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(metrics).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                        <p className="text-xs text-slate-400">{prettyName(key)}</p>
                        <p className="mt-2 text-xl font-black text-white">{formatMetric(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No evaluation metrics were saved with this result.</p>
                )}
                <p className="mt-5 text-xs leading-5 text-slate-500">
                  Metrics describe evaluation on the training workflow's held-out data; they do not guarantee
                  the same performance on future or unseen data.
                </p>
              </article>
            </section>

            <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
              <h2 className="flex items-center gap-2 font-bold text-amber-200">
                <FaInfoCircle /> Interpretation notes
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                <li>Feature importance indicates relative contribution according to the model's supported importance method; it does not prove causation.</li>
                <li>Native importance may be unavailable for some algorithms, so an empty chart is not necessarily a training failure.</li>
                <li>This page currently explains the latest result available in browser storage. It does not claim to provide SHAP values or per-row explanations.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
