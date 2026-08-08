# DoD #90 — BUG: reminder/timezone/email & validasi (H10,H11,H12,M4,M5,M6,M10,M11,M13)

## Ringkasan
Penerapan konsistensi timezone WIB terpusat, validasi tanggal → 400, dan verifikasi normalisasi WA. Mengikuti checklist issue #90.

## M4/M5/H11 — Semua perhitungan "hari ini" konsisten WIB
- Baru: **`src/lib/wib.ts`** — helper timezone WIB (UTC+7) tanpa dependency: `wibDayStart/End`, `toWibKey`, `todayWibKey`, `isWibFriday`, `wibDayIndex`.
- **`dashboardService.ts`** — "hari ini" pakai `wibDayStart()` + `todayWibKey()` (sebelumnya `new Date()` lokal server).
- **`reportService.ts`** — default range pakai `wibDayStart/End`, agregasi per-hari pakai `toWibKey()` (sebelumnya `toISOString()` UTC).
- **`dutyScheduleService.ts`** — `listTodaySchedule` hitung hari dari `wibDayIndex()` (sebelumnya `toLocaleString` inline).

## M6/M12 — Validasi tanggal → 400
- **`routes/orders.ts` (`GET /api/v2/reports/revenue`)** — validasi eksplisit: `from`/`to` bukan tanggal valid → **400**; `from > to` → **400**. Sebelumnya `new Date()` silent-parse → data aneh.
- Test baru **`test/issue-90.test.ts`** (4 case): from invalid, to invalid, range terbalik, range valid.

## M10 — Normalisasi nomor WA satu titik
- **`waService.ts normalizePhone()`** sudah menjadi satu-satunya titik normalisasi (0/62/+62/8 → 62…) — diverifikasi dipakai semua route WA (check, notify, resend).

## H10/H12/H13 — Reminder & email
- v2 **tidak memiliki** reminder/email service (fitur tersebut milik v1 `reminderService.js`/`emailService.js`; v2 komunikasi pelanggan via **WAHA** — `routes/wa.ts` + `waService.ts`, issue #102). Item H10/H12/H13 dinyatakan **N/A di v2** (tidak ada kode in-memory reminder yang bisa ter-reset restart; penggantinya notifikasi WA persist via DB).

## Regresi
- **TSC: 0** (backend & frontend).
- **bun test: 82/82 pass** (202 `expect()`, 11 file) — naik dari 78 (+4 test #90).
- Verifikasi manual: dashboard `/api/v2/dashboard/summary` → 200; revenue valid → 200; `from=notadate` → **400**.

## Dampak produksi v1
- Tidak ada file v1 disentuh; produksi (5300/27018) tetap hidup.
