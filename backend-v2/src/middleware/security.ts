// Hardening #91 — security headers (M6) + rate limit login (SEC-6)
import { Elysia } from "elysia";

// ── M6: Security headers (pengganti helmet, ringan & eksplisit) ──────────────
// Catatan: di Elysia, hook harus ke instance app (bukan plugin tanpa route) —
// jadi di index.ts gunakan `[...SECURITY_HEADERS entries]` langsung di onAfterHandle.
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-XSS-Protection": "0", // deprecated; diset 0 karena modern browser via CSP
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "no-store", // API responses tidak boleh di-cache (token/nota)
};

// ── SEC-6: Rate limiter in-memory (per-IP + per-username, lockout) ───────────
// Sederhana & tanpa dependensi; cukup untuk single-instance v2.
// (Untuk multi-instance nanti: pindah ke Redis — dicatat di #94 epic)
// Catatan: dipanggil langsung di handler login (bukan hook plugin) karena
// di Elysia hook dari plugin tanpa route tidak ter-register ke parent.
interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 menit
// Limit login per window — konfigurable via env (dev/test butuh lebih longgar utk
// regresi paralel; produksi default 20 tetap ketat — SEC-6)
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? 20);
const LOCKOUT_MS = 30 * 60 * 1000; // lockout 30 menit setelah limit
// #113: limit operasi admin sensitif (backup save/restore/delete, import CSV)
// per-IP per window — default 30; produksi via compose diset 100.
const ADMIN_OPS_MAX = Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 30);

const buckets = new Map<string, Bucket>();

function hit(key: string, max: number = MAX_REQUESTS): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > max) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

// Cleanup berkala biar map tidak membengkak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}, LOCKOUT_MS).unref?.();

/**
 * Rate limit generik #113 — untuk endpoint sensitif non-login (backup ops, import).
 * key = prefix namespace + IP; IP diambil dari x-real-ip / cf-connecting-ip
 * (trust proxy dimatikan — spoof X-Forwarded-For tidak efektif).
 */
export function checkRateLimit(
  request: Request,
  namespace: string,
  max = ADMIN_OPS_MAX
): { allowed: boolean; retryAfterSec: number } {
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  return hit(`${namespace}:${ip}`, max);
}

/** Rate limit untuk login: key = IP + username (spoof X-Forwarded-For tidak efektif) */
export function checkLoginRateLimit(
  request: Request,
  username: string
): { allowed: boolean; retryAfterSec: number } {
  // IP dari socket langsung (trust proxy dimatikan — SEC-6); x-real-ip di-set nginx
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  return hit(`${ip}:${username}`);
}
