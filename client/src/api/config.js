const PRODUCTION_API_BASE_URL = "https://nexusds-ai.onrender.com";

const configuredBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
  configuredBaseUrl || PRODUCTION_API_BASE_URL
).replace(/\/+$/, "");

export function apiUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export default API_BASE_URL;