// Error handling terpusat v2 — #99 fix: satu sumber kebenaran.
//  - [AUTH]  → 401/403 (dari middleware/auth.ts)
//  - [BIZ]   → 400/409 (business error, konvensi #87)
//  - Prisma P2025/P2002/P2003 → 404/409 (bukan 500 liar, #startup-audit R5)
//  - lainnya → 500 (tanpa bocor stack di production)
import { Prisma } from "@prisma/client";
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
    // hormati status custom (mis. 404 not-found) bila di-set service
    const status = (e as Error & { status?: number }).status ?? 400;
    return { status, body: { error: msg.replace("[BIZ]", "").trim() } };
  }
  // #startup-audit R5: error Prisma yang umum → status HTTP yang benar,
  // bukan 500 (P2025 = record tidak ditemukan saat update/delete; P2002 =
  // constraint unik; P2003 = FK masih direferensikan).
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025")
      return { status: 404, body: { error: "Data tidak ditemukan" } };
    if (e.code === "P2002")
      return { status: 409, body: { error: "Data sudah ada (duplikat)" } };
    if (e.code === "P2003")
      return { status: 409, body: { error: "Data masih dipakai data lain" } };
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
