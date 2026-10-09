import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  // User not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // User logged in
  return children;
}

export default ProtectedRoute;