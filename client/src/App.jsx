import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Dataset from "./pages/Dataset";
import Agents from "./pages/Agents";
import Reports from "./pages/Reports";
import AIChat from "./pages/AIChat";
import Analytics from "./pages/Analytics";
import DataCleaning from "./pages/DataCleaning";
import Visualization from "./pages/Visualization";
import MLTraining from "./pages/MLTraining";
import PredictionStudio from "./pages/PredictionStudio";
import Explainability from "./pages/Explainability";

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* CORE WORKSPACE */}
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/dataset"
            element={
              <Protected>
                <Dataset />
              </Protected>
            }
          />

          {/* AI AGENTS */}
          <Route
            path="/agents"
            element={
              <Protected>
                <Agents />
              </Protected>
            }
          />
          <Route
            path="/agents/data-cleaning"
            element={
              <Protected>
                <DataCleaning />
              </Protected>
            }
          />
          <Route
            path="/agents/visualization"
            element={
              <Protected>
                <Visualization />
              </Protected>
            }
          />
          <Route
            path="/agents/ml-training"
            element={
              <Protected>
                <MLTraining />
              </Protected>
            }
          />
          <Route
            path="/agents/reports"
            element={
              <Protected>
                <Reports />
              </Protected>
            }
          />
          <Route
            path="/prediction-studio"
            element={
              <Protected>
                <PredictionStudio />
              </Protected>
            }
          />
          <Route
            path="/agents/prediction-studio"
            element={
              <Protected>
                <PredictionStudio />
              </Protected>
            }
          />
          <Route
            path="/explainability"
            element={
              <Protected>
                <Explainability />
              </Protected>
            }
          />

          {/* APPLICATION PAGES */}
          <Route
            path="/analytics"
            element={
              <Protected>
                <Analytics />
              </Protected>
            }
          />
          <Route
            path="/reports"
            element={
              <Protected>
                <Reports />
              </Protected>
            }
          />
          <Route
            path="/ai-chat"
            element={
              <Protected>
                <AIChat />
              </Protected>
            }
          />

          {/* LEGACY COMPATIBILITY */}
          <Route
            path="/data-cleaning"
            element={<Navigate to="/agents/data-cleaning" replace />}
          />

          {/* FALLBACK */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
