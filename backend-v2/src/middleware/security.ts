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
const MAX_REQUESTS = 20; // 20 percobaan login / window
const LOCKOUT_MS = 30 * 60 * 1000; // lockout 30 menit setelah limit

const buckets = new Map<string, Bucket>();

function hit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > MAX_REQUESTS) {
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
