// Dashboard service v2 — #98: ringkasan bisnis role-aware utk dashboard frontend.
import { prisma } from "../db";

/**
 * Ringkasan dashboard — data dari DB (bukan cuma health check). Role-aware:
 * teknisi hanya lihat tiket servis; kasir/admin lihat penjualan+inventory+order.
 * Uang dikembalikan rounded ke rupiah (angka); format di frontend.
 */
export async function dashboardSummary(user: { role: string }) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
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
    date: startToday.toISOString().split("T")[0],
    revenueToday: isFull ? revenueToday : null,
    transactionsToday: isFull ? txToday : null,
    lowStockCount: isFull ? lowStock : null,
    pendingSpecialOrders: isFull ? pendingOrders : null,
    activeServiceTickets: activeTickets,
    recentTransactions: isFull ? recentTx : [],
    recentServiceTickets: recentTickets,
  };
}