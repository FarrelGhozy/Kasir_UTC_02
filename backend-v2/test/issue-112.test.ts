// Test #112 — POS quick-amount & summary/today + invoice lookup.
// 1) getTodaySummary: tanggal WIB hari ini, hitung jumlah & omzet + breakdown metode.
// 2) getTransactionByInvoice: uppercase match (input lowercase), throw [BIZ] jika tak ada.
import { describe, expect, test, afterAll } from "bun:test";
import { prisma } from "../src/db";
import { getTodaySummary, getTransactionByInvoice, createTransaction } from "../src/services/transactionService";

const createdIds: number[] = [];
let testInvoice = "";

async function makeItem(name: string, price: number) {
  const it = await prisma.item.create({
    data: { name, sku: `POS-T112-${Date.now()}-${Math.floor(Math.random() * 1000)}`, purchasePrice: price, sellingPrice: price, stock: 50, isActive: true },
  });
  return it;
}

describe("POS summary & invoice lookup #112", () => {
  afterAll(async () => {
    if (createdIds.length) {
      const txns = await prisma.transaction.findMany({ where: { id: { in: createdIds } }, include: { items: true } });
      for (const t of txns) {
        for (const it of t.items) {
          if (it.itemId) await prisma.item.update({ where: { id: it.itemId }, data: { stock: { increment: it.qty } } });
        }
        await prisma.transactionItem.deleteMany({ where: { transactionId: t.id } });
      }
      await prisma.transaction.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  });

  test("getTodaySummary: struktur lengkap & konsisten (delta setelah create)", async () => {
    const before = await getTodaySummary();
    expect(before.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(before.totalTransactions).toBeGreaterThanOrEqual(0);
    // cek struktur tanpa toMatchObject(expect.any) — matcher bisa memutasi objek aktual
    for (const k of ["Cash", "QRIS", "Card", "Transfer"] as const) {
      expect(typeof before.byMethod[k]).toBe("number");
    }

    const item = await makeItem("POS Test T112", 25000);
    const t = await createTransaction({ cashierId: 1, items: [{ itemId: item.id, qty: 2 }], paymentMethod: "Cash", amountPaid: 100000 });
    createdIds.push(t.id);
    testInvoice = t.invoiceNo;

    const after = await getTodaySummary();
    expect(after.totalTransactions).toBe(before.totalTransactions + 1);
    expect(after.totalRevenue - before.totalRevenue).toBe(50000);
    expect(after.byMethod.Cash - before.byMethod.Cash).toBe(50000);

    // lookup lowercase harus match invoice tersimpan (uppercase)
    const found = await getTransactionByInvoice(testInvoice.toLowerCase());
    expect(found.invoiceNo).toBe(testInvoice);
    expect(found.cashier).toBeTruthy();
    expect(found.items.length).toBe(1);
    expect(Number(found.items[0]!.subtotal)).toBe(50000);
  });

  test("getTransactionByInvoice: tidak ada → throw [BIZ]", async () => {
    await expect(getTransactionByInvoice("ZZZ-NOT-EXIST-999")).rejects.toThrow(/tidak ditemukan/);
  });
});
