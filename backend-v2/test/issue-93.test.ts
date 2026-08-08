// Test ganti password self-service #93.
import { describe, expect, test, beforeAll } from "bun:test";
const BASE = (globalThis as any).TEST_BASE ?? "http://localhost:5300";

describe("Change password (self-service)", () => {
  let token: string;
  const newPw = "qa-temp-pass-999";
  const origPw = "qa-rbac-pass-2026!";

  beforeAll(async () => {
    const res = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: origPw }),
    });
    const d: any = await res.json();
    expect(res.status).toBe(200);
    token = d.token;
  });

  test("password lama salah → 400", async () => {
    const res = await fetch(`${BASE}/api/v2/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPassword: "salah", newPassword: newPw }),
    });
    expect(res.status).toBe(400);
  });

  test("ganti password sukses → login dengan baru → restore", async () => {
    const ch = await fetch(`${BASE}/api/v2/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ oldPassword: origPw, newPassword: newPw }),
    });
    expect(ch.status).toBe(200);

    // login dgn password baru harus sukses
    const l1 = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: newPw }),
    });
    expect(l1.status).toBe(200);
    const d1: any = await l1.json();
    const t2 = d1.token;

    // restore ke semula
    const rs = await fetch(`${BASE}/api/v2/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ oldPassword: newPw, newPassword: origPw }),
    });
    expect(rs.status).toBe(200);
  });

  test("password baru terlalu pendek → 400 (validasi schema)", async () => {
    const lr = await fetch(`${BASE}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_admin", password: origPw }),
    });
    const ld: any = await lr.json();
    const res = await fetch(`${BASE}/api/v2/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ld.token}` },
      body: JSON.stringify({ oldPassword: origPw, newPassword: "123" }),
    });
    expect(res.status).toBe(400);
  });
});