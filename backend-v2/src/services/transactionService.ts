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
    const grandTotalCents = grandTotal + taxBig;

    // 3. Validasi pembayaran (pakai sen untuk hindari floating point)
    const paidCents = BigInt(Math.round(Number(amountPaid) * 100));
    if (paidCents < grandTotalCents)
      throw new Error(
        `[BIZ] Pembayaran kurang: butuh ${Number(grandTotalCents) / 100}, dibayar ${Number(paidCents) / 100}`
      );
    const changeCents = paidCents - grandTotalCents;

    // 4. Potong stok (semua item) + catat audit
    for (const d of detailItems) {
      await tx.item.update({
        where: { id: d.item.id },
        data: { stock: { decrement: d.qty } },
      });
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