import { config } from "../config/env";

// Error handler terpusat — TIDAK bocor stack trace ke client (SEC info disclosure fix)
// Gunakan tipe handler dari Elysia via inference (code, error, set, request)
export const errorHandler = ({ code, error, set, request }: any) => {
  const isProd = config.NODE_ENV === "production";
  // Log penuh ke server console
  console.error(
    `[${new Date().toISOString()}] [ERROR:${code}] ${request?.method} ${request?.url}`,
    error?.message
  );
  if (!isProd && error?.stack) console.error(error.stack);

  if (code === "VALIDATION") {
    set.status = 400;
    return { error: "Validasi gagal", message: error?.message };
  }
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "Not Found" };
  }
  set.status = 500;
  return {
    error: "Internal Server Error",
    message: isProd
      ? "Terjadi kesalahan pada server. Silakan coba lagi."
      : error?.message,
  };
};