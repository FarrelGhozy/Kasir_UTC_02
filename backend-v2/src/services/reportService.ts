// Report service v2 — #105: laporan lengkap & analitik.
// Revenue (dari #98/orders), + top produk terlaris, performa kasir & teknisi.
// Semua rentang tanggal WIB (Asia/Jakarta) — konsisten #90.
import { prisma } from "../db";
import { toWibKey, wibDayStart, wibDayEnd } from "../lib/wib";

export interface RevenueRow {
  date: string; // YYYY-MM-DD (Asia/Jakarta)
  pos: number; // dari transaksi POS
  orders: number; // dari pembayaran order
  total: number;
}

export async function revenueReport(input: { from?: Date; to?: Date }) {
  const _from = input.from ? new Date(input.from) : new Date();
  const _to = input.to ? new Date(input.to) : new Date();
  // default = hari ini WIB (bukan UTC lokal). Jika from/to diberikan, ambil batas hari WIB utk tiap tanggal.
  const from = input.from ? new Date(Math.min(_from.getTime(), _to.getTime())) : wibDayStart();
  const to = input.to ? new Date(Math.max(_from.getTime(), _to.getTime())) : wibDayEnd();

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
    add(toWibKey(r.date), "pos", Number(r._sum.grandTotal ?? 0));
  }
  for (const r of orderRows) {
    add(toWibKey(r.paidAt), "orders", Number(r._sum.amount ?? 0));
  }

  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totals = days.reduce(
    (acc, d) => ({ pos: acc.pos + d.pos, orders: acc.orders + d.orders, total: acc.total + d.total }),
    { pos: 0, orders: 0, total: 0 }
  );

  return { from: from.toISOString(), to: to.toISOString(), days, totals };
}

// ── #105: Top produk terlaris ────────────────────────────────────────────────
export interface TopItemRow {
  name: string;
  qty: number;
  revenue: number;
}

export async function topItemsReport(input: { from?: Date; to?: Date; limit?: number }) {
  const limit = Math.min(input.limit ?? 10, 50);
  const _from = input.from ? new Date(input.from) : wibDayStart();
  const _to = input.to ? new Date(input.to) : wibDayEnd();
  const from = input.from ? new Date(Math.min(_from.getTime(), _to.getTime())) : _from;
  const to = input.to ? new Date(Math.max(_from.getTime(), _to.getTime())) : _to;

  const items = await prisma.transactionItem.groupBy({
    by: ["name"],
    where: { transaction: { date: { gte: from, lte: to } } },
    _sum: { qty: true, subtotal: true },
    _count: { _all: true },
    orderBy: { _sum: { qty: "desc" } },
    take: limit,
  });

  const rows: TopItemRow[] = items.map((i) => ({
    name: i.name,
    qty: Number(i._sum.qty ?? 0),
    revenue: Number(i._sum.subtotal ?? 0),
  }));

  const totals = rows.reduce(
    (acc, r) => ({ qty: acc.qty + r.qty, revenue: acc.revenue + r.revenue }),
    { qty: 0, revenue: 0 }
  );

  return { from: from.toISOString(), to: to.toISOString(), rows, totals };
}

// ── #105: Performa kasir (POS) ───────────────────────────────────────────────
export interface CashierPerfRow {
  cashierId: number | null;
  cashierName: string;
  transactions: number;
  revenue: number;
}

export async function cashierPerformance(input: { from?: Date; to?: Date }) {
  const _from = input.from ? new Date(input.from) : wibDayStart();
  const _to = input.to ? new Date(input.to) : wibDayEnd();
  const from = input.from ? new Date(Math.min(_from.getTime(), _to.getTime())) : _from;
  const to = input.to ? new Date(Math.max(_from.getTime(), _to.getTime())) : _to;

  const [groups, users] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["cashierId"],
      where: { date: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: "desc" } },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const rows: CashierPerfRow[] = groups.map((g) => ({
    cashierId: g.cashierId,
    cashierName: g.cashierId ? nameById.get(g.cashierId) ?? `#${g.cashierId}` : "Tanpa kasir",
    transactions: g._count._all,
    revenue: Number(g._sum.grandTotal ?? 0),
  }));

  const totals = rows.reduce(
    (acc, r) => ({ transactions: acc.transactions + r.transactions, revenue: acc.revenue + r.revenue }),
    { transactions: 0, revenue: 0 }
  );

  return { from: from.toISOString(), to: to.toISOString(), rows, totals };
}

// ── #105: Workload teknisi (tiket servis) ────────────────────────────────────
export interface TechPerfRow {
  technicianId: number | null;
  technicianName: string;
  tickets: number;
  completed: number;
  revenue: number; // totalCost dari tiket
}

export async function technicianPerformance(input: { from?: Date; to?: Date }) {
  const _from = input.from ? new Date(input.from) : wibDayStart();
  const _to = input.to ? new Date(input.to) : wibDayEnd();
  const from = input.from ? new Date(Math.min(_from.getTime(), _to.getTime())) : _from;
  const to = input.to ? new Date(Math.max(_from.getTime(), _to.getTime())) : _to;

  const [groups, users] = await Promise.all([
    prisma.serviceTicket.groupBy({
      by: ["technicianId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { technicianId: true },
      _sum: { totalCost: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const completedCounts = await prisma.serviceTicket.groupBy({
    by: ["technicianId"],
    where: { createdAt: { gte: from, lte: to }, status: "Completed" },
    _count: { technicianId: true },
  });
  const completedById = new Map(completedCounts.map((c) => [c.technicianId, c._count.technicianId ?? 0]));

  const rows: TechPerfRow[] = groups.map((g) => ({
    technicianId: g.technicianId,
    technicianName: g.technicianId ? nameById.get(g.technicianId) ?? `#${g.technicianId}` : "Belum ditugaskan",
    tickets: g._count.technicianId ?? 0,
    completed: completedById.get(g.technicianId) ?? 0,
    revenue: Number(g._sum.totalCost ?? 0),
  }));

  const totals = rows.reduce(
    (acc, r) => ({ tickets: acc.tickets + r.tickets, completed: acc.completed + r.completed, revenue: acc.revenue + r.revenue }),
    { tickets: 0, completed: 0, revenue: 0 }
  );

  return { from: from.toISOString(), to: to.toISOString(), rows, totals };
}

// ── #105: Rekap lengkap (full-recap) — gabungan POS, servis, order ───────────
export interface RecapRow {
  id: number;
  source: "pos" | "servis" | "order";
  ref: string;
  customer: string | null;
  status: string;
  amount: number;
  date: string; // WIB key
}

export async function fullRecap(input: { from?: Date; to?: Date; limit?: number }) {
  const limit = Math.min(input.limit ?? 100, 500);
  const _from = input.from ? new Date(input.from) : wibDayStart();
  const _to = input.to ? new Date(input.to) : wibDayEnd();
  const from = input.from ? new Date(Math.min(_from.getTime(), _to.getTime())) : _from;
  const to = input.to ? new Date(Math.max(_from.getTime(), _to.getTime())) : _to;

  const [txs, srv, orders] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      take: limit,
      include: { cashier: { select: { name: true } } },
    }),
    prisma.serviceTicket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: { select: { name: true } } },
    }),
    prisma.specialOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const rows: RecapRow[] = [
    ...txs.map((t): RecapRow => ({
      id: t.id,
      source: "pos",
      ref: t.invoiceNo,
      customer: null,
      status: t.paymentMethod,
      amount: Number(t.grandTotal),
      date: toWibKey(t.date),
    })),
    ...srv.map((s): RecapRow => ({
      id: s.id,
      source: "servis",
      ref: s.ticketNumber,
      customer: s.customer?.name ?? null,
      status: s.status,
      amount: Number(s.totalCost),
      date: toWibKey(s.createdAt),
    })),
    ...orders.map((o): RecapRow => ({
      id: o.id,
      source: "order",
      ref: o.orderNumber,
      customer: o.customer?.name ?? null,
      status: o.paymentStatus,
      amount: Number(o.estimatedPrice),
      date: toWibKey(o.createdAt),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const totals = rows.reduce(
    (acc, r) => ({ pos: acc.pos + (r.source === "pos" ? r.amount : 0), servis: acc.servis + (r.source === "servis" ? r.amount : 0), order: acc.order + (r.source === "order" ? r.amount : 0) }),
    { pos: 0, servis: 0, order: 0 }
  );
  const grandTotal = totals.pos + totals.servis + totals.order;

  return { from: from.toISOString(), to: to.toISOString(), count: rows.length, rows, totals: { ...totals, grandTotal } };
}
