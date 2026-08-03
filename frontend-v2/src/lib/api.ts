import axios from "axios";

// Axios instance — baseURL via Vite proxy (dev) / nginx (prod)
export const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

// Interceptor: attach token + handle 401
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("utc_v2_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("utc_v2_token");
      localStorage.removeItem("utc_v2_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;