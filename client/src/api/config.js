
/**
 * NexusDS AI — Central API Configuration
 *
 * Local development:
 *   Defaults to http://127.0.0.1:8000
 *
 * Production:
 *   Set VITE_API_BASE_URL to the deployed backend URL.
 *   Example: https://your-backend.onrender.com
 */

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredBaseUrl || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export function apiUrl(path = "") {
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

export default API_BASE_URL;
