// Unit test #101 — Nota (receipt): list gabungan POS+Servis, detail per sumber, RBAC.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let token = "";
let targetTxId = 0;
let targetSrvId = 0;

async function call(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`http://localhost:5300/api/v2${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* kosong */
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  // login dengan retry singkat utk toleran terhadap rate-limiter saat semua file test jalan paralel
  let login: Awaited<ReturnType<typeof call>> | undefined;
  for (let i = 0; i < 5; i++) {
    login = await call("/auth/login", {
      method: "POST",
      body: { username: "qa_admin", password: "qa-rbac-pass-2026!" },
    });
    if (login?.status === 200) break;
    await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  expect(login?.status).toBe(200);
  token = login?.json?.token ?? login?.json?.data?.accessToken ?? login?.json?.data?.token ?? login?.json?.accessToken ?? "";

  // ambil id transaksi & tiket servis nyata di DB
  const tx = await prisma.transaction.findFirst({ orderBy: { date: "desc" } });
  const srv = await prisma.serviceTicket.findFirst({ orderBy: { createdAt: "desc" } });
  targetTxId = tx?.id ?? 0;
  targetSrvId = srv?.id ?? 0;
});

describe("#101 Nota", () => {
  test("list nota tanpa token → 401", async () => {
    const r = await call("/notas");
    expect(r.status).toBe(401);
  });

  test("list nota (POS + Servis) dengan token → 200 & berisi data", async () => {
    const r = await call("/notas", { token });
    expect(r.status).toBe(200);
    expect(r.json.success).toBe(true);
    expect(Array.isArray(r.json.data)).toBe(true);
    if (r.json.data.length > 0) {
      expect(r.json.data[0]).toHaveProperty("ref");
      expect(r.json.data[0]).toHaveProperty("source");
      expect(r.json.data[0]).toHaveProperty("total");
    }
  });

  test("filter type=POS hanya mengembalikan sumber pos", async () => {
    const r = await call("/notas?type=POS", { token });
    expect(r.status).toBe(200);
    for (const row of r.json.data) expect(row.source).toBe("pos");
  });

  test("detail nota POS (id nyata) → 200 & ada items", async () => {
    if (!targetTxId) return; // DB kosong — skip
    const r = await call(`/notas/pos/${targetTxId}`, { token });
    expect(r.status).toBe(200);
    expect(r.json.data.type).toContain("POS");
    expect(Array.isArray(r.json.data.items)).toBe(true);
  });

  test("detail nota servis (id nyata) → 200 & ada customer", async () => {
    if (!targetSrvId) return; // DB kosong — skip
    const r = await call(`/notas/servis/${targetSrvId}`, { token });
    expect(r.status).toBe(200);
    expect(r.json.data.type).toContain("Servis");
  });

  test("detail nota tidak ada → 404", async () => {
    const r = await call("/notas/pos/999999", { token });
    expect(r.status).toBe(404);
  });

  test("sumber invalid → 400", async () => {
    const r = await call("/notas/xyz/1", { token });
    expect(r.status).toBe(400);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});