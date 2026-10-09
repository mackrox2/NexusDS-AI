import Navbar from "../components/Navbar/Navbar";
import Hero from "../components/Hero/Hero";
import Features from "../components/Features/Features";
import DashboardPreview from "../components/Dashboard/Dashboard";
import AgentsPreview from "../components/Agents/Agents";

function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      <Navbar />

      <main>
        <section id="hero">
          <Hero />
        </section>

        <section id="features">
          <Features />
        </section>

        <section id="platform-preview">
          <DashboardPreview />
        </section>

        <section id="agents-preview">
          <AgentsPreview />
        </section>
      </main>
    </div>
  );
}

export default Home;
