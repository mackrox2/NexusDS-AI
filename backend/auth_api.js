import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://nexusds-ai.onrender.com/api").replace(/\/$/, "");

const API = axios.create({ baseURL: API_BASE_URL, timeout: 120000, headers: { Accept: "application/json" } });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    const url = String(error.config?.url || "");
    const authRequest = ["/login", "/register", "/verify-email", "/resend-otp", "/forgot-password", "/reset-password"].some((path) => url.includes(path));
    if (!authRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");
      localStorage.removeItem("datasetPath");
    }
  }
  return Promise.reject(error);
});

export default API;
