import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <section className="max-w-lg w-full text-center rounded-2xl border border-white/10 bg-slate-900 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">NexusDS AI</p>
        <h1 className="mt-4 text-7xl font-black">404</h1>
        <h2 className="mt-3 text-2xl font-bold">Page not found</h2>
        <p className="mt-3 text-slate-400">This page may have moved or the URL may be incorrect.</p>
        <Link to="/" className="inline-flex mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300 transition">
          Back to Home
        </Link>
      </section>
    </main>
  );
}
