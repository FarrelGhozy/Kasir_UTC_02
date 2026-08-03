// Error handling terpusat v2 — #99 fix: satu sumber kebenaran.
//  - [AUTH]  → 401/403 (dari middleware/auth.ts)
//  - [BIZ]   → 400/409 (business error, konvensi #87)
//  - lainnya → 500 (tanpa bocor stack di production)
import { config } from "../config/env";

export interface ErrorResponse {
  status: number;
  body: { error: string; [k: string]: unknown };
}

/** Map error → status/body. Panggil di handler tiap route (pola #91/#95). */
export function mapError(e: unknown): ErrorResponse {
  const msg = e instanceof Error ? e.message : "Terjadi kesalahan";

  if (msg.startsWith("[AUTH]")) {
    // status 401/403 dari error yang dilempar requireAuth
    const status = (e as Error & { status?: number }).status ?? 401;
    return { status, body: { error: msg.replace("[AUTH] ", "").trim() } };
  }
  if (msg.startsWith("[BIZ]")) {
    return { status: 400, body: { error: msg.replace("[BIZ]", "").trim() } };
  }
  console.error("[error]", e);
  return {
    status: 500,
    body: {
      error: "Internal Server Error",
      message:
        config.NODE_ENV === "production"
          ? "Terjadi kesalahan pada server. Silakan coba lagi."
          : msg,
    },
  };
}
