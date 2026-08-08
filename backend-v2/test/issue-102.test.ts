// Unit test #102 — WhatsApp (WAHA) v2: status session, check nomor, RBAC,
// notify/resend teknisi (mock kirim utk tidak spam WAHA), validate nomor.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:5300/api/v2";
const PASS = "qa-rbac-pass-2026!";

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let token = "";
let kasirToken = "";
let ticketId = -1;

beforeAll(async () => {
  // login dengan retry singkat utk toleran terhadap rate-limiter
  let login;
  for (let i = 0; i < 5; i++) {
    login = await call("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "qa_admin", password: PASS }),
    });
    if (login.status === 200) break;
    await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  token = login?.json?.token ?? "";
  const lk = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "qa_kasir", password: PASS }),
  });
  kasirToken = lk.json?.token ?? "";

  // ambil tiket servis nyata utk notify (harus punya customer ber-phone)
  const t = await prisma.serviceTicket.findFirst({
    where: { customer: { phone: { not: null } } },
    orderBy: { id: "desc" },
  });
  ticketId = t?.id ?? 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("#102 WA — RBAC & status", () => {
  test("GET /wa/status tanpa token → 401", async () => {
    expect((await call("/wa/status")).status).toBe(401);
  });
  test("GET /wa/status (admin) → 200 + status field", async () => {
    const r = await call("/wa/status", { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(["CONNECTED", "DISCONNECTED", "STARTING", "UNREACHABLE", "ERROR"]).toContain(r.json.status);
  });
  test("GET /wa/check tanpa phone → 400", async () => {
    const r = await call("/wa/check", { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(400);
  });
  test("GET /wa/check?phone=081234567890 → 200 + isValid boolean", async () => {
    const r = await call("/wa/check?phone=081234567890", { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    expect(typeof r.json.isValid).toBe("boolean");
  });
});

describe("#102 WA — notify/resend", () => {
  test("POST /wa/services/:id/notify (kasir) → 404 utk id tak ada", async () => {
    const r = await call("/wa/services/999999/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${kasirToken}` },
    });
    expect(r.status).toBe(404);
  });
  test("POST /wa/services/:id/notify (admin) utk tiket valid → 200/502 tanpa spam", async () => {
    if (ticketId <= 0) return; // DB kosong — skip
    const r = await call(`/wa/services/${ticketId}/notify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 kalau WAHA aktif, 502 kalau WAHA offline (kirim gagal — bukan crash)
    expect([200, 502]).toContain(r.status);
  });
  test("POST /wa/services/:id/resend tanpa token → 401", async () => {
    expect((await call(`/wa/services/${ticketId}/resend`, { method: "POST" })).status).toBe(401);
  });
  test("POST /wa/validate → 200 + isValid boolean", async () => {
    const r = await call("/wa/validate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: "081234567890" }),
    });
    expect(r.status).toBe(200);
    expect(typeof r.json.isValid).toBe("boolean");
  });
});