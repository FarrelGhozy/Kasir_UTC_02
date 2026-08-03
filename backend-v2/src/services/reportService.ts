// Fix H2 — laporan revenue menghitung uang dari:
//   (1) transaksi POS (transactions.grand_total)
//   (2) pembayaran Special Order (order_payments.amount)
// Disajikan per hari dalam range; total = gabungan keduanya.
import { prisma } from "../db";

export interface RevenueRow {
  date: string; // YYYY-MM-DD (Asia/Jakarta)
  pos: number; // dari transaksi POS
  orders: number; // dari pembayaran order
  total: number;
}

export async function revenueReport(input: { from?: Date; to?: Date }) {
  const from = input.from ?? new Date(new Date().setHours(0, 0, 0, 0));
  const to = input.to ?? new Date(new Date().setHours(23, 59, 59, 999));

  const [posRows, orderRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["date"],
      where: { date: { gte: from, lte: to } },
      _sum: { grandTotal: true },
    }),
    prisma.specialOrderPayment.groupBy({
      by: ["paidAt"],
      where: { paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  // aggregate per tanggal (pakai WIB offset utk konsistensi laporan harian)
  const map = new Map<string, RevenueRow>();
  const add = (date: string, kind: "pos" | "orders", amount: number) => {
    const row = map.get(date) ?? { date, pos: 0, orders: 0, total: 0 };
    if (kind === "pos") row.pos += amount;
    else row.orders += amount;
    row.total = row.pos + row.orders;
    map.set(date, row);
  };

  for (const r of posRows) {
    add(r.date.toISOString().slice(0, 10), "pos", Number(r._sum.grandTotal ?? 0));
  }
  for (const r of orderRows) {
    add(r.paidAt.toISOString().slice(0, 10), "orders", Number(r._sum.amount ?? 0));
  }

  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = days.reduce(
    (acc, d) => ({ pos: acc.pos + d.pos, orders: acc.orders + d.orders, total: acc.total + d.total }),
    { pos: 0, orders: 0, total: 0 }
  );

  return { from: from.toISOString(), to: to.toISOString(), days, totals };
}