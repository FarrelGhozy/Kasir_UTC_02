// Unit test #95 — RBAC: semua route bisnis butuh auth, admin-only untuk backup.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASS = "qa-rbac-pass-2026!";
const BASE = "http://localhost:5300/api/v2";

async function login(username: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASS }),
  });
  const json = (await res.json()) as { token?: string };
  return json.token ?? "";
}

let adminToken = "";
let kasirToken = "";
let teknisiToken = "";

beforeAll(async () => {
  const hash = await bcrypt.hash(PASS, 10);
  const mk = (username: string, role: "admin" | "kasir" | "teknisi") =>
    prisma.user.upsert({
      where: { username },
      update: { passwordHash: hash, role, isActive: true },
      create: { name: `QA ${role}`, username, passwordHash: hash, role },
    });
  await Promise.all([mk("qa_admin", "admin"), mk("qa_kasir", "kasir"), mk("qa_teknisi", "teknisi")]);
  adminToken = await login("qa_admin");
  kasirToken = await login("qa_kasir");
  teknisiToken = await login("qa_teknisi");
});

afterAll(async () => {
  // JANGAN hapus user qa_* — akun QA dipakai bersama lintas test (#95-#101).
  await prisma.$disconnect();
});

async function status(path: string, token?: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.status;
}

describe("#95 RBAC — tanpa token ditolak", () => {
  test("GET /transactions tanpa token → 401", async () => {
    expect(await status("/transactions")).toBe(401);
  });
  test("GET /backup/summary tanpa token → 401", async () => {
    expect(await status("/backup/summary")).toBe(401);
  });
  test("GET /reports/revenue tanpa token → 401", async () => {
    expect(await status("/reports/revenue")).toBe(401);
  });
});

describe("#95 RBAC — admin-only untuk backup", () => {
  test("admin → /backup/summary → 200", async () => {
    expect(await status("/backup/summary", adminToken)).toBe(200);
  });
  test("kasir → /backup/summary → 403", async () => {
    expect(await status("/backup/summary", kasirToken)).toBe(403);
  });
  test("teknisi → /backup/summary → 403", async () => {
    expect(await status("/backup/summary", teknisiToken)).toBe(403);
  });
});

describe("#95 RBAC — role lain boleh akses transaksi & revenue", () => {
  test("kasir → /transactions → 200", async () => {
    expect(await status("/transactions", kasirToken)).toBe(200);
  });
  test("admin → /transactions → 200", async () => {
    expect(await status("/transactions", adminToken)).toBe(200);
  });
  test("teknisi → /reports/revenue → 200", async () => {
    expect(await status("/reports/revenue", teknisiToken)).toBe(200);
  });
  test("token invalid → 401", async () => {
    expect(await status("/transactions", "token-salah-abc")).toBe(401);
  });
});
