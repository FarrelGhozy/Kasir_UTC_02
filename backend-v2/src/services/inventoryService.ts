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
  if (lowStockOnly) {
    where.stock = { lte: prisma.item.fields.minStockAlert } as never;
    // pakai raw filter karena lte harus angka; fallback: where raw
  }

  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where: lowStockOnly ? { ...where, stock: { lte: 0 } } : where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where: lowStockOnly ? { ...where, stock: { lte: 0 } } : where }),
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

  const item = await prisma.item.findUnique({ where: { id: input.itemId } });
  if (!item) throw biz("Item tidak ditemukan");

  if (item.stock + input.delta < 0) {
    throw biz(`Stok tidak boleh negatif: sisa ${item.stock}, delta ${input.delta}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.item.update({
      where: { id: input.itemId },
      data: { stock: { increment: input.delta } },
    });
    await tx.stockAudit.create({
      data: {
        itemId: input.itemId,
        delta: input.delta,
        reason: input.reason.trim().toUpperCase(),
        refType: "Adjustment",
        createdById: input.createdById,
      },
    });
    return updated;
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