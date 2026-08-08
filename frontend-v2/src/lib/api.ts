import axios from "axios";
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

// Axios instance — baseURL via Vite proxy (dev) / nginx (prod)
export const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: true, // kirim refresh-token cookie (HttpOnly) saat /auth/refresh & /auth/logout
});

// Access token disimpan DI MEMORY (bukan localStorage) — rawan XSS dicegah.
// Refresh token hidup di httpOnly cookie, di-refresh otomatis di bawah ini.
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken(): string | null {
  return accessToken;
}

// Request: attach token dari memory
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** Panggil /auth/refresh (cookie httpOnly otomatis terkirim), simpan access baru. */
async function doRefresh(): Promise<string> {
  const { data } = await axios.post(
    "/api/v2/auth/refresh",
    {},
    { withCredentials: true }
  );
  if (!data?.token) throw new Error("Refresh gagal");
  accessToken = data.token as string;
  return accessToken;
}

/** Debounce refresh — banyak 401 paralel cuma refresh sekali. */
function refreshToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh()
      .catch((e) => {
        accessToken = null;
        throw e;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Response: 401 → coba refresh sekali → retry request asli
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    // Jangan retry endpoint auth itu sendiri
    const isAuthUrl = original?.url?.includes("/auth/") ?? false;

    if (error.response?.status === 401 && original && !original._retried && !isAuthUrl) {
      try {
        await refreshToken();
        original._retried = true;
        original.headers = { ...(original.headers ?? {}) };
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // refresh gagal → interceptor akan redirect login
      }
    }

    // Token tidak bisa dipulihkan
    if (error.response?.status === 401) {
      accessToken = null;
      // #startup-ux: JANGAN redirect paksa saat yang gagal endpoint auth/refresh —
      // 401 di sana bisa karena race rotation refresh paralel (StrictMode) atau
      // cookie kedaluwarsa; sesi yang valid tetap harus bisa pulih (RequireAuth
      // yang memutuskan redirect saat bootstrapping selesai).
      if (!isAuthUrl && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Bootstrap sesi (single-flight) ─────────────────────────────────────────
// Dipanggil AuthProvider saat boot. StrictMode menjalankan effect 2× → tanpa
// single-flight, dua refresh paralel dengan cookie SAMA akan bertabrakan dengan
// rotasi anti-reuse (R7): hanya satu yang menang, satunya 401 → sesi gagal pulih.
let bootstrapPromise: Promise<{ token: string; user: unknown } | null> | null = null;

export function bootstrapSession(): Promise<{ token: string; user: unknown } | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = axios
      .post("/api/v2/auth/refresh", {}, { withCredentials: true })
      .then((r) => ({ token: r.data.token as string, user: r.data.user }))
      .catch(() => null)
      .finally(() => {
        bootstrapPromise = null;
      });
  }
  return bootstrapPromise;
}

export default api;