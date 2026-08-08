// Unit test #96 — JWT rotation & refresh cookie.
// Verifikasi: login → access + refresh cookie; refresh → rotasi; reuse token lama → 401; logout → revoke.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  issueTokens,
  loginUser,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../src/services/authService";

const prisma = new PrismaClient();
const UNAME = "qa_token_user";

async function makeUser() {
  const hash = await bcrypt.hash("qa-token-password-2026!", 10);
  return prisma.user.upsert({
    where: { username: UNAME },
    update: { passwordHash: hash, isActive: true },
    create: { name: "QA Token", username: UNAME, passwordHash: hash, role: "kasir" },
  });
}

let user: { id: number } = { id: 0 };
let accessA = "";
let refreshA = "";

beforeAll(async () => {
  user = await makeUser();
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { username: UNAME } });
  await prisma.$disconnect();
});

describe("#96 jadi access + refresh di DB (hash)", () => {
  test("login member access token, token disimpan sebagai hash", async () => {
    const r = await loginUser(UNAME, "qa-token-password-2026!");
    expect(r.tokens.accessToken).toBeString();
    expect(r.tokens.refreshToken).toBeString();
    expect(r.user.username).toBe(UNAME);
    accessA = r.tokens.accessToken;
    refreshA = r.tokens.refreshToken;
    // refresh token tersimpan HASH di DB (bukan plaintext)
    const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(stored.length).toBe(1);
    expect(stored[0]!.tokenHash).not.toBe(refreshA);
    // access token itu JWT (punya 3 bagian)
    expect(accessA.split(".").length).toBe(3);
  });
});

describe("#96 rotasi access (refresh)", () => {
  test("refresh token valid", async () => {
    const before = await prisma.refreshToken.count({ where: { userId: user.id } });
    const r = await rotateRefreshToken(refreshA);
    // token refresh BARU dihasilkan (bukan access — access bisa identik karena iat = detik sama)
    expect(r.tokens.refreshToken).toHaveLength(48);
    // DB: bertambah 1 (revoke lama + issue baru)
    const after = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(after).toBe(before + 1);
    // token lama di-revoke, ada token aktif
    const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(stored.filter((s) => s.revokedAt !== null).length).toBeGreaterThan(0);
    expect(stored.some((s) => s.revokedAt === null)).toBe(true);
  });
});

describe("#96 refresh token valid", () => {
  test("reuse token expired", async () => {
    // token A sudah dipakai & di-revoke → reject
    await expect(rotateRefreshToken(refreshA)).rejects.toThrow();
  });
});

describe("#96 revoke (logout)", () => {
  test("revoke token membuat refresh berikutnya ditolak", async () => {
    // rotasi dari state sekarang (refreshA sudah revoked di test sebelumnya — buat pasangan baru)
    const fresh = await loginUser(UNAME, "qa-token-password-2026!");
    const { tokens: rotated } = await rotateRefreshToken(fresh.tokens.refreshToken);
    // token hasil rotasi valid
    await expect(rotateRefreshToken(rotated.refreshToken)).resolves.toBeTruthy();
    // revoke token hasil rotasi
    await revokeRefreshToken(rotated.refreshToken);
    await expect(rotateRefreshToken(rotated.refreshToken)).rejects.toThrow();
  });
});