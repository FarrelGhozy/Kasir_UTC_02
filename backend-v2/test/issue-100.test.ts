// Unit test #100 — Jadwal piket (duty-schedules): CRUD + RBAC (admin kelola, semua baca).
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
let targetUserId = 0;

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
  const target = await prisma.user.findUnique({ where: { username: "qa_kasir" } });
  targetUserId = target!.id;
});

afterAll(async () => {
  // JANGAN hapus user qa_* — dipakai lintas test (#95/#96/#97/#100).
  // Hanya bersihkan jadwal piket test.
  await prisma.dutySchedule.deleteMany({ where: { userId: targetUserId } });
  await prisma.$disconnect();
});

async function call(path: string, token: string, method = "GET", body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

describe("RBAC duty-schedules", () => {
  test("GET / tanpa token → 401", async () => {
    const r = await call("/duty-schedules", "");
    expect(r.status).toBe(401);
  });
  test("GET / oleh kasir → 403 (kelola khusus admin)", async () => {
    const r = await call("/duty-schedules", kasirToken);
    expect(r.status).toBe(403);
  });
  test("POST / oleh teknisi → 403", async () => {
    const r = await call("/duty-schedules", teknisiToken, "POST", { userId: targetUserId, day: "senin" });
    expect(r.status).toBe(403);
  });
});

describe("CRUD duty-schedules (admin)", () => {
  test("GET /my oleh kasir → 200 (baca semua role)", async () => {
    const r = await call("/duty-schedules/my", kasirToken);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json?.data)).toBe(true);
  });
  test("GET /today → 200", async () => {
    const r = await call("/duty-schedules/today", kasirToken);
    expect(r.status).toBe(200);
  });
  test("POST create 'senin' → 201 + include user name", async () => {
    const r = await call("/duty-schedules", adminToken, "POST", { userId: targetUserId, day: "senin" });
    expect(r.status).toBe(201);
    expect(r.json?.data?.user?.name).toBe("QA kasir");
    expect(r.json?.data?.day_label).toBe("Senin");
  });
  test("POST duplicate user+day → 400/409", async () => {
    const r = await call("/duty-schedules", adminToken, "POST", { userId: targetUserId, day: "senin" });
    expect([400, 409]).toContain(r.status);
  });
  test("POST hari invalid → 400", async () => {
    const r = await call("/duty-schedules", adminToken, "POST", { userId: targetUserId, day: "minggu" });
    expect(r.status).toBe(400);
  });
  test("PUT ganti hari → 200 + day_label baru", async () => {
    const list = await call("/duty-schedules", adminToken);
    const rec = list.json?.data?.find((x: { user: { id: number } }) => x.user.id === targetUserId);
    expect(rec).toBeTruthy();
    const r = await call(`/duty-schedules/${rec.id}`, adminToken, "PUT", { day: "selasa" });
    expect(r.status).toBe(200);
    expect(r.json?.data?.day_label).toBe("Selasa");
  });
  test("DELETE → 200", async () => {
    const list = await call("/duty-schedules", adminToken);
    const rec = list.json?.data?.find((x: { user: { id: number } }) => x.user.id === targetUserId);
    const r = await call(`/duty-schedules/${rec.id}`, adminToken, "DELETE");
    expect(r.status).toBe(200);
  });
  test("DELETE tidak ada → 400/404", async () => {
    const r = await call("/duty-schedules/999999", adminToken, "DELETE");
    expect([400, 404]).toContain(r.status);
  });
});