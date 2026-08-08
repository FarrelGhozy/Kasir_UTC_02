// Test #106 — Dashboard chart 30 hari (revenueTrend30d).
// 1) Selalu mengembalikan tepat 30 bucket hari (WIB, YYYY-MM-DD) berurutan.
// 2) Revenue & transaksi tidak negatif; hari terakhir = hari ini (WIB).
// 3) totals.revenue30d == jumlah seluruh bucket revenue.
import { describe, expect, test, beforeAll } from "bun:test";
import { revenueTrend30d } from "../src/services/dashboardService";
import { prisma } from "../src/db";

describe("Dashboard chart 30 hari #106", () => {
  test("revenueTrend30d → tepat 30 hari berurutan (WIB)", async () => {
    const rep = await revenueTrend30d();
    expect(rep.days).toHaveLength(30);
    for (let i = 1; i < rep.days.length; i++) {
      const prev = rep.days[i - 1]!.date;
      const cur = rep.days[i]!.date;
      expect(cur > prev).toBe(true); // urutan naik
      const p = new Date(prev + "T00:00:00Z");
      const c = new Date(cur + "T00:00:00Z");
      expect((c.getTime() - p.getTime()) / 86400000).toBe(1); // selisih tepat 1 hari
    }
  });

  test("nilai tidak negatif & hari terakhir = hari ini (WIB)", async () => {
    const rep = await revenueTrend30d();
    for (const d of rep.days) {
      expect(d.revenue).toBeGreaterThanOrEqual(0);
      expect(d.transactions).toBeGreaterThanOrEqual(0);
    }
    const wib = new Date(Date.now() + 7 * 3600 * 1000);
    const todayKey = wib.toISOString().slice(0, 10);
    expect(rep.days[rep.days.length - 1]!.date).toBe(todayKey);
  });

  test("totals.revenue30d = jumlah semua bucket", async () => {
    const rep = await revenueTrend30d();
    const sum = rep.days.reduce((acc, d) => acc + d.revenue, 0);
    expect(rep.totals.revenue30d).toBe(sum);
  });

  test("konsisten dgn aggregate langsung di DB", async () => {
    const rep = await revenueTrend30d();
    const from = new Date(rep.days[0]!.date + "T17:00:00Z"); // start WIB hari pertama
    const agg = await prisma.transaction.aggregate({
      where: { date: { gte: from } },
      _sum: { grandTotal: true },
    });
    const dbTotal = Math.round(Number(agg._sum.grandTotal ?? 0));
    expect(dbTotal).toBeLessThanOrEqual(rep.totals.revenue30d); // bucket mencakup order juga
  });
});
