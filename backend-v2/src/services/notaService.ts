// Nota service v2 — #101: riwayat nota/struk dari sumber yang sudah ada
// (Transaction + ServiceTicket). Tanpa model baru (reuse) — keputusan desain.
// #104: + generate PDF nota (POS/servis/order) via pdfService.
import { PrismaClient } from "@prisma/client";
import { generateNotaPdf, notaPdfMeta, rupiah, formatDate, type PdfLine } from "./pdfService";

const prisma = new PrismaClient();

function biz(msg: string, status = 400): Error {
  const e = new Error(`[BIZ] ${msg}`) as Error & { status: number };
  e.status = status;
  return e;
}

export type NotaRow = {
  id: number;
  source: "pos" | "servis";
  ref: string;
  customer: string | null;
  status: string;
  total: number;
  createdAt: Date;
};

/** Daftar riwayat nota gabungan (POS + Servis), terbaru dulu, optional filter type. */
export async function listNotas(opts: { type?: string; limit?: number; from?: Date; to?: Date } = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const where: any = {};
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }

  const wantPos = !opts.type || opts.type === "POS" || opts.type === "pos" || opts.type === "all";
  const wantSrv = !opts.type || opts.type === "Servis" || opts.type === "servis" || opts.type === "all";

  const [txs, srv] = await Promise.all([
    wantPos
      ? prisma.transaction.findMany({
          where: opts.from || opts.to ? { date: where.createdAt } : {},
          orderBy: { date: "desc" },
          take: limit,
          include: { cashier: { select: { name: true } } },
        })
      : Promise.resolve([]),
    wantSrv
      ? prisma.serviceTicket.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const rows: NotaRow[] = [
    ...txs.map((t): NotaRow => ({
      id: t.id,
      source: "pos",
      ref: t.invoiceNo,
      customer: null,
      status: t.paymentMethod,
      total: Number(t.grandTotal),
      createdAt: t.date,
    })),
    ...srv.map((s): NotaRow => ({
      id: s.id,
      source: "servis",
      ref: s.ticketNumber,
      customer: s.customer?.name ?? null,
      status: s.status,
      total: Number(s.totalCost),
      createdAt: s.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { success: true, data: rows, count: rows.length, limit };
}

/** Detail nota per sumber — untuk print/preview. */
export async function getNota(source: string, id: number) {
  if (source === "pos") {
    const t = await prisma.transaction.findUnique({
      where: { id },
      include: {
        cashier: { select: { name: true } },
        items: true,
      },
    });
    if (!t) throw biz("Nota POS tidak ditemukan", 404);
    return {
      success: true,
      data: {
        type: "Struk POS",
        ref: t.invoiceNo,
        cashier: t.cashier?.name ?? null,
        date: t.date,
        method: t.paymentMethod,
        amountPaid: Number(t.amountPaid),
        change: Number(t.change),
        tax: Number(t.tax),
        total: Number(t.grandTotal),
        notes: t.notes ?? null,
        items: t.items.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: Number(i.price),
          subtotal: Number(i.subtotal),
        })),
      },
    };
  }
  if (source === "servis") {
    const s = await prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true } },
        technician: { select: { name: true } },
        parts: true,
      },
    });
    if (!s) throw biz("Nota servis tidak ditemukan", 404);
    return {
      success: true,
      data: {
        type: "Nota Servis",
        ref: s.ticketNumber,
        customer: s.customer?.name ?? null,
        phone: s.customer?.phone ?? null,
        technician: s.technician?.name ?? null,
        date: s.createdAt,
        status: s.status,
        serviceFee: Number(s.serviceFee),
        total: Number(s.totalCost),
        parts: s.parts.map((p) => ({
          name: p.name ?? "Part",
          qty: p.qty,
          total: Number(p.subtotal),
        })),
      },
    };
  }
  throw biz("Sumber nota harus 'pos' atau 'servis'");
}
/**
 * Generate PDF nota (#104) — source: pos | servis | order.
 * Return Buffer siap dikirim sebagai application/pdf.
 */
export async function getNotaPdf(source: string, id: number): Promise<Buffer> {
  if (source === "pos") {
    const t = await prisma.transaction.findUnique({
      where: { id },
      include: { cashier: { select: { name: true } }, items: true },
    });
    if (!t) throw biz("Nota POS tidak ditemukan", 404);
    return generateNotaPdf({
      title: "Struk Transaksi",
      ref: t.invoiceNo,
      date: t.date,
      meta: notaPdfMeta({
        title: "Struk POS",
        ref: t.invoiceNo,
        date: t.date,
        cashier: t.cashier?.name ?? null,
        method: t.paymentMethod,
      }),
      items: t.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: Number(i.price),
        subtotal: Number(i.subtotal),
      })),
      totals: [
        { label: "Subtotal", value: rupiah(Number(t.grandTotal)) },
        { label: "Pajak", value: rupiah(Number(t.tax ?? 0)) },
        { label: "Grand Total", value: rupiah(Number(t.grandTotal)) },
        { label: "Dibayar", value: rupiah(Number(t.amountPaid ?? 0)) },
        { label: "Kembalian", value: rupiah(Number(t.change ?? 0)) },
      ],
      footer: "Terima kasih — Bengkel UTC (Unida Technology Centre)",
    });
  }

  if (source === "servis") {
    const s = await prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true } },
        technician: { select: { name: true } },
        parts: { include: { item: true } },
      },
    });
    if (!s) throw biz("Nota servis tidak ditemukan", 404);
    const partsTotal = s.parts.reduce((acc, p) => acc + Number(p.subtotal), 0);
    return generateNotaPdf({
      title: "Nota Servis",
      ref: s.ticketNumber,
      date: s.createdAt,
      meta: notaPdfMeta({
        title: "Nota Servis",
        ref: s.ticketNumber,
        date: s.createdAt,
        customer: s.customer?.name ?? null,
        technician: s.technician?.name ?? null,
        status: s.status,
      }),
      items: [
        ...s.parts.map((p) => ({
          name: p.name ?? "Part",
          qty: p.qty,
          price: Number(p.item?.sellingPrice ?? 0),
          subtotal: Number(p.subtotal),
        })),
        {
          name: "Biaya Jasa",
          qty: 1,
          price: Number(s.serviceFee),
          subtotal: Number(s.serviceFee),
        },
      ],
      totals: [
        { label: "Sparepart", value: rupiah(Number(partsTotal)) },
        { label: "Biaya Jasa", value: rupiah(Number(s.serviceFee)) },
        { label: "Grand Total", value: rupiah(Number(s.totalCost)) },
      ],
      footer: "Terima kasih — Bengkel UTC (Unida Technology Centre)",
    });
  }

  if (source === "order") {
    const o = await prisma.specialOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { name: true, phone: true } },
        handledBy: { select: { name: true } },
        payments: true,
      },
    });
    if (!o) throw biz("Nota pesanan tidak ditemukan", 404);
    const paid = o.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const remaining = Math.max(0, Number(o.estimatedPrice) - paid);
    const totals: PdfLine[] = [
      { label: "Estimasi Harga", value: rupiah(Number(o.estimatedPrice)) },
      { label: "Total Dibayar (DP + pelunasan)", value: rupiah(Number(paid)) },
      { label: "Sisa Pembayaran", value: rupiah(Number(remaining)) },
    ];
    return generateNotaPdf({
      title: "Nota Pesanan Barang (Special Order)",
      ref: o.orderNumber,
      date: o.createdAt,
      meta: notaPdfMeta({
        title: "Nota Pesanan",
        ref: o.orderNumber,
        date: o.createdAt,
        customer: o.customer?.name ?? null,
        cashier: o.handledBy?.name ?? null,
        status: o.paymentStatus,
      }),
      items: [
        {
          name: o.itemName,
          qty: 1,
          price: Number(o.estimatedPrice),
          subtotal: Number(o.estimatedPrice),
        },
      ],
      totals,
      footer: "Bukti pemesanan barang — Bengkel UTC (Unida Technology Centre)",
    });
  }

  throw biz("Sumber nota harus 'pos', 'servis', atau 'order'");
}

export { formatDate };
