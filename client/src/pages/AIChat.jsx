
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar/Navbar";
import DatasetAPI from "../api/dataset";

const SUGGESTIONS = [
  "How many rows and columns are there?",
  "What are the most important findings?",
  "Which columns contain missing values?",
  "Explain the numerical columns.",
];

function AIChat() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadDatasets() {
      setLoadingDatasets(true);
      setError("");

      try {
        const response = await DatasetAPI.get("/datasets");
        const list = response.data?.datasets || [];

        if (!active) return;

        setDatasets(list);

        const savedId = localStorage.getItem("selectedDatasetId");
        const validSavedDataset = list.find(
          (item) => item.id === savedId
        );

        const nextId = validSavedDataset?.id || list[0]?.id || "";

        setDatasetId(nextId);

        if (nextId) {
          localStorage.setItem("selectedDatasetId", nextId);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.detail ||
              err.response?.data?.message ||
              "Could not load your datasets. Please sign in again or retry."
          );
        }
      } finally {
        if (active) setLoadingDatasets(false);
      }
    }

    loadDatasets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  const handleDatasetChange = (event) => {
    const nextId = event.target.value;
    setDatasetId(nextId);

    if (nextId) {
      localStorage.setItem("selectedDatasetId", nextId);
    }

    setMessages([]);
    setError("");
  };

  const sendMessage = async (event) => {
    event?.preventDefault();

    const userQuestion = question.trim();

    if (!userQuestion || loading) return;

    if (!datasetId) {
      setError("Please upload and select a dataset first.");
      return;
    }

    setError("");
    setQuestion("");

    setMessages((previous) => [
      ...previous,
      { type: "user", text: userQuestion },
    ]);

    setLoading(true);

    try {
      const response = await DatasetAPI.post("/chat", {
        datasetId,
        question: userQuestion,
      });

      const answer =
        response.data?.answer ||
        "The AI returned an empty answer. Please try another question.";

      setMessages((previous) => [
        ...previous,
        { type: "ai", text: answer },
      ]);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "I couldn't analyze this dataset. Please try again.";

      setMessages((previous) => [
        ...previous,
        { type: "error", text: detail },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const selectedDataset = datasets.find(
    (item) => item.id === datasetId
  );

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-[#080d18] px-4 pb-10 pt-28 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-semibold text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              AI-POWERED DATA ANALYSIS
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Chat with{" "}
              <span className="text-cyan-300">your data.</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Ask questions about your uploaded dataset and explore
              its contents using NexusDS AI.
            </p>
          </motion.header>

          <section className="overflow-hidden rounded-3xl border border-slate-700/70 bg-[#101827] shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 border-b border-slate-700/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl">
                  ✦
                </div>

                <div>
                  <h2 className="font-bold">NexusDS AI Assistant</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {loading
                      ? "Analyzing your question..."
                      : "Dataset-aware assistant"}
                  </p>
                </div>
              </div>

              <div className="w-full sm:max-w-xs">
                <label
                  htmlFor="chat-dataset"
                  className="mb-1.5 block text-xs font-semibold text-slate-400"
                >
                  SELECT DATASET
                </label>

                <select
                  id="chat-dataset"
                  value={datasetId}
                  onChange={handleDatasetChange}
                  disabled={loadingDatasets || loading || datasets.length === 0}
                  className="w-full rounded-xl border border-slate-700 bg-[#080d18] px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 disabled:opacity-60"
                >
                  <option value="">
                    {loadingDatasets
                      ? "Loading datasets..."
                      : datasets.length
                        ? "Choose a dataset"
                        : "No datasets available"}
                  </option>

                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.fileName || "Untitled dataset"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedDataset && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-700/50 bg-slate-900/40 px-5 py-3 text-xs text-slate-400">
                <span>
                  <strong className="text-slate-200">
                    {Number(selectedDataset.rows || 0).toLocaleString()}
                  </strong>{" "}
                  rows
                </span>
                <span>
                  <strong className="text-slate-200">
                    {Number(selectedDataset.columns || 0).toLocaleString()}
                  </strong>{" "}
                  columns
                </span>
                <span className="text-emerald-300">
                  ● Dataset selected
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mx-4 mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 sm:mx-6"
              >
                {error}
              </div>
            )}

            <div
              aria-live="polite"
              className="h-[420px] space-y-5 overflow-y-auto p-4 sm:h-[500px] sm:p-6"
            >
              {messages.length === 0 && (
                <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 text-3xl text-cyan-300">
                    ✦
                  </div>

                  <h3 className="text-xl font-bold">
                    What would you like to discover?
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                    Select one of your datasets, then ask a question
                    to get started.
                  </p>

                  <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={!datasetId || loading}
                        onClick={() => setQuestion(suggestion)}
                        className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-left text-sm text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => {
                const isUser = message.type === "user";
                const isError = message.type === "error";

                return (
                  <div
                    key={`${index}-${message.type}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[82%] sm:px-5 ${
                        isUser
                          ? "rounded-br-md bg-cyan-300 text-slate-950"
                          : isError
                            ? "rounded-bl-md border border-rose-400/20 bg-rose-400/10 text-rose-200"
                            : "rounded-bl-md border border-slate-700 bg-slate-900 text-slate-200"
                      }`}
                    >
                      <div
                        className={`mb-2 text-xs font-bold ${
                          isUser
                            ? "text-slate-700"
                            : isError
                              ? "text-rose-300"
                              : "text-cyan-300"
                        }`}
                      >
                        {isUser
                          ? "YOU"
                          : isError
                            ? "REQUEST ERROR"
                            : "NEXUSDS AI"}
                      </div>

                      <p className="whitespace-pre-wrap break-words text-sm leading-7">
                        {message.text}
                      </p>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-cyan-300">
                    <span className="animate-pulse">
                      NexusDS AI is analyzing your dataset...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="border-t border-slate-700/70 bg-[#0c1320] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    datasetId
                      ? "Ask a question about your dataset..."
                      : "Select a dataset to start chatting"
                  }
                  disabled={!datasetId || loadingDatasets || loading}
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#101827] px-4 py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={
                    !datasetId ||
                    !question.trim() ||
                    loading ||
                    loadingDatasets
                  }
                  className="rounded-xl bg-cyan-300 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Thinking..." : "Send question →"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Enter to send · Questions are limited to 2,000 characters.</span>
                <span>{question.length}/2000</span>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

export default AIChat;
