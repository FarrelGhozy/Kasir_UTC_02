// Test #90 — validasi tanggal di /reports/revenue (M6/M12): invalid → 400.
import { describe, expect, test, beforeAll } from "bun:test";
const BASE = (globalThis as any).TEST_BASE ?? "http://localhost:5300";

describe("Validasi tanggal revenue #90", () => {
  let token = "";
  beforeAll(async () => {
    const r = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: "qa-rbac-pass-2026!" }),
    });
    token = ((await r.json() as any).token ?? "").toString();
    expect(token).toBeTruthy();
  });

  test("tanggal from invalid → 400", async () => {
    const r = await fetch(`${BASE}/api/v2/reports/revenue?from=notadate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(400);
    const b: any = await r.json();
    expect(b.success).toBe(false);
    expect(String(b.error)).toContain("from");
  });

  test("tanggal to invalid → 400", async () => {
    const r = await fetch(`${BASE}/api/v2/reports/revenue?to=xyz`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(400);
  });

  test("range from > to → 400", async () => {
    const r = await fetch(`${BASE}/api/v2/reports/revenue?from=2026-08-10&to=2026-08-01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(400);
  });

  test("range valid → 200 + data.days", async () => {
    const r = await fetch(`${BASE}/api/v2/reports/revenue?from=2026-08-01&to=2026-08-05`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.success).toBe(true);
    expect(Array.isArray(b.data.days)).toBe(true);
  });
});