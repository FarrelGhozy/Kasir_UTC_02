// Dashboard service v2 — #98: ringkasan bisnis role-aware utk dashboard frontend.
// #106: + revenueTrend30d() — seri 30 hari (WIB) utk bar chart & line chart.
import { prisma } from "../db";
import { wibDayStart, todayWibKey } from "../lib/wib";

/** 30 hari terakhir (WIB): { date, revenue, transactions } — #106. */
export async function revenueTrend30d() {
  const start = wibDayStart();
  start.setDate(start.getDate() - 29); // 30 hari termasuk hari ini

  const [txs, orders] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start } },
      select: { date: true, grandTotal: true },
    }),
    prisma.specialOrderPayment.findMany({
      where: { paidAt: { gte: start } },
      select: { paidAt: true, amount: true },
    }),
  ]);

  // bucket per hari WIB
  const buckets = new Map<string, { revenue: number; transactions: number }>();
  const day = new Date(start);
  for (let i = 0; i < 30; i++) {
    const key = toWibKey(day);
    buckets.set(key, { revenue: 0, transactions: 0 });
    day.setDate(day.getDate() + 1);
  }
  for (const t of txs) {
    const key = toWibKey(t.date);
    const b = buckets.get(key);
    if (b) {
      b.revenue += Number(t.grandTotal ?? 0);
      b.transactions += 1;
    }
  }
  for (const p of orders) {
    const key = toWibKey(p.paidAt);
    const b = buckets.get(key);
    if (b) b.revenue += Number(p.amount ?? 0);
  }

  const days = [...buckets.entries()]
    .map(([date, v]) => ({ date, revenue: Math.round(v.revenue), transactions: v.transactions }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = days.reduce((acc, d) => acc + d.revenue, 0);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 30);
  const prev = await prisma.transaction.aggregate({
    where: { date: { gte: prevStart, lt: start } },
    _sum: { grandTotal: true },
  });
  const prevTotal = Math.round(Number(prev._sum.grandTotal ?? 0));

  return {
    days,
    totals: { revenue30d: total, prevRevenue30d: prevTotal },
    trend: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? 100 : 0),
  };
}

function toWibKey(d: Date): string {
  // WIB = UTC+7 — format YYYY-MM-DD
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

/**
 * Ringkasan dashboard — data dari DB (bukan cuma health check). Role-aware:
 * teknisi hanya lihat tiket servis; kasir/admin lihat penjualan+inventory+order.
 * Uang dikembalikan rounded ke rupiah (angka); format di frontend.
 */
export async function dashboardSummary(user: { role: string }) {
  const startToday = wibDayStart(); // #90: konsisten WIB, bukan UTC lokal
  const isFull = user.role === "admin" || user.role === "kasir";

  // ── Kasir/Admin: penjualan & transaksi hari ini ─────────────────────────
  let revenueToday = 0;
  let txToday = 0;
  let lowStock = 0;
  let pendingOrders = 0;

  if (isFull) {
    const [rev, tx, items, orders] = await Promise.all([
      prisma.transaction.aggregate({
        where: { date: { gte: startToday } },
        _sum: { grandTotal: true },
      }),
      prisma.transaction.count({ where: { date: { gte: startToday } } }),
      // column-compare stock<=min per item dihitung di JS
      prisma.item.findMany({ where: { isActive: true }, select: { id: true, stock: true, minStockAlert: true } }),
      prisma.specialOrder.count({
        where: { status: { in: ["Pending", "Searching", "Ordered"] } },
      }),
    ]);
    revenueToday = Math.round(Number(rev._sum.grandTotal ?? 0));
    txToday = tx;
    lowStock = items.filter((i) => i.stock <= i.minStockAlert).length;
    pendingOrders = orders;
  }

  // Semua role ter-login
  const [activeTickets, recentTx, recentTickets] = await Promise.all([
    prisma.serviceTicket.count({
      where: { status: { in: ["Queue", "Diagnosing", "In_Progress", "Waiting_Part"] } },
    }),
    isFull
      ? prisma.transaction.findMany({
          orderBy: { date: "desc" },
          take: 5,
          select: { id: true, invoiceNo: true, grandTotal: true, date: true, paymentMethod: true },
        })
      : [],
    prisma.serviceTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, ticketNumber: true, status: true, createdAt: true, totalCost: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  return {
    scope: isFull ? "full" : "service-only",
    date: todayWibKey(),
    revenueToday: isFull ? revenueToday : null,
    transactionsToday: isFull ? txToday : null,
    lowStockCount: isFull ? lowStock : null,
    pendingSpecialOrders: isFull ? pendingOrders : null,
    activeServiceTickets: activeTickets,
    recentTransactions: isFull ? recentTx : [],
    recentServiceTickets: recentTickets,
  };
}