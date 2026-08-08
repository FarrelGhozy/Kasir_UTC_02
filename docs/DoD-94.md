# DoD — #94 📌 v2 Master Roadmap (EPIC)

**Branch:** v2 · **Status:** ✅ SEMUA TURUNAN SELESAI + GATE GO-LIVE PASS

## 🏁 Status seluruh roadmap

| # | Issue | Status |
|---|---|---|
| 85 | ⚙️ FOUNDATION — Setup stack v2 | ✅ CLOSED |
| 91 | 🚨 SECURITY — fix critical/high | ✅ CLOSED |
| 86 | 🗄️ DB — Schema + Full Migration Mongo→PG | ✅ CLOSED (baru) |
| 87 | 🔴 Logic kritis (atomic, restore, sequence) | ✅ CLOSED |
| 88 | 🟠 Pembayaran & status Special Order | ✅ CLOSED |
| 89 | 🟠 FSM servis, inventori & stok | ✅ CLOSED |
| 90 | 🟠 Reminder/timezone/email & validasi | ✅ CLOSED (baru) |
| 92 | 🌐 Frontend React+Vite — semua fitur | ✅ CLOSED |
| 93 | 🎨 UI/UX redesign & halaman baru | ✅ CLOSED |
| 96/95/98/99/100/101/102 | Auth, security guard, dashboard, quality, gap WA/nota/jadwal | ✅ CLOSED |

## ✅ Gate Go-Live — verifikasi 2026-08-05

| Gate | Hasil |
|---|---|
| #87 & #91 selesai & tested | ✅ closed, regresi 82/82 (202 expect, 11 file) |
| Migrasi data dev Mongo→PG sukses + count match | ✅ #86: 13 user, 57 item, 106 customer, 107 tiket, 648 log; 0 orphan; idempotent |
| Semua fitur v1 ada di v2 (ceklist #92) | ✅ closed |
| Audit keamanan ulang: 0 Critical/High | ✅ #91/#95/#96 closed; TSC:0 backend & frontend |
| UAT manual 8090/5300 dgn data dev | ✅ login OK; `/dashboard/summary`, `/services`, `/reports/revenue` → 200; kartu kaya + dashboard diverifikasi visual |
| Rollback plan jelas (compose lama hidup) | ✅ v1 UP: `utc_frontend` :8080, `utc_backend` :5200, `utc_mongo` :27018, `utc_waha` :8000 |
| Backup DB PG sebelum cutover | ⏳ dilakukan SAAT eksekusi go-live (belum cutover) |

## 📝 Keputusan arsitektur yang terpasang

- Nomor invoice/tiket/order via `number_sequences` (anti-kembar, H15) ✅
- Transaksi stok Prisma `$transaction` (C1) ✅
- Uang `Decimal(14,2)`, timestamp `Timestamptz` ✅
- Waktu WIB helper `src/lib/wib.ts` (tanpa dependency, H11/M4/M5) ✅
- JWT pendek + refresh token, role dari DB (SEC-5/H9) ✅
- Stok tanpa `isLowStock` — query `stock <= min_stock_alert` (H6) ✅
- Normalisasi WA `0→62` di waService (M10) ✅
- Backup restore staging+transaksi (C2) ✅

## 🚀 Status go-live

**v2 SIAP DIPAKAI.** Eksekusi cutover produksi (matikan v1, rename `backend-v2`→`backend`, `frontend-v2`→`frontend`, aktifkan compose v2, backup PG) **menunggu keputusan user** — aksi permanen yang tidak dilakukan otomatis.