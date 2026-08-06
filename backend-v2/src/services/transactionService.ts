// Fix C1/H15 — checkout POS ATOMIK: potong stok + insert transaksi dalam
// SATU transaksi DB. Kalau ada error (stok kurang, dsb) → ROLLBACK penuh,
// stok tidak pernah terpotong tanpa transaksi. Nomor invoice dari sequence.
import { prisma } from "../db";
import { nextInvoiceNo } from "./sequence";
import type { PaymentMethod } from "@prisma/client";

export interface CheckoutItem {
  itemId: number;
  qty: number;
}

export interface CheckoutInput {
  cashierId: number;
  items: CheckoutItem[];
  paymentMethod: PaymentMethod;
  amountPaid: string | number;
  tax?: string | number;
  notes?: string;
}

/**
 * Checkout transaksi dalam SATU transaksi DB (BEGIN/COMMIT/ROLLBACK).
 * - generate invoice_no atomik dari sequence
 * - cek stok cukup untuk SEMUA item
 * - potong stok (decrement) + catat StockAudit
 * - insert transaction + items
 * Kalau item tidak ditemukan / stok kurang → throw → rollback (stok utuh).
 */
export async function createTransaction(input: CheckoutInput) {
  const { cashierId, items, paymentMethod, amountPaid, tax = 0, notes } = input;

  if (!items.length) throw new Error("[BIZ] Keranjang kosong");

  // Nomor invoice dari counter ATOMIK — di luar transaksi: nomor tetap unik
  // walau transaksi gagal (gap nomor OK, duplikat TIDAK).
  const invoiceNo = await nextInvoiceNo();

  return prisma.$transaction(async (tx) => {
    let grandTotal = 0n;

    // 2. Validasi + hitung total + kunci stok
    const detailItems = [];
    for (const it of items) {
      const item = await tx.item.findUnique({ where: { id: it.itemId } });
      if (!item) throw new Error(`[BIZ] Item #${it.itemId} tidak ditemukan`);
      if (!item.isActive) throw new Error(`[BIZ] Item ${item.name} nonaktif`);
      if (item.stock < it.qty)
        throw new Error(`[BIZ] Stok ${item.name} kurang (sisa ${item.stock}, butuh ${it.qty})`);

      // SEMUA kalkulasi dalam SEN (hindari floating point & unit mix)
      const subtotal = BigInt(Math.round(Number(item.sellingPrice) * 100)) * BigInt(it.qty);
      grandTotal += subtotal;
      detailItems.push({ item, qty: it.qty, subtotal });
    }

    const taxBig = BigInt(Math.round(Number(tax) * 100));
    if (taxBig < 0n) throw new Error("[BIZ] Pajak tidak boleh negatif");
    const grandTotalCents = grandTotal + taxBig;

    // 3. Validasi pembayaran (pakai sen untuk hindari floating point)
    const paidCents = BigInt(Math.round(Number(amountPaid) * 100));
    if (paidCents < grandTotalCents)
      throw new Error(
        `[BIZ] Pembayaran kurang: butuh ${Number(grandTotalCents) / 100}, dibayar ${Number(paidCents) / 100}`
      );
    const changeCents = paidCents - grandTotalCents;

    // 4. Potong stok ATOMIK (semua item) + catat audit.
    //    updateMany conditional (stock >= qty) → hanya sukses bila stok masih
    //    cukup SAAT WRITE — dua checkout paralel item terakhir tidak bisa
    //    sama-sama lolos (read-modify-write race, #startup-audit R1).
    for (const d of detailItems) {
      const cut = await tx.item.updateMany({
        where: { id: d.item.id, stock: { gte: d.qty } },
        data: { stock: { decrement: d.qty } },
      });
      if (cut.count !== 1) {
        throw new Error(`[BIZ] Stok ${d.item.name} kurang (sisa ${d.item.stock}, butuh ${d.qty})`);
      }
      await tx.stockAudit.create({
        data: {
          itemId: d.item.id,
          delta: -d.qty,
          reason: "SALE",
          refType: "Transaction",
          createdById: cashierId,
        },
      });
    }

    // 5. Insert transaksi + items
    const transaction = await tx.transaction.create({
      data: {
        invoiceNo,
        cashierId,
        grandTotal: (Number(grandTotalCents) / 100).toFixed(2),
        paymentMethod,
        amountPaid: (Number(paidCents) / 100).toFixed(2),
        change: (Number(changeCents) / 100).toFixed(2),
        tax: (Number(taxBig) / 100).toFixed(2),
        notes,
        items: {
          create: detailItems.map((d) => ({
            itemId: d.item.id,
            name: d.item.name,
            qty: d.qty,
            price: (Number(BigInt(Math.round(Number(d.item.sellingPrice) * 100))) / 100).toFixed(2),
            subtotal: (Number(d.subtotal) / 100).toFixed(2),
          })),
        },
      },
      include: { items: true, cashier: { select: { id: true, name: true } } },
    });

    return transaction;
  });
}

/** Daftar transaksi + total harian (untuk dashboard/laporan) */
export async function listTransactions(params: { page?: number; limit?: number; from?: Date; to?: Date }) {
  const { page = 1, limit = 20, from, to } = params;
  const where = {
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { items: true, cashier: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);
  return { rows, total, page, limit };
}

// ── Ringkasan transaksi hari ini (WIB) — paritas main: getTodaySummary ───────
// #112: total transaksi + omzet + breakdown metode bayar untuk tanggal WIB hari ini.
export async function getTodaySummary() {
  const now = new Date();
  const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const start = new Date(Date.UTC(wib.getFullYear(), wib.getMonth(), wib.getDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const rows = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { grandTotal: true, paymentMethod: true },
  });

  const byMethod: { Cash: number; QRIS: number; Card: number; Transfer: number } = { Cash: 0, QRIS: 0, Card: 0, Transfer: 0 };
  let totalRevenue = 0;
  for (const r of rows) {
    totalRevenue += Number(r.grandTotal);
    byMethod[r.paymentMethod as keyof typeof byMethod] = (byMethod[r.paymentMethod as keyof typeof byMethod] ?? 0) + Number(r.grandTotal);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}`,
    totalTransactions: rows.length,
    totalRevenue,
    byMethod,
  };
}

// ── Lookup transaksi by invoice — paritas main: getTransactionByInvoice ─────
// #112: cek ulang transaksi dari nomor invoice (case-insensitive, disimpan uppercase).
export async function getTransactionByInvoice(invoiceNo: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNo: invoiceNo.trim().toUpperCase() },
    include: {
      cashier: { select: { id: true, name: true, username: true, role: true } },
      items: { include: { item: { select: { id: true, name: true, sku: true } } } },
    },
  });
  if (!transaction) throw new Error("[BIZ] Transaksi tidak ditemukan");
  return transaction;
}