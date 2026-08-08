// Auth service v2 — #96: refresh token rotation (httpOnly cookie) + access 8h.
// Refresh token: random 48-hex, disimpan HASH (sha256) di DB → leak DB ≠ bisa pakai token.
import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";
import { prisma } from "../db";
import { config } from "../config/env";
import type { User } from "@prisma/client";

const secretKey = new TextEncoder().encode(config.JWT_SECRET);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** refresh token expiry dalam ms (untuk Max-Age cookie) */
  refreshMaxAgeMs: number;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function parseDuration(d: string): number {
  // "7d" → ms, "8h" → ms, "15m" → ms
  const m = /^(\d+)([smhd])$/.exec(d);
  if (!m) return 60_000;
  const n = Number(m[1]);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as string]!;
  return n * mult;
}

async function signAccess(user: Pick<User, "id" | "name" | "role">): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(secretKey);
}

/** Buat access + refresh token, simpan refresh (hash) ke DB. */
export async function issueTokens(user: Pick<User, "id" | "name" | "role">): Promise<AuthTokens> {
  const accessToken = await signAccess(user);
  const refreshToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + parseDuration(config.JWT_REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: { tokenHash: sha256(refreshToken), userId: user.id, expiresAt },
  });
  return { accessToken, refreshToken, refreshMaxAgeMs: parseDuration(config.JWT_REFRESH_EXPIRES_IN) };
}

export interface LoginResult {
  user: Pick<User, "id" | "name" | "username" | "role">;
  tokens: AuthTokens;
}

/** Login: validasi kredensial → access + refresh. */
export async function loginUser(username: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) throw new Error("[BIZ] Kredensial salah");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("[BIZ] Kredensial salah");
  const tokens = await issueTokens(user);
  return {
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
    tokens,
  };
}

export interface RefreshResult {
  user: Pick<User, "id" | "name" | "username" | "role">;
  tokens: AuthTokens;
}

/** Rotasi refresh token: validasi lama → revoke → issue pasangan baru. */
export async function rotateRefreshToken(refreshToken: string): Promise<RefreshResult> {
  if (!refreshToken) throw new Error("[AUTH] Refresh token tidak ada");
  const hash = sha256(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!stored || stored.revokedAt) throw new Error("[AUTH] Refresh token tidak valid");
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    throw new Error("[AUTH] Refresh token kedaluwarsa");
  }
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) throw new Error("[AUTH] User tidak aktif");

  // revoke token lama (rotation — reuse detection). Atomic: updateMany dengan
  // kondisi revokedAt null — hanya SATU request yang menang; request kedua
  // dengan token sama = reuse attack → ditolak (#startup-audit R7).
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count !== 1) throw new Error("[AUTH] Refresh token sudah dipakai");
  const tokens = await issueTokens(user);
  return {
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
    tokens,
  };
}

/** Logout: revoke refresh token (kalau ada). */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  const hash = sha256(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke semua refresh token milik user (force logout semua device). */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Verify access token — dipakai requireAuth di middleware/auth.ts? Tidak: middleware
 *  verifikasi sendiri. Helper ini untuk route yang butuh payload ekstra. */
export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

/** Bersihkan refresh token expired (panggil berkala). */
/** Ganti password milik sendiri (self-service #93). Validasi old password, hash baru, revoke semua refresh token. */
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("[BIZ] Password baru minimal 8 karakter");
  }
  if (oldPassword === newPassword) {
    throw new Error("[BIZ] Password baru harus berbeda dari yang lama");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("[AUTH] User tidak ditemukan");
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) throw new Error("[BIZ] Password lama salah");
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  // logout semua perangkat lain setelah ganti password
  await revokeAllUserTokens(userId);
}

export async function cleanupExpiredTokens(): Promise<number> {
  const r = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return r.count;
}
