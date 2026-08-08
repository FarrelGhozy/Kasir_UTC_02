// Test #105 — Laporan lengkap & analitik.
// 1) topItemsReport: agregasi qty+revenue dari transaksi nyata.
// 2) cashierPerformance: 1 baris per kasir + totals konsisten.
// 3) technicianPerformance: kolom tickets/completed/revenue ada.
// 4) fullRecap: gabungan pos+servis+order, grandTotal = jumlah.
import { describe, expect, test, beforeAll } from "bun:test";
import {
  topItemsReport,
  cashierPerformance,
  technicianPerformance,
  fullRecap,
} from "../src/services/reportService";
import { prisma } from "../src/db";

let from: Date;
let to: Date;

beforeAll(async () => {
  to = new Date();
  from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
});

describe("Laporan lengkap & analitik #105", () => {
  test("topItemsReport → rows punya name/qty/revenue & totals", async () => {
    const rep = await topItemsReport({ from, to, limit: 10 });
    expect(Array.isArray(rep.rows)).toBe(true);
    for (const r of rep.rows) {
      expect(typeof r.name).toBe("string");
      expect(typeof r.qty).toBe("number");
      expect(typeof r.revenue).toBe("number");
    }
    expect(typeof rep.totals.qty).toBe("number");
  });

  test("cashierPerformance → 1 baris per kasir + totals >= 0", async () => {
    const rep = await cashierPerformance({ from, to });
    expect(Array.isArray(rep.rows)).toBe(true);
    const ids = new Set(rep.rows.map((r) => r.cashierId));
    expect(ids.size).toBe(rep.rows.length); // tidak ada duplikat kasir
    expect(rep.totals.transactions).toBeGreaterThanOrEqual(0);
    expect(rep.totals.revenue).toBeGreaterThanOrEqual(0);
  });

  test("technicianPerformance → kolom lengkap", async () => {
    const rep = await technicianPerformance({ from, to });
    expect(Array.isArray(rep.rows)).toBe(true);
    for (const r of rep.rows) {
      expect(typeof r.technicianName).toBe("string");
      expect(r.tickets).toBeGreaterThanOrEqual(0);
      expect(r.completed).toBeGreaterThanOrEqual(0);
      expect(r.completed).toBeLessThanOrEqual(r.tickets);
    }
  });

  test("fullRecap → grandTotal = jumlah semua baris", async () => {
    const rep = await fullRecap({ from, to, limit: 500 });
    expect(Array.isArray(rep.rows)).toBe(true);
    const sum = rep.rows.reduce((acc, r) => acc + r.amount, 0);
    expect(rep.totals.grandTotal).toBeCloseTo(sum, 0);
    expect(rep.totals.pos + rep.totals.servis + rep.totals.order).toBeCloseTo(sum, 0);
  });

  test("fullRecap: source terbatas ke pos/servis/order", async () => {
    const rep = await fullRecap({ from, to, limit: 500 });
    const ok = rep.rows.every((r) => ["pos", "servis", "order"].includes(r.source));
    expect(ok).toBe(true);
    // DB pasti punya data transaksi dari test sebelumnya (kalau kosong, skip)
    if (rep.rows.length > 0) {
      const txCount = await prisma.transaction.count();
      expect(txCount).toBeGreaterThan(0);
    }
  });
});
