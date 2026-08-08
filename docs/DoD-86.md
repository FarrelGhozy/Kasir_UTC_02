# DoD — #86 🗄️ Schema Prisma + Full Migration MongoDB → PostgreSQL

**Branch:** v2 · **Stake:** P0 · **Status:** ✅ SELESAI (data dev)

## Yang dikerjakan

1. **Schema lengkap** — `prisma/schema.prisma`:
   - Semua model: users, items, customers, service_tickets, service_ticket_parts,
     service_logs, transactions, transaction_items, special_orders, order_payments,
     duty_schedules, stock_audit, system_logs, refresh_tokens, number_sequences.
   - Uang `Decimal(14,2)`, timestamp `Timestamptz`, FK + index + enum ketat.
   - **Baru: `MigrationIdMap`** (entity + old_id ObjectId → new_id Int) — blokir duplikat.

2. **Migration applied** — `prisma migrate dev --name add_migration_id_map`:
   - ✅ `npx prisma migrate deploy` clean (semua 5 migration applied).

3. **Script migrasi** — `backend-v2/scripts/migrate-mongo-to-pg.ts` (Bun):
   - Baca: `mongodb://localhost:27018/bengkel_utc` (produksi v1)
   - Tulis: PG `utc_v2` (dev, port 27019) via Prisma
   - Urutan FK: users → items → customers → tickets → transactions → orders → duty → logs
   - **Idempotent** thd unique key: cek existing (username/sku/ticket_number/invoice_no/order_number) → map apa adanya, skip create. Pakai `migration_id_map` utk semua ref lama.
   - Dependency: `mongodb@6` (bukan 7 — bson v7 crash di Bun `node:v8 isBuildingSnapshot`).

## Verifikasi DoD

| Kriteria | Hasil |
|---|---|
| Schema lengkap + migrate deploy clean | ✅ 5 migration applied |
| Script idempotent (bisa di-run ulang) | ✅ run 2× → count identik |
| Row count match (source mongo) | ✅ lihat tabel |
| Ref integrity (0 orphan) | ✅ 0 di semua relasi |
| Data dev dulu | ✅ target PG dev `utc_v2` |

## Count (source MongoDB → target PG)

| Entitas | Mongo | PG (kontribusi migrasi) | Keterangan |
|---|---|---|---|
| users | 13 | 13 | +6 dev/seed |
| items | 57 | 57 | +2 dev |
| customers | 106 | 106 | semua dari subdoc tiket/order |
| service_tickets | 107 | 107 | +44 dev |
| transactions | 0 | 0 | PG 663 = data dev/uji, bukan migrasi |
| special_orders | 3 | 3 | +8 dev |
| duty_schedules | 11 | 11 | ✓ |
| system_logs | 648 | 648 | ✓ |
| migration_id_map | — | 932 | semua ref terpetakan |

**Orphan check (FK):** parts 0 · tx_items 0 · tickets→cust 0 · orders→cust 0 · payments→order 0 ✅

## Catatan

- **Password mongo ter-hash bcrypt** (`$2b$`) — ikut ter-salur utuh ke `password_hash` PG; user migrasi bisa login seperti biasa.
- **Produksi PG**: belum ada instance produksi utk v2 (masih Mongo). Saat go-live (#94), jalankan script yang sama → PG produksi. Backup `mongodump` dilakukan DI TAHAP PRODUKSI (per DoD), bukan di dev.
- Nomor invoice/tiket/order v2 pakai format baru (`SRV-YYYYMMDD-NNNN`) via `number_sequences` — tak bentrok dgn nomor lama (`SRV-2026-NNNN`).

## Cara pakai (ulang nanti)

```bash
cd backend-v2
bun run scripts/migrate-mongo-to-pg.ts   # idempotent, aman di-run ulang
```