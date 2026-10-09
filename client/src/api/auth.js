
import axios from "axios";
import { API_BASE_URL } from "./config";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default API;
