
import axios from "axios";
import { API_BASE_URL } from "./config";

const DatasetAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/dataset`,
  timeout: 60000,
});

DatasetAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

DatasetAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("selectedDatasetId");
      localStorage.removeItem("selectedDatasetName");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default DatasetAPI;
