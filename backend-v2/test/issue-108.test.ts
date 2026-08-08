// Test #108 — Import/Export CSV inventory.
// 1) importItemsCsv: 2 baris baru → added=2; SKU sama → updated; baris tanpa SKU → failed + error detail.
// 2) import ulang SKU yang sama → tidak ada duplikat (updated, bukan added).
// 3) exportItemsCsv: BOM UTF-8 + header + semua item aktif.
// 4) csvTemplate: BOM + header + 1 contoh.
// 5) CSV invalid → throw (tidak ada data valid).
import { describe, expect, test, afterAll } from "bun:test";
import { importItemsCsv, exportItemsCsv, csvTemplate } from "../src/services/inventoryService";
import { prisma } from "../src/db";

const TEST_SKUS = ["CSV-T1", "CSV-T2"];

const csvOk = [
  "sku,name,category,purchase_price,selling_price,stock,min_stock_alert,description",
  "CSV-T1,Baut Test 1,Sparepart,1000,2000,10,5,desc1",
  "CSV-T2,Mur Test 2,Sparepart,500,1500,20,5,desc2",
].join("\n");

const csvWithDupAndBad = [
  "sku,name,category,purchase_price,selling_price,stock,min_stock_alert,description",
  "CSV-T1,Baut Test 1 Updated,Sparepart,1200,2200,15,5,updated",
  ",Tanpa SKU,Sparepart,0,1000,5,5,invalid",
].join("\n");

afterAll(async () => {
  await prisma.item.deleteMany({ where: { sku: { in: TEST_SKUS } } });
});

describe("Import/Export CSV inventory #108", () => {
  test("import baris baru → added=2, failed=0", async () => {
    const res = await importItemsCsv(csvOk);
    expect(res.added).toBe(2);
    expect(res.updated).toBe(0);
    expect(res.failed).toBe(0);
    expect(res.errors).toHaveLength(0);
  });

  test("import ulang SKU sama → updated (tidak duplikat); baris invalid → failed + detail", async () => {
    const res = await importItemsCsv(csvWithDupAndBad);
    expect(res.updated).toBe(1);
    expect(res.added).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errors[0]!.row).toBe(3);
    expect(res.errors[0]!.error).toContain("wajib");
    // tidak ada duplikat di DB
    const count = await prisma.item.count({ where: { sku: "CSV-T1" } });
    expect(count).toBe(1);
  });

  test("nilai ter-update benar (harga & stok baru)", async () => {
    const item = await prisma.item.findUnique({ where: { sku: "CSV-T1" } });
    expect(item).not.toBeNull();
    expect(Number(item!.sellingPrice)).toBe(2200);
    expect(item!.stock).toBe(15);
  });

  test("exportItemsCsv → BOM + header + baris data", async () => {
    const csv = await exportItemsCsv();
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("sku,name,category");
    expect(csv).toContain("CSV-T1");
  });

  test("csvTemplate → BOM + header + contoh baris", () => {
    const t = csvTemplate();
    expect(t.startsWith("\uFEFF")).toBe(true);
    expect(t).toContain("sku,name,category");
    expect(t).toContain("SKU-001");
  });

  test("CSV tanpa data valid → throw", async () => {
    await expect(importItemsCsv("sku,name\n,\n")).rejects.toThrow();
  });
});
