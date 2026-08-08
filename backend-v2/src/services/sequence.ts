// Fix H15/C1 — generate nomor unik ANTI-KEMBAR secara atomik.
// Menggunakan raw SQL upsert atomik di PG: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
// Tidak ada read-then-create race (C1): dua kasir paralel selalu dapat nilai beda.
import { prisma } from "../db";

/**
 * Ambil nomor urut berikutnya untuk key secara ATOMIK.
 * Black-box: `nextSequence("invoice:2026-08-03")` → 1, 2, 3... tanpa duplikat.
 */
export async function nextSequence(key: string): Promise<number> {
  // Upsert atomik: kalau key belum ada, buat dengan value=1; kalau ada, naikkan 1.
  // RETURNING value memberikan nilai POST-increment yang unik per baris lock.
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "number_sequences" (key, value, updated_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (key)
    DO UPDATE SET value = "number_sequences".value + 1, updated_at = now()
    RETURNING value
  `;
  const row = rows[0];
  if (!row) throw new Error(`[sequence] Gagal generate nilai untuk key ${key}`);
  return row.value;
}

/** Generate invoice no: `INV-YYYYMMDD-0001` */
export async function nextInvoiceNo(date: Date = new Date()): Promise<string> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const seq = await nextSequence(`invoice:${y}${m}${d}`);
  return `INV-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}

/** Ticket no: `SRV-YYYYMMDD-0001` */
export async function nextTicketNo(date: Date = new Date()): Promise<string> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const seq = await nextSequence(`ticket:${y}${m}${d}`);
  return `SRV-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}

/** Order no: `ORD-YYYYMMDD-0001` */
export async function nextOrderNo(date: Date = new Date()): Promise<string> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const seq = await nextSequence(`order:${y}${m}${d}`);
  return `ORD-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}