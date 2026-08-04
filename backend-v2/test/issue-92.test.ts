// Test user management #92 + listOrder monitoring.
// Pola: bun:test, jalankan tanpa hapus user qa_* di afterAll (shared QA, lihat #95).
import { describe, expect, test, beforeAll } from "bun:test";
import { prisma } from "../src/db";

import { requireAuth } from "../src/middleware/auth";

// Skip file jika env test kredensial tidak ada (CI / non-dev)
const hasCreds = Boolean(Bun.env);

describe("User management API (admin)", () => {
  let token: string;
  let createdId = -1;

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: "qa-rbac-pass-2026!" }),
    });
    const d: any = await res.json();
    expect(res.status).toBe(200);
    token = d.token;
  });

  test("RBAC: kasir ditolak akses /users (403)", async () => {
    const lr = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_kasir", password: "qa-rbac-pass-2026!" }),
    });
    const lj: any = await lr.json();
    const res = await fetch(`${BASE}/api/v2/users`, {
      headers: { Authorization: `Bearer ${lj.token}` },
    });
    expect(res.status).toBe(403);
  });

  test("admin: list users", async () => {
    const res = await fetch(`${BASE}/api/v2/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const d: any = await res.json();
    expect(d.total).toBeGreaterThanOrEqual(6);
    // pastikan password_hash tidak bocor
    expect(JSON.stringify(d.rows)).not.toContain("password_hash");
  });

  test("admin: create → reset password → toggle → delete user teknisi", async () => {
    const uname = `qa_tkm_${Date.now()}`;
    const create = await fetch(`${BASE}/api/v2/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "QA Teknisi Temp",
        username: uname,
        password: "initial-pass-1",
        role: "teknisi",
        phone: "08129998888",
        jabatan: "Laptop",
      }),
    });
    expect(create.status).toBe(200);
    const cu: any = await create.json();
    createdId = cu.user.id;

    const reset = await fetch(`${BASE}/api/v2/users/${createdId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: "new-pass-2" }),
    });
    expect(reset.status).toBe(200);

    const toggle = await fetch(`${BASE}/api/v2/users/${createdId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: false }),
    });
    const td: any = await toggle.json();
    expect(toggle.status).toBe(200);
    expect(td.user.isActive).toBe(false);

    const del = await fetch(`${BASE}/api/v2/users/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(200);
  });

  test("admin: tidak bisa hapus/nonaktifkan diri sendiri", async () => {
    const me = await requireAuth({ authorization: `Bearer ${token}` }, ["admin"]);
    const res = await fetch(`${BASE}/api/v2/users/${me.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([400, 403]).toContain(res.status);
  });
});

describe("Order monitoring API", () => {
  let token: string;

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: "qa-rbac-pass-2026!" }),
    });
    token = (await res.json() as any).token;
  });

  test("GET /orders list (monitoring)", async () => {
    const res = await fetch(`${BASE}/api/v2/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const d: any = await res.json();
    expect(d.data.rows).toBeDefined();
    // setidaknya satu order punya kolom finansial
    if (d.data.rows.length > 0) {
      expect(d.data.rows[0]).toHaveProperty("estimatedPrice");
      expect(typeof d.data.rows[0].estimatedPrice).toBe("string");
    }
  });
});

// BASE di-inject agar test portabel; default 5300-debug di CI lokal.
const BASE = (globalThis as any).TEST_BASE ?? "http://localhost:5300";