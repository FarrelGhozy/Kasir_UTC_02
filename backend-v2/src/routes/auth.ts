// Route auth v2 — #96: access 8h + refresh token httpOnly cookie (rotation).
// Token TIDAK lagi di localStorage; refresh token hanya hidup di cookie HttpOnly.
import { Elysia, t, type HTTPHeaders } from "elysia";
import { config } from "../config/env";
import { checkLoginRateLimit } from "../middleware/security";
import { mapError } from "../middleware/error";
import { authenticate } from "../middleware/auth";
import {
  loginUser,
  rotateRefreshToken,
  revokeRefreshToken,
  changePassword,
} from "../services/authService";

const REFRESH_COOKIE = "utc_refresh";

/** Set cookie refresh token: HttpOnly + SameSite=Lax + Secure HANYA kalau request HTTPS.
 *  (NODE_ENV=production di docker ≠ HTTPS — jangan paksa Secure di HTTP, cookie bakal ditolak browser) */
function setRefreshCookie(
  set: { headers: HTTPHeaders },
  token: string,
  maxAgeMs: number,
  isHttps: boolean
) {
  const parts = [
    `${REFRESH_COOKIE}=${token}`,
    "Path=/api/v2/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isHttps) parts.push("Secure");
  set.headers["Set-Cookie"] = parts.join("; ");
}

/** Hapus cookie refresh (logout). */
function clearRefreshCookie(set: { headers: HTTPHeaders }) {
  set.headers["Set-Cookie"] = `${REFRESH_COOKIE}=; Path=/api/v2/auth; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getRefreshToken(headers: Record<string, string | undefined>): string {
  const cookie = headers.cookie || "";
  const m = new RegExp(`${REFRESH_COOKIE}=([^;]+)`).exec(cookie);
  return m ? decodeURIComponent(m[1]!) : "";
}

export const authRouter = new Elysia({ prefix: "/api/v2/auth" })
  .post(
    "/login",
    async ({ body, set, request }) => {
      // SEC-6: rate limit per IP+username — cek SEBELUM bcrypt (hemat CPU & blokir brute)
      const rl = checkLoginRateLimit(request, body.username);
      if (!rl.allowed) {
        set.status = 429;
        set.headers["Retry-After"] = String(rl.retryAfterSec);
        return { error: "Terlalu banyak percobaan login. Coba lagi nanti.", retryAfterSec: rl.retryAfterSec };
      }
      try {
        const { user, tokens } = await loginUser(body.username, body.password);
        setRefreshCookie(set, tokens.refreshToken, tokens.refreshMaxAgeMs, request.url.startsWith("https"));
        return { token: tokens.accessToken, user };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { error: r.body.error };
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
      tags: ["Auth"],
    }
  )
  // Refresh token rotation — baca cookie, bukan body (XSS-proof)
  .post(
    "/refresh",
    async ({ headers, set, request }) => {
      try {
        const rt = getRefreshToken(headers);
        if (!rt) {
          set.status = 401;
          return { error: "Refresh token tidak ada" };
        }
        const { user, tokens } = await rotateRefreshToken(rt);
        setRefreshCookie(set, tokens.refreshToken, tokens.refreshMaxAgeMs, request.url.startsWith("https"));
        return { token: tokens.accessToken, user };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { error: r.body.error };
      }
    },
    { tags: ["Auth"] }
  )
  // Logout: revoke refresh token + hapus cookie
  .post(
    "/logout",
    async ({ headers, set }) => {
      try {
        await revokeRefreshToken(getRefreshToken(headers));
        clearRefreshCookie(set);
        return { success: true };
      } catch {
        clearRefreshCookie(set);
        return { success: true };
      }
    },
    { tags: ["Auth"] }
  )
  .get("/me", async ({ headers, set }) => {
    const user = await authenticate(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return user;
  })
  // Ganti password milik sendiri (self-service #93)
  .post(
    "/change-password",
    async ({ headers, set, body }) => {
      try {
        const user = await authenticate(headers);
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        await changePassword(user.id, body.oldPassword, body.newPassword);
        return { success: true };
      } catch (e: any) {
        const r = mapError(e);
        set.status = r.status;
        return r.body;
      }
    },
    {
      body: t.Object({
        oldPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 6 }),
      }),
      tags: ["Auth"],
    }
  );
