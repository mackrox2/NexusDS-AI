import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("NexusDS AI UI error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <section className="max-w-xl w-full rounded-2xl border border-white/10 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">NexusDS AI</p>
            <h1 className="text-2xl font-bold mt-3">Something went wrong</h1>
            <p className="text-slate-400 mt-2">The page encountered an unexpected error. Reload the page and try again.</p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <button type="button" onClick={this.handleReload} className="mt-5 rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950">
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
