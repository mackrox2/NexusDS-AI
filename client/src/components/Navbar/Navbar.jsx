import { useCallback, useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaRobot,
  FaHome,
  FaDatabase,
  FaChartLine,
  FaFilePdf,
  FaTachometerAlt,
  FaSignOutAlt,
  FaUser,
  FaComments,
} from "react-icons/fa";
import { HiOutlineMenuAlt3, HiOutlineX } from "react-icons/hi";

const navItems = [
  { to: "/", label: "Home", icon: FaHome, end: true, public: true },
  { to: "/dashboard", label: "Dashboard", icon: FaTachometerAlt },
  { to: "/dataset", label: "Datasets", icon: FaDatabase },
  { to: "/agents", label: "AI Agents", icon: FaRobot },
  { to: "/analytics", label: "Analytics", icon: FaChartLine },
  { to: "/reports", label: "Reports", icon: FaFilePdf },
  { to: "/ai-chat", label: "AI Chat", icon: FaComments },
];

function readStoredUser() {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const syncAuth = useCallback(() => {
    setToken(localStorage.getItem("token"));
    setUser(readStoredUser());
  }, []);

  useEffect(() => {
    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("nexus-auth-changed", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("nexus-auth-changed", syncAuth);
    };
  }, [syncAuth]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDatasetId");
    localStorage.removeItem("selectedDatasetName");
    localStorage.removeItem("datasetPath");

    setToken(null);
    setUser(null);
    setMenuOpen(false);
    window.dispatchEvent(new Event("nexus-auth-changed"));
    navigate("/login", { replace: true });
  };

  const visibleItems = token
    ? navItems
    : navItems.filter((item) => item.public);

  const navClass = ({ isActive }) =>
    `group relative inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
      isActive
        ? "bg-cyan-400/10 text-cyan-300"
        : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
    }`;

  const mobileNavClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
      isActive
        ? "border border-cyan-400/15 bg-cyan-400/10 text-cyan-300"
        : "border border-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white"
    }`;

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#080d18]/90 shadow-lg shadow-black/10 backdrop-blur-2xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 xl:px-8">
        <div className="flex h-[72px] items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            aria-label="NexusDS AI home"
            className="group flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-cyan-200/20 bg-gradient-to-br from-cyan-300 to-cyan-600 shadow-lg shadow-cyan-500/15 transition-transform duration-200 group-hover:scale-[1.04]">
              <FaRobot className="text-lg text-slate-950" />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#080d18] bg-emerald-400" />
            </div>

            <div className="hidden leading-tight sm:block">
              <span className="block text-lg font-extrabold tracking-tight text-white">
                NexusDS <span className="text-cyan-300">AI</span>
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Intelligent Data Workspace
              </span>
            </div>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-1 xl:flex">
            {visibleItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                {({ isActive }) => (
                  <>
                    <Icon className="text-[13px]" aria-hidden="true" />
                    <span>{label}</span>
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-cyan-300" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Account actions */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            {token ? (
              <>
                <div className="flex max-w-[180px] items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.08]">
                    <FaUser className="text-xs text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Workspace
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-200">
                      {user?.name || user?.email || "My account"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3.5 py-2.5 text-sm font-semibold text-rose-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                >
                  <FaSignOutAlt className="text-xs" aria-hidden="true" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="nexus-mobile-navigation"
            onClick={() => setMenuOpen((previous) => !previous)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.08] hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 xl:hidden"
          >
            {menuOpen ? (
              <HiOutlineX className="text-xl" aria-hidden="true" />
            ) : (
              <HiOutlineMenuAlt3 className="text-xl" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile navigation */}
        {menuOpen && (
          <div id="nexus-mobile-navigation" className="border-t border-white/[0.08] py-3 xl:hidden">
            <div className="grid gap-1 rounded-2xl border border-white/[0.08] bg-[#0d1422] p-2 shadow-2xl shadow-black/30">
              {visibleItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={mobileNavClass}
                >
                  <Icon className="text-sm" aria-hidden="true" />
                  {label}
                </NavLink>
              ))}

              <div className="mt-2 border-t border-white/[0.08] pt-3">
                {token ? (
                  <div className="flex items-center gap-3 p-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08]">
                      <FaUser className="text-xs text-cyan-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Signed in as
                      </p>
                      <p className="truncate text-sm font-semibold text-slate-200">
                        {user?.name || user?.email || "My account"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                    >
                      <FaSignOutAlt aria-hidden="true" />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-1">
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-white/[0.05]"
                    >
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl bg-cyan-300 px-4 py-3 text-center text-sm font-bold text-slate-950 hover:bg-cyan-200"
                    >
                      Get started
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;