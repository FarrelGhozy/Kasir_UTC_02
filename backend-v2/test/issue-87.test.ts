// Unit test #87 — race checkout (C1/H15) + restore aman (C2)
// Jalankan: DATABASE_URL=... bun test
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createTransaction } from "../src/services/transactionService";
import { nextInvoiceNo, nextTicketNo, nextOrderNo } from "../src/services/sequence";
import { createBackup, restoreBackup, validateBackup } from "../src/services/backupService";

const prisma = new PrismaClient();

beforeAll(async () => {
  // seed: kasir + item stok 100
  await prisma.user.upsert({
    where: { username: "kasir1" },
    update: {},
    create: { name: "Kasir 1", username: "kasir1", passwordHash: "x", role: "kasir" },
  });
  await prisma.user.upsert({
    where: { username: "kasir2" },
    update: {},
    create: { name: "Kasir 2", username: "kasir2", passwordHash: "x", role: "kasir" },
  });
  await prisma.item.upsert({
    where: { sku: "TEST-001" },
    update: { stock: 100 },
    create: {
      sku: "TEST-001",
      name: "Item Race Test",
      category: "Other",
      purchasePrice: 5000,
      sellingPrice: 10000,
      stock: 100,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("H15 — nomor unik anti-kembar (sequence atomik)", () => {
  test("nextSequence memberi nilai unik berturut-turut", async () => {
    const a = await nextInvoiceNo();
    const b = await nextInvoiceNo();
    const c = await nextInvoiceNo();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).toMatch(/^INV-\d{8}-\d{4}$/);
  });

  test("ticket & order punya prefix beda, format benar", async () => {
    const t = await nextTicketNo();
    const o = await nextOrderNo();
    expect(t).toMatch(/^SRV-\d{8}-\d{4}$/);
    expect(o).toMatch(/^ORD-\d{8}-\d{4}$/);
  });
});

describe("C1 — checkout race 2 kasir bersamaan", () => {
  test("20 checkout paralel: semua sukses, nomor UNIK, stok konsisten", async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { sku: "TEST-001" } });
    const kasir1 = await prisma.user.findUniqueOrThrow({ where: { username: "kasir1" } });
    const kasir2 = await prisma.user.findUniqueOrThrow({ where: { username: "kasir2" } });

    // reset stok ke 100 + bersihkan audit lama (test bisa di-run ulang)
    await prisma.item.update({ where: { id: item.id }, data: { stock: 100 } });
    await prisma.stockAudit.deleteMany({ where: { itemId: item.id, refType: "Transaction" } });

    const jobs = Array.from({ length: 20 }, (_, i) =>
      createTransaction({
        cashierId: i % 2 === 0 ? kasir1.id : kasir2.id,
        items: [{ itemId: item.id, qty: 1 }],
        paymentMethod: "Cash",
        amountPaid: 10000,
      })
    );
    const results = await Promise.allSettled(jobs);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(20); // semua sukses

    const invoices = fulfilled.map((r) => (r as PromiseFulfilledResult<any>).value.invoiceNo);
    expect(new Set(invoices).size).toBe(20); // 20 nomor BEDA — anti-kembar ✓

    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.stock).toBe(80); // 100 - 20 = 80, tidak ada yang hilang/dobel

    // audit trail lengkap
    const audits = await prisma.stockAudit.count({ where: { itemId: item.id, refType: "Transaction" } });
    expect(audits).toBe(20);
  });

  test("checkout stok kurang → ROLLBACK penuh, stok TIDAK terpotong", async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { sku: "TEST-001" } });
    const kasir1 = await prisma.user.findUniqueOrThrow({ where: { username: "kasir1" } });

    // stok pas 2, minta 5 → harus gagal
    await prisma.item.update({ where: { id: item.id }, data: { stock: 2 } });
    await expect(
      createTransaction({
        cashierId: kasir1.id,
        items: [{ itemId: item.id, qty: 5 }],
        paymentMethod: "Cash",
        amountPaid: 50000,
      })
    ).rejects.toThrow(/Stok/);

    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.stock).toBe(2); // rollback sempurna — stok utuh ✓

    // reset stok
    await prisma.item.update({ where: { id: item.id }, data: { stock: 100 } });
  });

  test("pembayaran kurang → ditolak, tanpa transaksi masuk", async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { sku: "TEST-001" } });
    const kasir1 = await prisma.user.findUniqueOrThrow({ where: { username: "kasir1" } });
    const before = await prisma.transaction.count();

    await expect(
      createTransaction({
        cashierId: kasir1.id,
        items: [{ itemId: item.id, qty: 1 }],
        paymentMethod: "Cash",
        amountPaid: 5000, // harga 10000, bayar 5000 → kurang
      })
    ).rejects.toThrow(/Pembayaran kurang/);

    const after = await prisma.transaction.count();
    expect(after).toBe(before); // tidak ada transaksi masuk ✓
    const stok = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stok.stock).toBe(100); // stok tidak berubah ✓
  });
});

describe("C2 — restore backup anti data-loss", () => {
  test("file korup → ditolak SEBELUM DB tersentuh, data selamat", async () => {
    // simpan data baseline
    const { json: backup } = await createBackup();
    const baseline = await prisma.item.count();

    // restore file korup → harus THROW
    await expect(restoreBackup('{"version":99,"tables":{}}')).rejects.toThrow();
    await expect(restoreBackup("not-json-at-all{{{")).rejects.toThrow();
    await expect(restoreBackup('{"tables":{}}')).rejects.toThrow(); // tanpa version

    // data masih ada — tidak hilang
    expect(await prisma.item.count()).toBe(baseline);
    // backup valid tetap bisa dibuat
    expect(validateBackup(backup)).toBeTruthy();
  });

  test("restore valid: data lama diganti data backup (atomic)", async () => {
    // buat item tambahan di DB (simulasi data produksi saat ini)
    await prisma.item.upsert({
      where: { sku: "EXTRA-999" },
      update: {},
      create: { sku: "EXTRA-999", name: "Item Ekstra", category: "Other", purchasePrice: 1, sellingPrice: 2, stock: 1 },
    });
    const { json: backup } = await createBackup(); // backup berisi EXTRA-999

    // hapus EXTRA-999 dari DB → restore harus mengembalikannya
    await prisma.item.delete({ where: { sku: "EXTRA-999" } });
    expect(await prisma.item.findUnique({ where: { sku: "EXTRA-999" } })).toBeNull();

    const { restoredRows } = await restoreBackup(backup);
    expect(restoredRows).toBeGreaterThan(0);
    expect(await prisma.item.findUnique({ where: { sku: "EXTRA-999" } })).not.toBeNull();

    // bersihkan
    await prisma.item.delete({ where: { sku: "EXTRA-999" } });
  });
});
