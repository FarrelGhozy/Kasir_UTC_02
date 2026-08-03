// Fix C2 — backup/restore ANTI DATA-LOSS.
// Strategi: validasi file SEPENUHNYA sebelum sentuh DB, lalu restore dalam
// SATU transaksi (TRUNCATE + insert). Insert gagal → ROLLBACK → data lama selamat.
// Tidak ada lagi pola lama: deleteMany SEMUA lalu insertMany tanpa transaksi.
import { prisma } from "../db";
import { createHash } from "node:crypto";

const BACKUP_VERSION = 1;

/** Model yang di-backup, urutan insert penting (parent → child, FK aman). */
const TABLES: { table: string; model: string; order: number }[] = [
  { table: "users", model: "user", order: 1 },
  { table: "customers", model: "customer", order: 2 },
  { table: "items", model: "item", order: 3 },
  { table: "transactions", model: "transaction", order: 4 },
  { table: "transaction_items", model: "transactionItem", order: 5 },
  { table: "service_tickets", model: "serviceTicket", order: 6 },
  { table: "service_ticket_parts", model: "serviceTicketPart", order: 7 },
  { table: "service_logs", model: "serviceLog", order: 8 },
  { table: "special_orders", model: "specialOrder", order: 9 },
  { table: "order_payments", model: "specialOrderPayment", order: 10 },
  { table: "duty_schedules", model: "dutySchedule", order: 11 },
  { table: "stock_audit", model: "stockAudit", order: 12 },
  { table: "number_sequences", model: "numberSequence", order: 13 },
];

/** Ambil semua data via prisma client — pakai findMany dengan order stabil */
async function dumpAll(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of [...TABLES].sort((a, b) => a.order - b.order)) {
    // @ts-expect-error dynamic model access
    out[t.table] = await prisma[t.model].findMany({
      orderBy: t.model === "numberSequence" ? { key: "asc" } : { id: "asc" },
    });
  }
  return out;
}

/** Buat backup lengkap → object siap disimpan (JSON string) */
export async function createBackup(): Promise<{ json: string; sha256: string; size: number }> {
  const data = await dumpAll();
  const payload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables: data,
  };
  const json = JSON.stringify(payload);
  const sha256 = createHash("sha256").update(json).digest("hex");
  return { json, sha256, size: Buffer.byteLength(json) };
}

/** Validasi struktur file backup — THROW kalau korup/tidak dikenal. */
export function validateBackup(raw: string): Record<string, unknown[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File backup korup: bukan JSON valid");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("File backup korup: bukan object");
  const p = parsed as { version?: unknown; tables?: unknown };
  if (p.version !== BACKUP_VERSION) throw new Error("File backup korup: versi tidak dikenal");
  if (!p.tables || typeof p.tables !== "object" || Array.isArray(p.tables))
    throw new Error("File backup korup: struktur tabel hilang");

  // Cek semua tabel yang dibutuhkan ada + berbentuk array
  const tables = p.tables as Record<string, unknown>;
  for (const t of TABLES) {
    if (!Array.isArray(tables[t.table])) {
      throw new Error(`File backup korup: tabel ${t.table} tidak ada/rusak`);
    }
  }
  const result: Record<string, unknown[]> = {};
  for (const t of TABLES) result[t.table] = tables[t.table] as unknown[];
  return result;
}

/**
 * Restore backup dengan aman:
 * 1. Validasi file (tanpa sentuh DB) — file korup → error di sini, DB aman.
 * 2. Dalam SATU transaksi: TRUNCATE semua tabel (CASCADE) + insert ulang.
 * 3. Kalau ada error → rollback → data lama SELAMAT.
 */
export async function restoreBackup(raw: string): Promise<{ restoredRows: number }> {
  const tables = validateBackup(raw); // throw di sini kalau korup — DB tidak tersentuh

  let restoredRows = 0;
  await prisma.$transaction(async (tx) => {
    // TRUNCATE semua tabel sekaligus (CASCADE menangani FK)
    const tableNames = TABLES.map((t) => `"${t.table}"`).join(", ");
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE`);

    // Insert ulang sesuai urutan (parent → child)
    for (const t of [...TABLES].sort((a, b) => a.order - b.order)) {
      const rows = tables[t.table] as unknown[];
      if (!rows.length) continue;
      // @ts-expect-error dynamic model access
      await tx[t.model].createMany({ data: rows });
      restoredRows += rows.length;
    }
  });

  return { restoredRows };
}

/** Ringkasan isi backup (untuk info sebelum restore) */
export function backupSummary(raw: string): Record<string, number> {
  const tables = validateBackup(raw);
  const summary: Record<string, number> = {};
  for (const t of TABLES) summary[t.table] = (tables[t.table] as unknown[]).length;
  return summary;
}