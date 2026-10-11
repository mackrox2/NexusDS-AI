import React, { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {

  FaArrowLeft,

  FaBrain,

  FaChartLine,

  FaCheckCircle,

  FaExclamationTriangle,

  FaMagic,

  FaPlay,

  FaRedo,

  FaRobot,

  FaSpinner,

  FaTable,

  FaBolt,

  FaInfoCircle,

} from "react-icons/fa";



const API_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "https://nexusds-ai.onrender.com").replace(/\/+$/, "");




function getAuthHeaders() {



  const token = localStorage.getItem("token");



  if (!token) return null;



  return {

    "Content-Type": "application/json",

    Authorization: `Bearer ${token}`,

  };

}



function formatName(value) {



  return String(value || "—")

    .replaceAll("_", " ")

    .replace(/\b\w/g, (char) => char.toUpperCase());

}



function formatMetric(value) {



  if (value == null || Number.isNaN(Number(value))) return "—";



  const number = Number(value);





  if (!Number.isFinite(number)) return "—";



  if (Math.abs(number) <= 1) {

    return `${(number * 100).toFixed(1)}%`;

  }



  return number.toFixed(3);

}



function isEmpty(value) {



  return value == null || String(value).trim() === "";

}



function isNumericFeature(model, column) {



  return new Set(model?.numericFeatures || []).has(column);

}



function safeNumber(value) {



  const number = Number(value);



  return Number.isFinite(number) ? number : null;

}



function getModelQuality(model) {



  const metrics = model?.metrics || {};



  const problemType = String(model?.problemType || "").toLowerCase();





  if (problemType === "regression") {

    const r2 = safeNumber(metrics.r2);





    if (r2 == null) return null;



    if (r2 >= 0.8) return { label: "Excellent", tone: "emerald" };

    if (r2 >= 0.6) return { label: "Good", tone: "cyan" };

    if (r2 >= 0.4) return { label: "Moderate", tone: "amber" };



    return { label: "Needs improvement", tone: "red" };

  }



  const accuracy = safeNumber(metrics.accuracy);





  if (accuracy == null) return null;



  if (accuracy >= 0.9) return { label: "Excellent", tone: "emerald" };

  if (accuracy >= 0.75) return { label: "Good", tone: "cyan" };

  if (accuracy >= 0.6) return { label: "Moderate", tone: "amber" };



  return { label: "Needs improvement", tone: "red" };

}



function QualityBadge({ quality }) {



  if (!quality) return null;



  const classes = {



    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",

    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",

    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",

    red: "bg-red-500/10 border-red-500/20 text-red-300",

  };



  return (



    <span

      className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-black ${

        classes[quality.tone]

      }`}

    >

      <FaCheckCircle />

      {quality.label}

    </span>

  );

}



function MetricCard({ label, value }) {



  return (



    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">

      <p className="text-[11px] font-black tracking-wider text-slate-500 uppercase">

        {formatName(label)}

      </p>

      <p className="text-xl font-black mt-2 text-white">{value}</p>

    </div>

  );

}



function PredictionStudio() {



  const navigate = useNavigate();





  const [datasetId, setDatasetId] = useState(



    localStorage.getItem("selectedDatasetId") || ""

  );



  const [modelId, setModelId] = useState(



    localStorage.getItem("lastMLModelId") || ""

  );



  const [model, setModel] = useState(null);



  const [formValues, setFormValues] = useState({});



  const [prediction, setPrediction] = useState(null);





  const [loading, setLoading] = useState(true);



  const [predicting, setPredicting] = useState(false);



  const [autoGenerating, setAutoGenerating] = useState(false);



  const [error, setError] = useState("");



  const [notice, setNotice] = useState("");





  const [predictionMode, setPredictionMode] = useState("manual");



  const [showDiagnostics, setShowDiagnostics] = useState(true);



  const [showFeatureIntelligence, setShowFeatureIntelligence] =



    useState(true);

  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);





  const featureColumns = useMemo(



    () => model?.featureColumns || [],

    [model]

  );



  const numericFeatures = useMemo(



    () => new Set(model?.numericFeatures || []),

    [model]

  );



  const categoricalFeatures = useMemo(



    () => new Set(model?.categoricalFeatures || []),

    [model]

  );



  const metrics = model?.metrics || {};



  const diagnostics = model?.diagnostics || {};



  const quality = useMemo(() => getModelQuality(model), [model]);





  const isRegression =



    String(model?.problemType || "").toLowerCase() === "regression";



  const isClassification =



    String(model?.problemType || "").toLowerCase() === "classification";



  const topFeatures = useMemo(() => {



    if (!Array.isArray(model?.featureImportance)) return [];



    return [...model.featureImportance]

      .sort(

        (a, b) =>

          Number(b?.importance || 0) - Number(a?.importance || 0)

      )

      .slice(0, 10);

  }, [model]);



  const featureIntelligence = model?.featureIntelligence || {};



  const excludedFeatures = Array.isArray(featureIntelligence?.excludedColumns)



    ? featureIntelligence.excludedColumns

    : [];

  const engineeredFeatures = Array.isArray(



    featureIntelligence?.engineeredColumns

  )

    ? featureIntelligence.engineeredColumns

    : [];



  const loadModel = async () => {



    setLoading(true);

    setError("");

    setNotice("");



    const headers = getAuthHeaders();





    if (!headers) {

      localStorage.removeItem("token");

      navigate("/login");

      return;

    }



    if (!modelId) {

      setLoading(false);

      setError(

        "No trained model was selected. Train a model first from Machine Learning Training."

      );

      return;

    }



    try {

      const response = await fetch(



        `${API_URL}/api/ml/model/${encodeURIComponent(modelId)}`,

        {

          method: "GET",

          headers,

        }

      );



      if (response.status === 401) {

        localStorage.removeItem("token");

        navigate("/login");

        return;

      }



      const data = await response.json();





      if (!response.ok) {

        throw new Error(

          data?.detail || "Unable to load the trained model."

        );

      }



      const loadedModel = data?.model;





      if (!loadedModel) {

        throw new Error("Model metadata was not returned by the server.");

      }



      setModel(loadedModel);



      if (!datasetId && loadedModel.datasetId) {

        const selectedDataset = String(loadedModel.datasetId);



        setDatasetId(selectedDataset);

        localStorage.setItem("selectedDatasetId", selectedDataset);

      }



      const initialValues = {};





      (loadedModel.featureColumns || []).forEach((column) => {

        initialValues[column] =

          loadedModel.featureDefaults?.[column] ?? "";

      });



      setFormValues(initialValues);

    } catch (err) {

      console.error("PREDICTION STUDIO MODEL ERROR:", err);

      setError(err.message || "Could not load the trained model.");

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    loadModel();

    // eslint-disable-next-line react-hooks/exhaustive-deps



  }, [modelId]);



  const updateField = (column, value) => {



    setFormValues((current) => ({

      ...current,

      [column]: value,

    }));



    setPrediction(null);

    setError("");

    setNotice("");

  };



  const buildPredictionRow = (values) => {



    const row = {};





    featureColumns.forEach((column) => {

      const rawValue = values[column];





      if (isNumericFeature(model, column)) {

        const numberValue = Number(rawValue);





        if (!Number.isFinite(numberValue)) {

          throw new Error(`${column} must contain a valid numeric value.`);

        }



        row[column] = numberValue;

      } else {

        row[column] = rawValue;

      }

    });



    return row;

  };



  const predictRow = async (row, successMessage) => {



    const headers = getAuthHeaders();





    if (!headers) {

      localStorage.removeItem("token");

      navigate("/login");

      return;

    }



    if (!datasetId || !modelId) {

      setError("Dataset and model information is missing.");

      return;

    }



    const response = await fetch(`${API_URL}/api/ml/predict`, {



      method: "POST",

      headers,

      body: JSON.stringify({

        datasetId,

        modelId,

        rows: [row],

      }),

    });



    if (response.status === 401) {

      localStorage.removeItem("token");

      navigate("/login");

      return;

    }



    const data = await response.json();





    if (!response.ok) {

      throw new Error(data?.detail || "Prediction failed.");

    }



    setPrediction(data);

    setNotice(successMessage);

  };



  const predict = async () => {



    setError("");

    setNotice("");

    setPrediction(null);



    const headers = getAuthHeaders();





    if (!headers) {

      localStorage.removeItem("token");

      navigate("/login");

      return;

    }



    if (!datasetId || !modelId) {

      setError("Dataset and model information is missing.");

      return;

    }



    const missing = featureColumns.filter((column) =>



      isEmpty(formValues[column])

    );



    if (missing.length > 0) {

      setError(`Please fill these fields: ${missing.join(", ")}`);

      return;

    }



    try {

      setPredicting(true);



      const row = buildPredictionRow(formValues);





      await predictRow(row, "Prediction generated successfully.");

    } catch (err) {

      console.error("PREDICTION ERROR:", err);

      setError(err.message || "Prediction failed.");

    } finally {

      setPredicting(false);

    }

  };



  const generateAutoPrediction = async () => {



    setError("");

    setNotice("");

    setPrediction(null);



    const defaults = model?.featureDefaults || {};





    if (

      !defaults ||

      Object.keys(defaults).length === 0 ||

      featureColumns.length === 0

    ) {

      setError(

        "Auto Prediction is unavailable for this model. Train the model again with the upgraded ML backend."

      );

      return;

    }



    try {

      setAutoGenerating(true);



      const generated = {};





      featureColumns.forEach((column) => {

        generated[column] = defaults[column] ?? "";

      });



      setFormValues(generated);



      const row = buildPredictionRow(generated);





      await predictRow(

        row,

        "Auto Prediction generated using representative training-data values."

      );

    } catch (err) {

      console.error("AUTO PREDICTION ERROR:", err);

      setError(err.message || "Auto Prediction failed.");

    } finally {

      setAutoGenerating(false);

    }

  };



  const handleModeChange = (mode) => {



    setPredictionMode(mode);

    setPrediction(null);

    setError("");

    setNotice("");



    if (mode === "auto" && model?.featureDefaults) {

      setFormValues((current) => {

        const next = { ...current };





        featureColumns.forEach((column) => {

          if (next[column] === "" || next[column] == null) {

            next[column] = model.featureDefaults[column] ?? "";

          }

        });



        return next;

      });

    }

  };



  const clearInputs = () => {



    const cleared = {};





    featureColumns.forEach((column) => {

      cleared[column] = "";

    });



    setFormValues(cleared);

    setPrediction(null);

    setError("");

    setNotice("Prediction inputs cleared.");

  };



  const topPrediction = prediction?.predictions?.[0];





  return (



    <div className="min-h-screen bg-slate-950 text-white">

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">

        <button

          type="button"

          onClick={() => navigate("/agents")}

          className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-300 transition mb-7"

        >

          <FaArrowLeft />

          Back to AI Agents

        </button>



        <header className="mb-8">

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black tracking-wider">

            <FaRobot />

            PREDICTION STUDIO

          </div>



          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>

              <h1 className="text-4xl md:text-5xl font-black mt-4">

                Prediction{" "}

                <span className="text-cyan-400">Studio</span>

              </h1>



              <p className="text-slate-400 mt-3 max-w-3xl">

                Generate single-row predictions from your trained NexusDS

                model, use representative values for Auto Prediction, and

                inspect model performance and Explainable AI.

              </p>

            </div>



            <div className="flex flex-wrap gap-2">

              <QualityBadge quality={quality} />



              <button

                type="button"

                onClick={loadModel}

                disabled={loading || predicting || autoGenerating}

                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 font-bold text-sm"

              >

                <FaRedo />

                Refresh

              </button>

            </div>

          </div>

        </header>



        {error ? (

          <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-5 py-4">

            <FaExclamationTriangle className="mt-1 shrink-0" />

            <div>

              <p className="font-bold">Prediction Studio Error</p>

              <p className="text-sm mt-1">{error}</p>

            </div>

          </div>

        ) : null}



        {notice ? (

          <div className="mb-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl px-5 py-4">

            <FaCheckCircle />

            {notice}

          </div>

        ) : null}



        {loading ? (

          <div className="min-h-[360px] flex items-center justify-center">

            <div className="text-center">

              <FaSpinner className="animate-spin text-4xl text-cyan-400 mx-auto" />

              <p className="text-slate-400 mt-4">

                Loading trained model...

              </p>

            </div>

          </div>

        ) : (

          <>

            {model ? (

              <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">



                <MetricCard

                  label="Model"

                  value={formatName(model.algorithm)}

                />

                <MetricCard

                  label="Problem Type"

                  value={formatName(model.problemType)}

                />

                <MetricCard

                  label="Target"

                  value={model.targetColumn || "—"}

                />

                <MetricCard

                  label="Features"

                  value={featureColumns.length}

                />

              </section>



            ) : null}



            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 mb-6">



              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div>

                  <p className="text-xs font-black tracking-wider text-cyan-300">

                    PREDICTION MODE

                  </p>

                  <h2 className="text-xl font-black mt-1">

                    Choose how you want to predict

                  </h2>

                  <p className="text-sm text-slate-500 mt-1">

                    Manual mode uses your values. Auto mode uses representative

                    values stored with the trained model.

                  </p>

                </div>



                <div className="flex gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1">

                  <button

                    type="button"

                    onClick={() => handleModeChange("manual")}

                    className={`px-4 py-2 rounded-lg font-bold text-sm ${

                      predictionMode === "manual"

                        ? "bg-cyan-500 text-slate-950"

                        : "text-slate-400 hover:text-white"

                    }`}

                  >

                    Manual Prediction

                  </button>



                  <button

                    type="button"

                    onClick={() => handleModeChange("auto")}

                    className={`px-4 py-2 rounded-lg font-bold text-sm ${

                      predictionMode === "auto"

                        ? "bg-purple-500 text-white"

                        : "text-slate-400 hover:text-white"

                    }`}

                  >

                    Auto Prediction

                  </button>

                </div>

              </div>

            </section>





            <div className="grid xl:grid-cols-3 gap-6">

              <section className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">



                <div className="flex items-start justify-between gap-4 mb-6">

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center justify-center">

                      <FaMagic />

                    </div>



                    <div>

                      <h2 className="text-xl font-black">

                        Prediction Input

                      </h2>

                      <p className="text-sm text-slate-500 mt-1">

                        {featureColumns.length} model feature fields

                      </p>

                    </div>

                  </div>



                  <button

                    type="button"

                    onClick={clearInputs}

                    disabled={predicting || autoGenerating}

                    className="text-xs font-bold text-slate-500 hover:text-red-300 disabled:opacity-40"

                  >

                    Clear inputs

                  </button>

                </div>



                {featureColumns.length === 0 ? (

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-amber-300">

                    Feature columns were not returned by the trained model.

                    Train the model again with the upgraded ML backend.

                  </div>

                ) : (

                  <div className="grid md:grid-cols-2 gap-4">

                    {featureColumns.map((column) => (

                      <label key={column} className="block">

                        <span className="block text-sm font-bold text-slate-300 mb-2">

                          {column}



                          {numericFeatures.has(column) ? (

                            <span className="ml-2 text-[10px] text-cyan-400 uppercase">

                              numeric

                            </span>

                          ) : (

                            <span className="ml-2 text-[10px] text-purple-400 uppercase">

                              categorical

                            </span>

                          )}

                        </span>



                        <input

                          value={formValues[column] ?? ""}

                          onChange={(event) =>

                            updateField(column, event.target.value)

                          }

                          type={numericFeatures.has(column) ? "number" : "text"}

                          step={

                            numericFeatures.has(column) ? "any" : undefined

                          }

                          placeholder={

                            numericFeatures.has(column)

                              ? `Enter ${column}`

                              : `Enter ${column}`

                          }

                          disabled={

                            predictionMode === "auto" ||

                            predicting ||

                            autoGenerating

                          }

                          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400/50 disabled:opacity-60 outline-none rounded-xl px-4 py-3 text-white placeholder:text-slate-600 transition"

                        />



                        {model?.featureDefaults?.[column] !== undefined ? (

                          <p className="text-[10px] text-slate-600 mt-1">

                            Representative default:{" "}

                            {String(model.featureDefaults[column])}

                          </p>

                        ) : null}

                      </label>

                    ))}

                  </div>

                )}



                {predictionMode === "auto" ? (

                  <button

                    type="button"

                    onClick={generateAutoPrediction}

                    disabled={

                      autoGenerating ||

                      predicting ||

                      featureColumns.length === 0

                    }

                    className="mt-7 w-full inline-flex items-center justify-center gap-3 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-black px-6 py-4 rounded-xl transition"

                  >

                    {autoGenerating ? (

                      <>

                        <FaSpinner className="animate-spin" />

                        Generating Auto Prediction...

                      </>

                    ) : (

                      <>

                        <FaMagic />

                        Generate Auto Prediction

                      </>

                    )}

                  </button>

                ) : (

                  <button

                    type="button"

                    onClick={predict}

                    disabled={

                      predicting ||

                      autoGenerating ||

                      featureColumns.length === 0

                    }

                    className="mt-7 w-full inline-flex items-center justify-center gap-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-6 py-4 rounded-xl transition"

                  >

                    {predicting ? (

                      <>

                        <FaSpinner className="animate-spin" />

                        Generating Prediction...

                      </>

                    ) : (

                      <>

                        <FaPlay />

                        Generate Prediction

                      </>

                    )}

                  </button>

                )}

              </section>





              <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">



                <div className="flex items-center gap-3 mb-6">

                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center">

                    <FaBrain />

                  </div>



                  <div>

                    <h2 className="text-xl font-black">Prediction Result</h2>

                    <p className="text-sm text-slate-500 mt-1">

                      Live output from the trained model.

                    </p>

                  </div>

                </div>



                {!prediction ? (

                  <div className="min-h-[250px] flex items-center justify-center text-center border border-dashed border-slate-800 rounded-2xl">

                    <div>

                      <FaChartLine className="text-3xl text-slate-700 mx-auto" />

                      <p className="text-slate-500 mt-3">

                        Run a prediction to see the result.

                      </p>

                    </div>

                  </div>

                ) : (

                  <div className="space-y-5">

                    <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 p-6 text-center">

                      <p className="text-xs font-black tracking-wider text-slate-500 uppercase">

                        Predicted {formatName(model?.targetColumn)}

                      </p>



                      <p className="text-4xl font-black text-cyan-300 mt-3 break-words">

                        {topPrediction ?? "—"}

                      </p>



                      <p className="text-xs text-slate-500 mt-3">

                        {isRegression

                          ? "Regression output"

                          : "Classification output"}

                      </p>

                    </div>



                    {isClassification &&

                    Array.isArray(prediction.probabilities) &&

                    prediction.probabilities[0] ? (

                      <div>

                        <p className="text-sm font-black text-slate-300 mb-3">

                          CLASS PROBABILITIES

                        </p>



                        <div className="space-y-3">

                          {Object.entries(

                            prediction.probabilities[0]

                          ).map(([label, value]) => {

                            const percentage = Math.max(



                              0,

                              Math.min(100, Number(value) * 100)

                            );



                            return (



                              <div key={label}>

                                <div className="flex justify-between text-xs mb-1">

                                  <span>{label}</span>

                                  <span className="text-cyan-300">

                                    {percentage.toFixed(1)}%

                                  </span>

                                </div>



                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">

                                  <div

                                    className="h-full bg-cyan-400 rounded-full"

                                    style={{

                                      width: `${percentage}%`,

                                    }}

                                  />

                                </div>

                              </div>

                            );

                          })}

                        </div>

                      </div>

                    ) : null}

                  </div>

                )}

              </section>



            </div>



            <section className="mt-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">



              <button

                type="button"

                onClick={() =>

                  setShowFeatureIntelligence((current) => !current)

                }

                className="w-full flex items-center justify-between gap-4 text-left"

              >

                <div className="flex items-center gap-3">

                  <FaBrain className="text-purple-300" />

                  <div>

                    <h2 className="text-xl font-black">

                      Feature Intelligence

                    </h2>

                    <p className="text-sm text-slate-500 mt-1">

                      How the training pipeline prepared the model features.

                    </p>

                  </div>

                </div>



                <span className="text-xs text-slate-500">

                  {showFeatureIntelligence ? "Hide" : "Show"}

                </span>

              </button>



              {showFeatureIntelligence ? (

                <div className="grid md:grid-cols-3 gap-4 mt-6">

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">

                    <p className="text-xs font-black text-slate-500">

                      MODEL FEATURES

                    </p>

                    <p className="text-2xl font-black mt-2">

                      {featureColumns.length}

                    </p>

                  </div>



                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">

                    <p className="text-xs font-black text-slate-500">

                      EXCLUDED IDENTIFIERS

                    </p>

                    <p className="text-2xl font-black mt-2">

                      {excludedFeatures.length}

                    </p>

                    {excludedFeatures.length > 0 ? (

                      <p className="text-xs text-amber-300 mt-2 truncate">

                        {excludedFeatures.join(", ")}

                      </p>

                    ) : null}

                  </div>



                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">

                    <p className="text-xs font-black text-slate-500">

                      ENGINEERED FEATURES

                    </p>

                    <p className="text-2xl font-black mt-2">

                      {engineeredFeatures.length}

                    </p>

                    {engineeredFeatures.length > 0 ? (

                      <p className="text-xs text-cyan-300 mt-2 truncate">

                        {engineeredFeatures.slice(0, 4).join(", ")}

                      </p>

                    ) : null}

                  </div>

                </div>

              ) : null}

            </section>





            <section className="mt-6 grid lg:grid-cols-2 gap-6">



              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">

                <div className="flex items-center justify-between gap-4 mb-5">

                  <div className="flex items-center gap-3">

                    <FaChartLine className="text-cyan-300" />

                    <div>

                      <h2 className="text-xl font-black">

                        Model Performance

                      </h2>

                      <p className="text-sm text-slate-500">

                        Evaluation results from the training run.

                      </p>

                    </div>

                  </div>



                  <QualityBadge quality={quality} />

                </div>



                <div className="grid grid-cols-2 gap-3">

                  {Object.entries(metrics)

                    .filter(([, value]) => typeof value === "number")

                    .slice(0, showAdvancedMetrics ? 12 : 6)

                    .map(([key, value]) => (

                      <MetricCard

                        key={key}

                        label={key}

                        value={formatMetric(value)}

                      />

                    ))}

                </div>



                {Object.keys(metrics).length > 6 ? (

                  <button

                    type="button"

                    onClick={() =>

                      setShowAdvancedMetrics((current) => !current)

                    }

                    className="mt-4 text-sm font-bold text-cyan-300 hover:text-cyan-200"

                  >

                    {showAdvancedMetrics

                      ? "Show fewer metrics"

                      : "Show advanced metrics"}

                  </button>

                ) : null}

              </div>



              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">

                <button

                  type="button"

                  onClick={() =>

                    setShowDiagnostics((current) => !current)

                  }

                  className="w-full flex items-center justify-between gap-4 text-left"

                >

                  <div className="flex items-center gap-3">

                    <FaBolt className="text-amber-300" />

                    <div>

                      <h2 className="text-xl font-black">

                        Advanced Diagnostics

                      </h2>

                      <p className="text-sm text-slate-500">

                        Additional model-health signals returned by training.

                      </p>

                    </div>

                  </div>



                  <span className="text-xs text-slate-500">

                    {showDiagnostics ? "Hide" : "Show"}

                  </span>

                </button>



                {showDiagnostics ? (

                  Object.keys(diagnostics).length === 0 ? (

                    <div className="mt-5 rounded-2xl border border-dashed border-slate-800 p-6 text-center text-slate-500">

                      No advanced diagnostic values were returned by this

                      model.

                    </div>

                  ) : (

                    <div className="grid grid-cols-2 gap-3 mt-5">

                      {Object.entries(diagnostics)

                        .filter(([, value]) => typeof value === "number")

                        .slice(0, 10)

                        .map(([key, value]) => (

                          <MetricCard

                            key={key}

                            label={key}

                            value={Number(value).toFixed(4)}

                          />

                        ))}

                    </div>

                  )

                ) : null}

              </div>

            </section>





            <section className="mt-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">



              <div className="flex items-center gap-3 mb-5">

                <FaBrain className="text-purple-300" />

                <div>

                  <h2 className="text-xl font-black">

                    Explainable AI

                  </h2>

                  <p className="text-sm text-slate-500">

                    Most influential features reported by the trained model.

                  </p>

                </div>

              </div>



              {topFeatures.length === 0 ? (

                <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-slate-500">

                  No native feature-importance signal is available for this

                  model.

                </div>

              ) : (

                <div className="space-y-4">

                  {topFeatures.map((item, index) => {

                    const importance = Number(item?.importance || 0);



                    const maxImportance =



                      Math.abs(Number(topFeatures[0]?.importance)) || 1;



                    const width = Math.max(



                      2,

                      Math.min(

                        100,

                        (Math.abs(importance) / maxImportance) * 100

                      )

                    );



                    return (



                      <div key={`${item?.feature || "feature"}-${index}`}>

                        <div className="flex justify-between gap-4 text-sm mb-1">

                          <span className="font-semibold truncate">

                            {item?.feature || "Unknown feature"}

                          </span>



                          <span className="text-purple-300 shrink-0">

                            {importance.toFixed(4)}

                          </span>

                        </div>



                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">

                          <div

                            className="h-full bg-purple-400 rounded-full"

                            style={{ width: `${width}%` }}

                          />

                        </div>

                      </div>

                    );

                  })}

                </div>

              )}

            </section>





            <section className="mt-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-7">



              <div className="flex items-start gap-3">

                <FaInfoCircle className="text-cyan-300 mt-1" />

                <div>

                  <h3 className="font-black">Prediction guidance</h3>

                  <p className="text-sm text-slate-500 mt-1">

                    Auto Prediction uses representative feature defaults from

                    the training pipeline. It is useful for a quick sanity

                    check, not as a substitute for real business input data.

                  </p>

                </div>

              </div>

            </section>





            <div className="mt-6 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-purple-500/10 border border-cyan-500/20 rounded-3xl p-6">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div>

                  <p className="text-xs font-black tracking-wider text-cyan-300">

                    NEXUSDS MODEL WORKFLOW

                  </p>

                  <h3 className="text-xl font-black mt-1">

                    Train → Predict → Explain → Batch Predict

                  </h3>

                  <p className="text-sm text-slate-500 mt-1">

                    Continue with Batch Prediction when you need predictions

                    for an entire CSV.

                  </p>

                </div>



                <div className="flex flex-wrap gap-2">

                  <button

                    type="button"

                    onClick={() => navigate("/batch-prediction")}

                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-3 rounded-xl font-bold transition"

                  >

                    Batch Prediction

                  </button>



                  <button

                    type="button"

                    onClick={() => navigate("/agents/ml-training")}

                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-3 rounded-xl font-black transition"

                  >

                    Train Another Model

                  </button>

                </div>

              </div>

            </div>

          </>

        )}

      </div>

    </div>

  );

}



export default PredictionStudio;
