// Auth v2 — #95 fix: RBAC di semua route.
// Pakai jose langsung (bukan plugin jwt) + dipanggil di handler (pola terbukti #91),
// supaya tidak kena quirk Elysia (hook plugin tanpa route tidak ter-register).
import { jwtVerify } from "jose";
import { config } from "../config/env";
import { prisma } from "../db";

export type Role = "admin" | "kasir" | "teknisi";

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
}

const secretKey = new TextEncoder().encode(config.JWT_SECRET);

/** Headers yang diterima handler Elysia: object key→value (bukan `Headers` web). */
export type IncomingHeaders = Record<string, string | undefined>;

function getAuthToken(headers: IncomingHeaders): string {
  const auth = headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : auth;
}

/** Verifikasi token + cek user aktif ke DB (SEC-5). Return null kalau tidak valid. */
export async function authenticate(headers: IncomingHeaders): Promise<AuthUser | null> {
  const token = getAuthToken(headers);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return user as AuthUser;
  } catch {
    return null;
  }
}

/** Result helper: `{ user }` sukses, atau `{ status, body }` gagal (401/403). */
export type AuthResult =
  | { user: AuthUser }
  | { status: number; body: { error: string } };

/**
 * Cek auth + role dalam satu panggilan (untuk handler).
 * Roles kosong/undefined = cukup login (semua role).
 */
export async function checkAuth(
  headers: IncomingHeaders,
  roles?: Role[]
): Promise<AuthResult> {
  const user = await authenticate(headers);
  if (!user) return { status: 401, body: { error: "Unauthorized" } };
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return { status: 403, body: { error: "Forbidden: akses khusus " + roles.join("/") } };
  }
  return { user };
}

/** Versi throw untuk dipakai dalam try/catch — error [AUTH] di-map ke 401/403. */
export async function requireAuth(
  headers: IncomingHeaders,
  roles?: Role[]
): Promise<AuthUser> {
  const r = await checkAuth(headers, roles);
  if ("status" in r) {
    const e = new Error(`[AUTH] ${r.body.error}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return r.user;
}