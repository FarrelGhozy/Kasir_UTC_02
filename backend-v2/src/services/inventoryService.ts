// Inventory service v2 — #97: CRUD item, adjust stock (audited), low-stock, summary.
// Konvensi #87: uang dalam SEN di kalkulasi, simpan sebagai rupiah (Decimal 14,2).
import { prisma } from "../db";
import type { ItemCategory } from "@prisma/client";

function biz(msg: string): Error {
  return new Error(`[BIZ] ${msg}`);
}

const CATEGORIES: ItemCategory[] = ["Sparepart", "Accessory", "Software", "Service", "Other"];

export function parseCategory(cat?: string): ItemCategory {
  if (!cat) return "Other";
  if (!CATEGORIES.includes(cat as ItemCategory)) throw biz(`Kategori tidak valid: ${cat}`);
  return cat as ItemCategory;
}

/** CRUD: buat item baru. SKU wajib unik (di-validasi DB). */
export async function createItem(input: {
  sku: string;
  name: string;
  category?: string;
  purchasePrice?: number;
  sellingPrice: number;
  stock?: number;
  minStockAlert?: number;
  description?: string;
  createdById?: number;
}) {
  const sku = input.sku.trim().toUpperCase();
  if (!sku) throw biz("SKU wajib diisi");
  if (!input.name?.trim()) throw biz("Nama item wajib diisi");
  if (input.sellingPrice < 0) throw biz("Harga jual tidak boleh negatif");
  if ((input.stock ?? 0) < 0) throw biz("Stok awal tidak boleh negatif");

  const item = await prisma.item.create({
    data: {
      sku,
      name: input.name.trim(),
      category: parseCategory(input.category),
      purchasePrice: input.purchasePrice ?? 0,
      sellingPrice: input.sellingPrice,
      stock: input.stock ?? 0,
      minStockAlert: input.minStockAlert ?? 5,
      description: input.description,
    },
  });

  // stok awal > 0 → catat audit (asal stok)
  if ((input.stock ?? 0) > 0) {
    await prisma.stockAudit.create({
      data: {
        itemId: item.id,
        delta: input.stock!,
        reason: "INIT",
        refType: "Item",
        createdById: input.createdById,
      },
    });
  }
  return item;
}

export async function listItems(params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
}) {
  const { page = 1, limit = 20, search, category, lowStockOnly } = params;
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = parseCategory(category);
  // #startup-audit R6: stok menipis = stock <= minStockAlert per item
  // (sebelumnya hanya stok 0 — threshold alert tidak pernah terpakai).
  // Prisma tidak mendukung column-compare di findMany → resolusi id via fetch
  // ringan (skala bengkel: puluhan–ratusan item), lalu filter in-query.
  if (lowStockOnly) {
    const lowStockIds = await prisma.item.findMany({
      select: { id: true, stock: true, minStockAlert: true },
    }).then((rows) =>
      rows.filter((r) => r.stock <= r.minStockAlert).map((r) => r.id)
    );
    if (lowStockIds.length === 0) return { rows: [], total: 0, page, limit };
    where.id = { in: lowStockIds };
  }

  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);
  return { rows, total, page, limit };
}

export async function getItem(id: number) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { stockAudits: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!item) throw biz("Item tidak ditemukan");
  return item;
}

export async function updateItem(
  id: number,
  input: {
    name?: string;
    category?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    minStockAlert?: number;
    description?: string;
    isActive?: boolean;
  }
) {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) throw biz("Item tidak ditemukan");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.category !== undefined) data.category = parseCategory(input.category);
  if (input.purchasePrice !== undefined) data.purchasePrice = input.purchasePrice;
  if (input.sellingPrice !== undefined) data.sellingPrice = input.sellingPrice;
  if (input.minStockAlert !== undefined) data.minStockAlert = input.minStockAlert;
  if (input.description !== undefined) data.description = input.description;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.item.update({ where: { id }, data });
}

/**
 * Penyesuaian stok (stock opname / koreksi) — dicatat di StockAudit (H17/C1).
 * delta positif = masuk, negatif = keluar. Stok tidak boleh jadi negatif.
 */
export async function adjustStock(input: {
  itemId: number;
  delta: number;
  reason: string;
  createdById?: number;
}) {
  if (input.delta === 0) throw biz("Delta stok tidak boleh 0");
  if (!input.reason?.trim()) throw biz("Alasan penyesuaian wajib diisi");

  // Validasi atomik DI DALAM transaksi: updateMany conditional (stock >= |delta|)
  // hanya sukses bila stok masih cukup SAAT WRITE — dua penyesuaian paralel
  // (opname vs pemakaian part) tidak bisa sama-sama lolos (#startup-audit R2).
  return prisma.$transaction(async (tx) => {
    const updated = await tx.item.updateMany({
      where: {
        id: input.itemId,
        ...(input.delta < 0 ? { stock: { gte: -input.delta } } : {}),
      },
      data: { stock: { increment: input.delta } },
    });
    if (updated.count !== 1) {
      const item = await tx.item.findUnique({ where: { id: input.itemId } });
      if (!item) throw biz("Item tidak ditemukan");
      throw biz(`Stok tidak boleh negatif: sisa ${item.stock}, delta ${input.delta}`);
    }
    await tx.stockAudit.create({
      data: {
        itemId: input.itemId,
        delta: input.delta,
        reason: input.reason.trim().toUpperCase(),
        refType: "Adjustment",
        createdById: input.createdById,
      },
    });
    const fresh = await tx.item.findUniqueOrThrow({ where: { id: input.itemId } });
    return fresh;
  });
}

/** Ringkasan inventory: total item, nilai (harga beli), stok menipis. */
export async function inventorySummary() {
  const items = await prisma.item.findMany();
  const totalValue = items.reduce(
    (acc, i) => acc + Number(i.purchasePrice) * i.stock,
    0
  );
  const lowStock = items.filter((i) => i.stock <= i.minStockAlert);
  const byCategory = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + i.stock;
    return acc;
  }, {});

  return {
    totalItems: items.length,
    totalStock: items.reduce((a, i) => a + i.stock, 0),
    totalValue,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      stock: i.stock,
      minStockAlert: i.minStockAlert,
    })),
    byCategory,
  };
}

/** Hapus item — soft delete (isActive=false) supaya histori transaksi utuh. */
export async function deleteItem(id: number) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw biz("Item tidak ditemukan");
  return prisma.item.update({ where: { id }, data: { isActive: false } });
}

// ═══════════════════════════════════════════════════════════════════════════
// #108 — Import/Export CSV inventory (paritas main: PapaParse + upsert by SKU).
// ═══════════════════════════════════════════════════════════════════════════
import Papa from "papaparse";

export interface CsvImportResult {
  added: number;
  updated: number;
  failed: number;
  errors: { row: number; sku?: string; error: string }[];
}

const CSV_HEADERS = ["sku", "name", "category", "purchase_price", "selling_price", "stock", "min_stock_alert", "description"];

/** Parse CSV → array row object (header dinormalisasi: lowercase, strip non-alnum). */
function parseCsvRows(csv: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
  });
  if (res.errors.length && res.data.length === 0) throw new Error(`CSV tidak valid: ${res.errors[0]!.message}`);
  return res.data.filter((r) => r && Object.values(r).some((v) => v !== undefined && v !== ""));
}

/**
 * Import massal dari CSV — upsert by SKU (paritas main):
 * - SKU+name wajib; baris tanpa keduanya di-skip & dicatat sebagai error.
 * - SKU sudah ada → update; SKU baru → create. Tidak ada duplikat.
 * - Stock tidak valid → 0 (seperti main).
 */
export async function importItemsCsv(csv: string, userId?: number): Promise<CsvImportResult> {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) throw new Error("[400] Tidak ada data valid untuk diimport");

  const result: CsvImportResult = { added: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const rowNo = i + 2; // baris CSV (header = 1)
    const sku = (r.sku ?? "").trim().toUpperCase();
    const name = (r.name ?? "").trim();
    if (!sku || !name) {
      result.failed++;
      result.errors.push({ row: rowNo, sku, error: "SKU & nama wajib diisi" });
      continue;
    }
    try {
      const category = parseCategory(r.category);
      const purchasePrice = Number(r.purchase_price ?? r.purchasePrice ?? 0);
      const sellingPrice = Number(r.selling_price ?? r.sellingPrice ?? 0);
      const rawStock = r.stock ?? r.stok;
      const stock = rawStock !== undefined && rawStock !== "" && !isNaN(Number(rawStock)) ? Number(rawStock) : 0;
      const minStockAlert = Number(r.min_stock_alert ?? r.minStockAlert ?? 5) || 5;

      const existing = await prisma.item.findUnique({ where: { sku } });
      if (existing) {
        await prisma.item.update({
          where: { sku },
          data: { name, category, purchasePrice, sellingPrice, stock, minStockAlert, description: r.description || existing.description, isActive: true },
        });
        result.updated++;
      } else {
        await prisma.item.create({
          data: { sku, name, category, purchasePrice, sellingPrice, stock, minStockAlert, description: r.description || null },
        });
        result.added++;
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: rowNo, sku, error: e?.message ?? "Gagal import" });
    }
  }

  return result;
}

/** Export semua item aktif → CSV dengan BOM (agar Excel baca UTF-8 dengan benar). */
export async function exportItemsCsv(): Promise<string> {
  const items = await prisma.item.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const rows = items.map((i) => ({
    sku: i.sku,
    name: i.name,
    category: i.category,
    purchase_price: Number(i.purchasePrice),
    selling_price: Number(i.sellingPrice),
    stock: i.stock,
    min_stock_alert: i.minStockAlert,
    description: i.description ?? "",
  }));
  // BOM UTF-8 + header + data — Papa.unparse handle escaping
  return "\uFEFF" + Papa.unparse({ fields: CSV_HEADERS, data: rows });
}

/** Template CSV (header saja + 1 contoh baris). */
export function csvTemplate(): string {
  return (
    "\uFEFF" +
    Papa.unparse({
      fields: CSV_HEADERS,
      data: [["SKU-001", "Oli Mesin 1L", "Oli", "45000", "55000", "20", "5", "Contoh item"]],
    })
  );
}