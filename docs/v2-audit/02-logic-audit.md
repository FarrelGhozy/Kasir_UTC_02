Semua file sudah terbaca penuh dengan nomor baris terverifikasi. Berikut laporan audit lengkap.

---

# AUDIT LOGIKA BACKEND — Kasir_UTC_02
**Scope:** `/home/ghozy/Kasir_UTC_02/backend` (Express 5 + Mongoose 9 + MongoDB) — semua controller, service, model, middleware, utils, bot, routes, server. Baca-saja, tidak ada file diubah.

## Ringkasan Eksekutif
Sistem punya **1 bug Critical (stok hilang saat transaksi batal karena nomor invoice kembar)**, **±15 bug High** yang membuat stok, uang, status, dan laporan saling tidak konsisten. Akar masalahnya: (a) pola *find-then-save* untuk generate nomor + potong stok yang tidak dibungkus transaksi/rollback penuh; (b) flag `isLowStock` yang tidak pernah ter-update; (c) status flow servis/order yang permisif (bisa loncat); (d) pembayaran Special Order tidak pernah disinkronkan ke `down_payment` maupun ke tabel transaksi kasir; (e) timezone campur aduk (UTC vs Asia/Jakarta) antar endpoint; (f) banyak `.catch()` yang menelan kegagalan (stok restore, email, WA) sehingga bug berjalan senyap.

---

# TEMUAN BUG

## 🔴 CRITICAL

**[BUG-C1] Stok terpotong tapi transaksi gagal → barang hilang tanpa invoice (race condition nomor invoice)**
- `controllers/transactionController.js:97-132` + `models/Transaction.js` (`generateInvoiceNumber`, pola find-then-create)
- Alur: FASE 2 potong stok satu-per-satu (baris 99) → generate `invoice_no` (baris 116, baca-tulis non-atomic) → `transaction.save()` (baris 132). Jika dua kasir checkout bersamaan, keduanya dapat `invoice_no` sama; save yang kedua melempar E11000 (unique index). Catch di baris 140-142 hanya meneruskan error ke errorHandler (→ 400 "Nilai duplikat pada kolom: invoice_no"), **sedangkan rollback stok (baris 104-113) hanya menangani kegagalan di loop potong stok — BUKAN kegagalan save**.
- Skenario: Stok Oli = 5. Kasir A dan B sama-sama jual 1 liter dalam detik yang sama. Keduanya potong stok (stok → 3). B dapat `invoice_no` yang sama dengan A → save B gagal → error 400 di layar kasir B, **stok tetap 3 (tidak kembali ke 4) padahal transaksi B tidak pernah ada**. Buku stok dan kas tidak cocok; selisih menumpuk tiap kejadian.
- Severity: **Critical**
- Fix: bungkus potong-stok + insert transaksi dalam **satu transaksi DB** (Mongo session `withTransaction`, atau di PostgreSQL `BEGIN; ... COMMIT` dengan rollback pada error apa pun). Untuk nomor: gunakan counter atomic (`findOneAndUpdate` + `$inc` pada collection counter, atau `sequence`/`nextval` di PG) bukan read-lalu-insert. Tambahan: jika tetap pakai retry, rollback stok harus dieksekusi pada **semua** error setelah FASE 2 dimulai.

**[BUG-C2] Restore/Import backup: hapus semua data DULU, lalu insert — jika insert gagal, database kosong permanen**
- `services/backupService.js:185-234` dan `controllers/backupController.js:64-114`
- Komentar di baris 41 (`// AMAN: insert dulu baru delete`) **bertentangan dengan kode**: baris 64-72 (`importData`) dan 185-192 (`restoreFromFile`) menjalankan `deleteMany({})` pada **semua 6 collection**, baru `Promise.all(insertMany)` (baris 114 / 234). `insertMany` memakai `collection.insertMany` (raw, tanpa validasi/hook) dan **tanpa transaksi/rollback**. Jika satu saja insert gagal (duplikat `_id` admin yang diawetkan, E11000, cast error dari data JSON), response 500 — dan data lama sudah terhapus.
- Skenario: Admin restore file backup yang `system_logs`-nya punya dokumen rusak → `SystemLog.collection.insertMany` gagal → Promise.all reject → error 500, **seluruh data produksi (users, items, tickets, transactions, orders) hilang**.
- Severity: **Critical**
- Fix: restore ke collection staging/temp dulu, validasi, baru swap; atau bungkus dalam transaksi multi-dokumen; minimal: backup file lama sebelum delete, dan urutkan insert sebelum delete untuk collection yang sama. Di PG: gunakan `TRUNCATE`+`COPY` dalam satu transaksi.

## 🟠 HIGH

**[BUG-H1] Pembayaran order "Lunas" tidak menyentuh `down_payment` → sisa bayar tidak pernah nol**
- `controllers/orderController.js:196-228` (updatePaymentStatus) vs `orderController.js:84,107` (remaining_payment = estimated − down_payment)
- `updatePaymentStatus` hanya set `payment_status='Lunas'` (baris 196); `down_payment` tetap (mis. 100rb dari estimasi 500rb). Semua turunan menghitung sisa dari selisih itu: API (baris 84/107), WA (`whatsappService.notifyOrderStatus`), dan nota PDF (`pdfService.addOrderPricing`).
- Skenario: estimasi 500rb, DP 100rb. Kasir klik "Lunas". `remaining_payment` = 400rb → **UI kasir & customer tetap melihat "Sisa Bayar Rp 400.000"** walau order Lunas; nota cetak bertuliskan "LUNAS" **dan** "Sisa Bayar Rp 400.000" (kontradiksi). Uang 400rb diterima tapi tidak tercatat di mana pun.
- Severity: **High**
- Fix: saat `Lunas`, set `down_payment = estimated_price` (atau tambah riwayat pembayaran + kolom `paid_amount`); jangan hitung remaining dari DP saja.

**[BUG-H2] Pembayaran order tidak pernah masuk pendapatan kasir (tidak ada Transaction dibuat)**
- `controllers/orderController.js:186-240`; pembanding: `reportController.js:153-183` (pendapatan hanya dari `Transaction` + tiket `Picked_Up`)
- Tidak ada kode yang membuat `Transaction` saat order Lunas. Laporan harian/bulanan (`getDailyRevenue`, `getMonthlyRevenue`, `getFullRecap`) hanya menjumlah `Transaction.grand_total` + `ServiceTicket.total_cost`.
- Skenario: customer bayar lunas order 500rb. Uang masuk kas, tapi `total_revenue` hari itu tidak mencantumkan 500rb → **laporan kasir tidak pernah cocok dengan uang fisik**; tidak ada jejak audit pembayaran order.
- Severity: **High**
- Fix: saat `updatePaymentStatus('Lunas')`, buat Transaction (atau tabel `order_payments`) dengan metode bayar; masukkan ke agregasi laporan.

**[BUG-H3] Status servis bisa loncat urutan: Queue→Completed langsung, tanpa Diagnosing/In_Progress**
- `models/ServiceTicket.js:297-305` (validTransitions)
- `'Queue': ['Diagnosing','Cancelled','Completed','In_Progress','Waiting_Part']` (baris 298), `'Diagnosing': [...,'Completed']` (299), `'Waiting_Part': [...,'Completed']` (300), `'Completed': ['Picked_Up','In_Progress','Queue',...]` (302 — tiket selesai bisa balik lagi).
- Skenario: kasir salah klik "Selesai" pada tiket baru → status langsung `Completed` tanpa pernah didiagnosa; `completed_at` tercatat, email/WA terkirim, dan tiket masuk laporan "servis selesai" padahal belum dikerjakan. Tiket yang sudah `Completed` juga bisa di-reopen ke `In_Progress` (baris 302) lalu `completed_at` tetap tanggal lama (guard baris 322) → durasi pengerjaan & laporan teknisi salah.
- Severity: **High**
- Fix: transisi ketat: Queue→Diagnosing→In_Progress→Completed→Picked_Up (Waiting_Part hanya dari Diagnosing/In_Progress); Completed tidak boleh kembali ke status aktif; tambah audit log tiap transisi. Kalau reopen dibutuhkan, buat status `Reopened` eksplisit.

**[BUG-H4] `Picked_Up` tanpa metode pembayaran → pendapatan tercatat tapi pembayaran tidak tervalidasi; tiket terminal tak bisa dikoreksi**
- `models/ServiceTicket.js:324-335` (`if (paymentMethod) this.payment_method = paymentMethod;` — opsional) + `models/ServiceTicket.js:304` (`'Picked_Up': []` terminal)
- Skenario: teknisi mengubah status ke `Picked_Up` tanpa memilih metode bayar (field tidak wajib di controller `serviceController.js:224-236`). Tiket masuk pendapatan servis laporan (karena `status='Picked_Up'`, `reportController.js:168,257,384`), tapi `payment_method` null → nota PDF tercetak "BELUM LUNAS" (`pdfService.js:274`), dan karena `Picked_Up` terminal, **tidak ada cara mengubah status** — satu-satunya jalan admin hard-delete (yang memicu bug-H8). Garansi 7 hari juga mulai berjalan (baris 332-334) walau belum bayar.
- Severity: **High**
- Fix: wajibkan `payment_method` saat transisi ke `Picked_Up` kecuali `total_cost === 0`; atau tambahkan status perantara `Ready_For_Pickup` yang bisa dikoreksi.

**[BUG-H5] Part & biaya jasa bisa diubah setelah tiket `Completed` (harga yang sudah dikonfirmasi ke customer berubah)**
- `controllers/serviceController.js:287` (hanya `Picked_Up` yang diblokir untuk tambah/hapus part), `serviceController.js:369-384` (`updateServiceFee` tanpa cek status)
- Saat status → `Completed`, email nota otomatis terkirim (`serviceController.js:239-247`) dan WA total biaya terkirim (`whatsappService.notifyServiceStatus`). Setelah itu teknisi masih bisa menambah part (mis. lupa mencatat 1 barang) → `total_cost` berubah (pre-save `ServiceTicket.js:220-226`).
- Skenario: tiket Completed dengan total 150rb → customer dapat email 150rb → teknisi tambah part 50rb → total jadi 200rb → saat Picked_Up PDF tercetak 200rb. **Customer ditagih angka berbeda dari yang dikonfirmasi; nota email ≠ nota PDF.**
- Severity: **High**
- Fix: blokir tambah/hapus part dan ubah `service_fee` untuk status `Completed`/`Picked_Up`; hanya izinkan via mekanisme "koreksi" yang mencatat alasan.

**[BUG-H6] `isLowStock` (flag) tidak pernah ter-update → alert stok menipis salah total**
- `models/Item.js:155-158` (pre('save') men-set `isLowStock`) vs semua jalur produksi memakai `findOneAndUpdate`/`$inc` (`Item.js:111-147`) yang **tidak memicu pre('save')**
- Semua penjualan memakai `deductStockAtomic` (`transactionController.js:99`, `serviceController.js:303`), `addStockAtomic` untuk restore, dan `bulkWrite` import (`inventoryController.js:327`). Tidak satu pun menyentuh pre-save → flag `isLowStock` membeku di nilai saat item dibuat/di-edit manual.
- Skenario: item dengan stok 10, `min_stock_alert` 5. Terjual 8 → stok 2, tapi `isLowStock` tetap `false` → tidak muncul di `GET /inventory/alerts/low-stock` (`inventoryController.js:197-204`) dan filter `?low_stock=true` (`inventoryController.js:85-87`). Sebaliknya, barang yang sudah di-restock tetap tampil "stok menipis" selamanya. Ada virtual `is_low_stock` yang benar (`Item.js:106-108`) tapi tidak dipakai (lean() membuang virtual).
- Severity: **High**
- Fix: hapus flag persisted; filter low stock via agregasi `{ $expr: { $lte: ['$stock','$min_stock_alert'] } }` (dan di PG: kolom computed/generated atau query biasa).

**[BUG-H7] PUT `/inventory/:id` bisa menimpa stok dengan nilai basi (lost update)**
- `controllers/inventoryController.js:4` (`'stock'` ada di `allowedItemFields`) + `inventoryController.js:154-158` (`Object.assign(currentItem, updateData)` lalu save)
- Skenario: Kasir A membuka form edit item (stok tampil 10). Sementara itu transaksi lain menjual 5 (stok nyata 5). Kasir A hanya mengubah harga lalu simpan → `Object.assign` menulis `stock: 10` (nilai form basi) → **stok naik 5 unit fiktif**. Ini classik read-modify-write race, dan endpoint ini boleh dipakai kasir (route `api.js:54`).
- Severity: **High**
- Fix: keluarkan `stock` dari `allowedItemFields` pada PUT (stok hanya lewat `adjustStock`/transaksi); atau optimistic locking (`__v`/version kolom) dan tolak save jika versi basi.

**[BUG-H8] Admin hard-delete tiket servis: stok part tidak dikembalikan + nomor tiket bisa terpakai ulang**
- `controllers/serviceController.js:389-398` (`findByIdAndDelete` tanpa restore stok `parts_used`)
- Skenario: tiket `Picked_Up` dengan 3 part senilai stok terpotong dihapus admin → stok part tetap terpotong selamanya (barang hilang dari gudang, tidak ada transaksi). Selain itu, `generateTicketNumber` (`ServiceTicket.js:239-259`) mengambil nomor dari tiket **terbaru** (`sort({_id:-1})`); jika yang dihapus adalah tiket terakhir, nomornya dipakai lagi → **dua tiket (historis) bernomor sama** → laporan/klaim garansi membingungkan.
- Severity: **High**
- Fix: sebelum hard-delete, kembalikan stok semua `parts_used` (dengan cek hasil); lebih baik soft-delete + simpan counter nomor terpisah dari data.

**[BUG-H9] `isActive`/role di JWT basi: user yang di-nonaktifkan/di-demote tetap punya akses penuh sampai 7 hari**
- `middleware/auth.js:33-36` (req.user diambil dari payload JWT, tanpa cek DB) + `authController.js:8` (token `expiresIn: '7d'` berisi `role` & `isActive` snapshot login)
- Cek `decoded.isActive === false` (auth.js:49) hanya memblokir user yang **sudah** nonaktif saat token dibuat. `updateUser`/`deleteUser` (`authController.js:185-211, 258-278`) mengubah DB, bukan token.
- Skenario: admin menonaktifkan kasir yang sedang login (atau menurunkan admin→kasir). Token lama tetap `role:'admin'`, `isActive:true` → **kasir yang dipecat masih bisa buka endpoint admin (hapus transaksi, restore backup) sampai token kedaluwarsa**.
- Severity: **High** (keamanan)
- Fix: selalu ambil `role`/`isActive` dari DB di `protect` (atau token-version per user: simpan `token_version` di user, tolak jika mismatch).

**[BUG-H10] Reminder WA "pickup/teknisi/order" mati untuk semua data yang dibuat sebelum restart terakhir**
- `services/reminderService.js:10` (`this.server_started_at = new Date()`) + guard `:73,139,204` (skip jika `completedAt/arrivedAt/createdAt < server_started_at`)
- `server_started_at` adalah variabel in-memory → **reset setiap restart server** (deploy, crash, `pm2 restart`). Guard dibuat untuk mencegah spam saat restart, tapi efeknya permanen: data lama di-skip **selamanya** (cron hanya berjalan 08:00-15:00, dan tiket yang terlewat satu siklus tidak pernah di-remind lagi).
- Skenario: tiket Completed Senin 14:30 → server restart Senin malam (deploy rutin) → Selasa 08:00 guard `completedAt < server_started_at` true → skip → **customer tidak pernah dapat reminder pengambilan**.
- Severity: **High**
- Fix: simpan last-run marker di DB (mis. `last_reminder_run_at` di collection settings), bukan in-memory; guard anti-spam pakai `last_customer_reminder_at` yang sudah ada (`ServiceTicket.js:200-205`).

**[BUG-H11] Skip hari Jumat (libur) salah timezone → reminder nyasar di hari yang salah**
- `services/reminderService.js:17,32` (`new Date().getDay() === 5` untuk skip Jumat) — cron di-schedule dengan `timezone: 'Asia/Jakarta'` (`:27,41`) tapi `getDay()` membaca **timezone proses** (container). `server.js` tidak men-set `TZ`.
- Skenario: container berjalan UTC (default Docker). Jumat 08:00 WIB = Kamis 01:00 UTC → `getDay()===4` → **reminder tetap dikirim pada Jumat (hari libur yang justru ingin di-skip)**; Kamis malam juga kena skip yang salah. Bandingkan dengan `bot/dutyReminder.js:31` yang benar (pakai `toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })`).
- Severity: **High** (fitur reminder utama rusak tergantung TZ container)
- Fix: hitung hari dari WIB secara eksplisit (pola dutyReminder) atau set `TZ=Asia/Jakarta` di container + `process.env.TZ`.

**[BUG-H12] Email nota untuk Special Order selalu gagal diam-diam (template tidak kompatibel)**
- `services/emailService.js` — akses `ticket.device.brand` dan `ticket.parts_used.map` dan `ticket.total_cost` pada template yang sama untuk tiket & order; `orderController.js:46` (`await sendInvoiceEmail(order)`) dan `orderController.js:128`
- `SpecialOrder` tidak punya `device`, `parts_used`, `total_cost` (schema: `SpecialOrder.js:22-84`). Pemanggilan dari `createOrder` (baris 45-47) & `updateOrderStatus` (baris 127-129) → TypeError di dalam template → tertangkap catch-all (emailService) → hanya log "Gagal mengirim email nota" → **fungsi email order mati total tanpa error ke user**, plus `await` menambah latensi tiap createOrder.
- Severity: **High** (fitur senyap gagal)
- Fix: buat template email terpisah untuk order (atau guard `ticket.parts_used`/`ticket.device`); jangan lempar dari service agar tidak memblokir request.

**[BUG-H13] `updatePaymentStatus('Lunas')` memaksa order langsung `Picked_Up` walau barang belum datang**
- `controllers/orderController.js:197-199` + `models/SpecialOrder.js:88-90` (model pun mengizinkan `Pending→Picked_Up`, `Searching→Picked_Up`, `Ordered→Picked_Up`)
- Skenario: order status `Ordered` (barang masih dipesan ke supplier), customer bayar lunas → status dipaksa `Picked_Up` → **sistem menganggap barang sudah diambil padahal belum ada di toko**; `picked_up_at` tercatat salah; `remaining_payment` juga tetap salah (bug-H1). Sebaliknya `updateOrderStatus` bisa langsung `Picked_Up` dari `Pending` (model mengizinkan).
- Severity: **High**
- Fix: pisahkan `payment_status` dari status barang; `Picked_Up` hanya via `updateOrderStatus` dan hanya dari `Arrived`.

**[BUG-H14] Pembayaran order memaksa tiket servis terkait loncat ke `In_Progress` (termasuk tiket yang sudah final)**
- `controllers/orderController.js:220-226` (`await ticket.updateStatus('In_Progress')`)
- Transisi model mengizinkan `Queue→In_Progress` (`ServiceTicket.js:298`) dan bahkan `Completed→In_Progress` (`:302`).
- Skenario: order terkait tiket yang **sudah `Completed`** — customer bayar lunas → tiket servis yang sudah selesai **balik ke `In_Progress`** (garansi/riwayat kacau, `completed_at` lama dipertahankan). Untuk tiket `Queue`, tiket langsung "sedang dikerjakan" padahal teknisi belum mulai (dipicu pembayaran, bukan kerja nyata).
- Severity: **High**
- Fix: hanya izinkan transisi bila status tiket ∈ {Queue, Diagnosing, Waiting_Part}; jangan sentuh tiket `Completed`/`Picked_Up`/`Cancelled`.

**[BUG-H15] Nomor invoice/tiket/order kembar karena pola find-then-create (3 titik)**
- `models/Transaction.js` (`generateInvoiceNumber`), `models/ServiceTicket.js:239-259`, `models/SpecialOrder.js:131-146` — semuanya: cari terakhir (`sort` desc) → parse angka → +1 → insert. Tidak atomic.
- Dua request bersamaan → nomor sama → E11000 → 400. Untuk tiket: user lihat "tiket gagal dibuat", retry → nomor melompat; untuk transaksi: **stok sudah terpotong** (bug-C1). `claimWarranty` (`serviceController.js:621-625`) menambah varian: `GRS-` dibentuk dari sequence SRV terbaru → dua klaim bersamaan bisa kembar.
- Severity: **High** (dampak langsung ke bug-C1)
- Fix: counter atomic (`findOneAndUpdate({_id:'invoice'}, {$inc:{seq:1}}, {new:true})` atau sequence PG `nextval`), simpan `seq` terpisah dari dokumen agar tidak terpengaruh delete.

**[BUG-H16] `grand_total` transaksi bisa tidak sama dengan jumlah subtotal item (harga berubah di antara dua fase)**
- `controllers/transactionController.js:65-66` (subtotal & grandTotal dari harga fase validasi) vs `:101-102` (subtotal ditimpa harga `updated.selling_price` hasil `deductStockAtomic`)
- Skenario: fase 1 baca harga 100rb; sebelum fase 2, admin/kasir lain update harga jadi 120rb; `deductStockAtomic` mengembalikan dokumen baru (`Item.js:131-142`, `{new:true}`) → `ti.subtotal = 120rb × qty` tapi `grand_total` tetap `100rb × qty` → **invoice grand_total ≠ Σ item.subtotal**, cek `amount_paid` (baris 86) juga pakai angka lama.
- Severity: **High** (uang)
- Fix: hitung `grandTotal` ulang dari harga final setelah loop deduct, atau kunci harga (snapshot) saat fase 1 dan jangan timpa.

**[BUG-H17] Restore stok yang gagal ditelan `.catch()` → stok hilang permanen (3 titik)**
- `controllers/transactionController.js:290-294` (deleteTransaction), `controllers/serviceController.js:352-354` (removePartFromService), `transactionController.js:107` (rollback transaksi)
- Ketiganya memanggil `addStockAtomic(...).catch(err => console.error(...))` lalu **tetap melanjutkan** (hapus transaksi / pull part). Jika `addStockAtomic` gagal (item sudah di-soft-delete, koneksi drop, dsb.) → stok tidak kembali, tanpa sinyal apa pun.
- Skenario: admin hapus transaksi 3 hari lalu untuk koreksi; salah satu item sudah dinonaktifkan (`deleteItem`, `inventoryController.js:186`) → `addStockAtomic` tidak menemukan dokumen → stok item itu tidak dikembalikan → **stok fisik tidak pernah pulih**.
- Severity: **High**
- Fix: cek hasil restore; jangan hapus transaksi/part jika restore gagal (atau catat ke tabel `stock_audit` untuk rekonsiliasi manual).

**[BUG-H18] Restore backup via `collection.insertMany` mem-bypass hook: `isLowStock`/`total_cost`/hash tidak dihitung ulang**
- `services/backupService.js:225-232`, `controllers/backupController.js:106-112` — konsekuensi lanjutan dari C2: data hasil restore tidak melewati pre-save (`Item.js:155-158`, `ServiceTicket.js:220-226`). Password sudah ter-hash saat backup (aman), tapi flag `isLowStock` hasil restore = nilai lama (atau hilang) → alert salah; `total_cost` yang tersimpan dipakai apa adanya (jika backup lama → salah).
- Severity: **High** (integritas data pasca-restore)
- Fix: setelah restore, jalankan pass rekalkulasi (recompute `isLowStock` & `total_cost`) atau validasi ulang.

## 🟡 MEDIUM

**[BUG-M1] Dua flag aktif/nonaktif user: `status` (string) vs `isActive` (bool) tidak sinkron**
- `models/User.js:41-49`; `authController.js:81` cek `isActive` saat login, tapi `adminController.createTechnician` (baris 22-37) menyetel `status` saja → user bisa `status:'inactive'` namun `isActive:true` → tetap bisa login. Dua sumber kebenaran.
- Fix: satu flag saja (hapus `status` atau jadikan derived).

**[BUG-M2] `updateUser` dengan form-data: `isActive:"false"` (string) ter-cast jadi `true` oleh Mongoose**
- `controllers/authController.js:199` (`if (isActive !== undefined) user.isActive = isActive;`) — Boolean cast Mongoose: string non-kosong `"false"` → `true`.
- Skenario: frontend kirim `application/x-www-form-urlencoded` → admin mencoba nonaktifkan user → user malah **tetap aktif**.
- Fix: normalisasi `isActive = isActive === true || isActive === 'true'`.

**[BUG-M3] `adjustStock` mengirim `quantity` mentah (string) & merespons stok basi**
- `controllers/inventoryController.js:220-224` — validasi memakai `qty` (Number, baris 212) tapi method dipanggil dengan `quantity` asli (string dari body). `Item.addStock`/`deductStock` (`Item.js:111-128`) melakukan `$inc` dengan string → CastError → 500. Response (baris 224) mengirim dokumen `item` yang belum di-refresh (mutasi lewat `findOneAndUpdate`) → **UI menampilkan stok lama**, user mengira perintah tidak jalan.
- Fix: panggil dengan `qty`; re-fetch item setelah mutasi.

**[BUG-M4] `getTodaySummary` memakai tengah malam timezone server (UTC), sementara laporan revenue memakai WIB**
- `controllers/transactionController.js:239-242` (`setHours(0,0,0,0)` lokal) vs `reportController.js:134-135,145-146` (bounds `Date.UTC(...,17,0)` = 00:00 WIB).
- Skenario (container UTC): dashboard kasir "hari ini" = 07:00 WIB s.d. 07:00 WIB besok → transaksi pukul 06:00 WIB dihitung sebagai kemarin → **angka dashboard kasir ≠ laporan revenue harian untuk data yang sama**.
- Fix: seragamkan helper bounds WIB di kedua tempat.

**[BUG-M5] Laporan top-items / cashier / teknisi pakai midnight lokal, revenue daily/monthly pakai WIB**
- `reportController.js:439-445, 489-496, 537-544` (`setHours(0,0,0,0)` lokal) vs `:134-135, 231-234` (WIB). Endpoint laporan saling tidak konsisten untuk rentang yang membentang 00:00-07:00 WIB.
- Fix: satu helper `wibDayBounds(dateStr)` untuk semua.

**[BUG-M6] Parameter tanggal tanpa validasi → laporan diam-diam 0 atau 500**
- `reportController.js:130-135` (`getDailyRevenue`), `:356-364` (`getRevenueByRange`) — `parseInt` dari input bebas; `validateDateParam` ada (`:9-18`) tapi hanya dipakai di top-items/cashier/teknisi. `date='abc'` → `Date.UTC(NaN)` → hasil kosong (0 revenue, 200 OK) atau CastError 500.
- Fix: pakai `validateDateParam` di semua endpoint tanggal; tolak format salah dengan 400.

**[BUG-M7] `getFullRecap` 30 hari: tiket yang dihitung revenue harian (jalur toleran `picked_up_at null`) tidak cocok dengan filter `picked_up_at`**
- `reportController.js:54-55, 61` (`svcMatch` berbasis `history.picked_up_at`) vs `:169-172` (jalur `$or` toleran null). Tiket `Picked_Up` dengan `picked_up_at` null (dari alur lama) dihitung di daily revenue tapi hilang dari full-recap → **rekap ≠ jumlah harian**.
- Fix: samakan kondisi `$or` di `buildReportPipeline` untuk tiket.

**[BUG-M8] Klaim garansi tanpa pelindung duplikat: tiket yang sama bisa diklaim berkali-kali**
- `controllers/serviceController.js:611-640` — tidak ada flag `warranty_claimed`/unique key; hanya cek `warranty_expires_at` (baris 617). Dalam 7 hari, customer bisa klaim 5× untuk kerusakan yang sama → 5 tiket GRS gratis; tidak ada jejak bahwa itu klaim ulang. Nomor `GRS-` (baris 625) rawan duplikat bila dua klaim bersamaan (bug-H15).
- Fix: flag `warranty_claimed: true` pada tiket asal saat klaim + index unique `(klaim_dari_id)` (satu klaim per tiket); nomor GRS dari counter terpisah.

**[BUG-M9] `deleteTechnician` hard-delete → tiket servis yatim**
- `controllers/adminController.js:96` (`findByIdAndDelete`) — tiket yang mereferensikan teknisi (`ServiceTicket.js:84-94`) menjadi orphan: `getTechnicianWorkload` (`serviceController.js:420-437`) & reminder teknisi (`reminderService.js:214-218`) tidak menemukan user. Inkonsisten dengan `deleteUser` (soft, `authController.js:268`).
- Fix: soft delete / reassign tiket terbuka ke teknisi lain.

**[BUG-M10] Phone dengan awalan `0` gagal dikirim oleh bot piket (tidak dinormalisasi)**
- `bot/wahaClient.js:14-17` (langsung `phone@c.us`) dipakai `bot/dutyReminder.js:72`; sementara `whatsappService` menormalkan `0`→`62`. User dengan phone `0812...` (format yang **diwajibkan** schema `SpecialOrder.js:13`) → chatId `0812...@c.us` tidak valid → reminder piket gagal senyap (hanya console).
- Fix: normalisasi ke `62` di `wahaClient.sendReply` (satu titik).

**[BUG-M11] `test_warranty_logic.js` rusak & meng-kodifikasi state machine yang tidak pernah ada**
- `test_warranty_logic.js:21-26` — (a) `updateStatus('Completed')` dari `Queue` dipanggil di test dan **berhasil** — mengabadikan bug-H3 sebagai perilaku "benar"; (b) baris 22 `ticket.timestamps.picked_up_at` — properti `timestamps` **tidak ada** (harusnya `history.picked_up_at`), jadi assignment diam-diam no-op; (c) `updateStatus('Warranty_Process')` (baris 26) — status itu **tidak ada** di enum `ServiceTicket.js:149` maupun transisi `:297-305` → test pasti gagal. Ini bukti desain garansi (status Warranty_Process/Rejected) yang direncanakan tapi **tidak pernah diimplementasikan** — kemungkinan besar sumber keluhan "logic garansi ngaco".
- Fix: implementasikan status garansi eksplisit (atau hapus test), perbaiki typo, dan kunci transisi Queue→Completed.

**[BUG-M12] Format `date='YYYY-MM-DD'` di filter tiket tidak divalidasi (Invalid Date → 500/0)**
- `controllers/serviceController.js:150-157` — `parseInt` input bebas; `new Date(NaN,...)` → CastError atau filter kosong.
- Fix: validasi + 400.

**[BUG-M13] Cron reminder bisa tumpang tindih jika satu run > 1 jam**
- `services/reminderService.js:27-30` (cron tiap jam 08-15 tanpa guard reentrancy) — WA lambat → run berikutnya mulai sebelum selesai → notifikasi ganda.
- Fix: guard `isRunning`.

**[BUG-M14] `saveNota` menimpa PDF yang sama (tiket sama + tanggal sama)**
- `utils/notaStorage.js:9-13` — regenerasi nota di hari yang sama menimpa file → riwayat PDF hilang; `listNotas` (`notaController.js:78-91`) menampilkan satu file.
- Fix: tambah timestamp di filename.

**[BUG-M15] Backup menyertakan `system_logs` (bloat) & password hash tanpa enkripsi**
- `services/backupService.js:62-67`, `backupController.js:21-28` — catatan keamanan/operasional: file backup berisi hash password semua user (perlu select `+password`) dan ribuan log; pastikan backup disimpan terenkripsi/terproteksi.
- Fix: keluarkan system_logs dari backup (atau batasi), enkripsi file.

## 🟢 LOW

**[BUG-L1] Tidak ada PPN sama sekali (0% di semua perhitungan)**
- `transactionController.js:65-66,125` (grand_total), `ServiceTicket.js:220-226` (total_cost), `SpecialOrder.js` (estimated_price) — tidak ada komponen pajak 11% UU HPP/PPN di invoice manapun. Jika bengkel PKP, semua tagihan under-billed; laporan pajak tidak bisa dihasilkan.
- Fix: tambah kolom `tax`/`tax_rate` + hitung di pre-save, tampilkan di PDF.

**[BUG-L2] Pembulatan tampilan vs nilai sebenarnya (nota PDF)**
- `pdfService.js:412-419` (`maximumFractionDigits: 0` membulatkan) — `service_fee`/harga bisa pecahan → nota menampilkan angka bulat, tapi QR/DB menyimpan nilai asli → verifikasi QR (`server.js:126-140`) ≠ angka tercetak. Hindari harga pecahan di input (validasi integer rupiah).
- Fix: simpan rupiah sebagai integer (sen) atau terima pecahan dan tampilkan tanpa pembulatan.

**[BUG-L3] `duration_days` menghitung `Math.ceil` → servis 1 jam = 1 hari**
- `models/ServiceTicket.js:342-346` — laporan durasi teknisi selalu ≥1 hari. Fix: tampilkan jam jika < 24 jam.

**[BUG-L4] `getAllTickets`/`getAllTransactions` tanpa validasi `page`/`limit` negatif → skip negatif**
- `serviceController.js:161`, `transactionController.js:174` — `page=-1` → `skip(-20)` → error Mongo atau hasil aneh. Fix: clamp.

**[BUG-L5] `updated_at` tidak ter-update pada mutasi stok atomic**
- `models/Item.js:145-147` (`findByIdAndUpdate` tidak memicu timestamps) — kolom `updated_at` basi untuk perubahan stok. Fix: `$set: { updated_at: new Date() }` di update atomic.

**[BUG-L6] `notifyServiceStatus`/`updateStatus` mengirim email+WA berulang jika status `Completed` di-set berkali-kali (reopen)**
- `serviceController.js:239-247` — setiap transisi ke Completed (termasuk balik lagi via H3) mengirim email & WA lagi. Fix: kirim hanya jika `completed_at` baru di-set.

---

# PETA MODEL DATA (MongoDB → PostgreSQL)

Catatan umum migrasi: `_id` ObjectId (12-byte) → **BIGINT identity** (atau UUID v4); buat tabel `migration_id_map(old_id text, new_id bigint)` untuk memetakan referensi lama. Sub-dokumen yang di-query/di-join → **tabel relasi**; yang jarang di-query → **JSONB**. Uang: **NUMERIC(14,2)** atau BIGINT (sen) — jangan `float`. Timestamps → **TIMESTAMPTZ**. Nomor invoice/tiket → **sequence PG** (`nextval`) — menyelesaikan bug-H15.

### `users` (models/User.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | + mapping table |
| `name` | String req | `name VARCHAR(100) NOT NULL` | |
| `username` | String unique lowercase | `username VARCHAR(50) UNIQUE NOT NULL` | |
| `password` | String select:false | `password_hash VARCHAR(255) NOT NULL` | bcrypt |
| `role` | enum admin/teknisi/kasir | `role VARCHAR(10) NOT NULL CHECK (role IN ('admin','teknisi','kasir'))` | |
| `phone` | String | `phone VARCHAR(20) DEFAULT ''` | |
| `status` | enum active/inactive | **hapus** (gabung ke isActive) | lihat bug-M1 |
| `isActive` | Boolean | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | |
| `jabatan` | String | `jabatan VARCHAR(100)` | |
| `created_at`/`updated_at` | Date | `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()` | trigger update |

### `items` (models/Item.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | |
| `sku` | String unique uppercase | `sku VARCHAR(50) UNIQUE NOT NULL` | |
| `name` | String req | `name VARCHAR(200) NOT NULL` | + GIN tsvector utk $text |
| `category` | enum | `category VARCHAR(20) NOT NULL CHECK (category IN ('Sparepart','Accessory','Software','Service','Other'))` | |
| `purchase_price` | Number min 0 | `purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0)` | |
| `selling_price` | Number | `selling_price NUMERIC(14,2) NOT NULL CHECK (selling_price >= purchase_price)` | |
| `stock` | Number int min 0 | `stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)` | |
| `min_stock_alert` | Number int | `min_stock_alert INTEGER NOT NULL DEFAULT 5` | |
| `description` | String | `description TEXT` | |
| `isActive` | Boolean | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | |
| `isLowStock` | Boolean | **hapus kolom** — pakai view/query `stock <= min_stock_alert` | lihat bug-H6 |
| `created_at`/`updated_at` | Date | `TIMESTAMPTZ` | |

### `service_tickets` (models/ServiceTicket.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | |
| `ticket_number` | String unique | `ticket_number VARCHAR(30) UNIQUE NOT NULL` | + sequence `srv_seq` |
| `customer` | subdoc {name, phone, is_wa_valid, email, type} | **tabel `customers`** (id, name, phone, is_wa_valid, email, type) + `customer_id BIGINT FK` — atau `customer JSONB` | normalisasi disarankan (dipakai filter `customer.phone`) |
| `device` | subdoc | `device JSONB NOT NULL` | photos di dalamnya |
| `technician` | subdoc {id, name} | `technician_id BIGINT NOT NULL REFERENCES users(id)`, `technician_name VARCHAR(100)` (denormalisasi) | |
| `status` | enum 7 nilai | `status VARCHAR(20) NOT NULL CHECK (status IN (...))` + aturan transisi di app layer (atau trigger) | perketat (bug-H3) |
| `parts_used` | array subdoc | **tabel `service_ticket_parts`** (id, service_ticket_id FK, item_id FK, name, qty INT, price_at_time NUMERIC, subtotal NUMERIC) | |
| `service_fee` | Number min 0 | `service_fee NUMERIC(14,2) NOT NULL DEFAULT 0` | |
| `payment_method` | enum QRIS/Transfer/Cash | `payment_method VARCHAR(10) CHECK (...)` | + tambah 'Card' agar konsisten dgn Transaction |
| `payment_proof` | String | `payment_proof TEXT` | URL |
| `total_cost` | Number | `total_cost NUMERIC(14,2) NOT NULL DEFAULT 0` | generated/trigger dari parts+service_fee |
| `notes` | String | `notes TEXT` | |
| `warranty_expires_at` | Date | `warranty_expires_at TIMESTAMPTZ` | |
| `klaim_dari_id` | ObjectId ref self | `claim_from_id BIGINT REFERENCES service_tickets(id)` | |
| `history` | subdoc 6 tanggal | kolom flat: `created_at, diagnosed_at, completed_at, picked_up_at, last_customer_reminder_at, last_technician_reminder_at TIMESTAMPTZ` | |
| `duration_days` | virtual | generated column / app layer | |

### `transactions` (models/Transaction.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | |
| `invoice_no` | String unique | `invoice_no VARCHAR(30) UNIQUE NOT NULL` | + sequence `inv_seq` |
| `cashier_id` | ObjectId ref User | `cashier_id BIGINT NOT NULL REFERENCES users(id)` | |
| `cashier_name` | String | `cashier_name VARCHAR(100)` | denormalisasi |
| `items` | array {item_id,name,qty,price,subtotal} | **tabel `transaction_items`** (id, transaction_id FK, item_id FK, name, qty INT, price NUMERIC, subtotal NUMERIC) | |
| `grand_total` | Number | `grand_total NUMERIC(14,2) NOT NULL` | |
| `payment_method` | enum Cash/Transfer/QRIS/Card | `payment_method VARCHAR(10) NOT NULL CHECK (...)` | |
| `amount_paid` | Number | `amount_paid NUMERIC(14,2) NOT NULL` | |
| `change` | Number | `change NUMERIC(14,2)` generated `amount_paid - grand_total` | |
| `notes` | String | `notes TEXT` | |
| `date` | Date | `date TIMESTAMPTZ NOT NULL DEFAULT now()` | index |

### `special_orders` (models/SpecialOrder.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | |
| `order_number` | String unique | `order_number VARCHAR(30) UNIQUE NOT NULL` | + sequence `ord_seq` |
| `customer` | subdoc {name, phone, type} | `customer_id BIGINT REFERENCES customers(id)` atau `customer JSONB` | phone REQUIRED di schema |
| `item_name` / `item_description` | String | `item_name VARCHAR(255) NOT NULL`, `item_description TEXT` | |
| `estimated_price` | Number min 0 | `estimated_price NUMERIC(14,2) NOT NULL DEFAULT 0` | |
| `down_payment` | Number min 0 | `down_payment NUMERIC(14,2) NOT NULL DEFAULT 0` | |
| `status` | enum 6 | `status VARCHAR(20) NOT NULL CHECK (...)` + transisi ketat | lihat bug-H13 |
| `payment_status` | enum Belum Lunas/Lunas | `payment_status VARCHAR(20) NOT NULL DEFAULT 'Belum Lunas'` | + `paid_amount NUMERIC` (fix H1) |
| `handled_by` | subdoc {id,name} | `handled_by_id BIGINT REFERENCES users(id)`, `handled_by_name VARCHAR(100)` | |
| `photo` | String | `photo TEXT` | |
| `service_ticket` | ObjectId ref | `service_ticket_id BIGINT REFERENCES service_tickets(id)` | |
| `notes` | String | `notes TEXT` | |
| `history` | subdoc | `created_at, ordered_at, arrived_at, picked_up_at, last_customer_reminder_at TIMESTAMPTZ` | |

### `duty_schedules` (models/DutySchedule.js)
| Field Mongo | Tipe | Kolom PostgreSQL |
|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` |
| `user` | ObjectId ref User | `user_id BIGINT NOT NULL REFERENCES users(id)` |
| `day` | enum senin-jumat | `day VARCHAR(10) NOT NULL CHECK (day IN ('senin','selasa','rabu','kamis','jumat'))` |
| `created_at`/`updated_at` | Date | `TIMESTAMPTZ`; `UNIQUE (user_id, day)` |

### `system_logs` (models/SystemLog.js)
| Field Mongo | Tipe | Kolom PostgreSQL | Catatan |
|---|---|---|---|
| `_id` | ObjectId | `id BIGSERIAL PRIMARY KEY` | |
| `level` | enum | `level VARCHAR(10) NOT NULL CHECK (level IN ('INFO','WARN','ERROR'))` | |
| `source` | String | `source VARCHAR(50)` | |
| `message` | String | `message TEXT NOT NULL` | |
| `details` | Mixed | `details JSONB` | |
| `timestamp` | Date + TTL 30 hari | `timestamp TIMESTAMPTZ NOT NULL DEFAULT now()` | PG tidak punya TTL index → job `pg_cron` hapus >30 hari, atau partisi bulanan |

### Bonus — tabel baru yang disarankan saat migrasi
- `stock_audit` (item_id, delta, reason, ref_type, ref_id, created_at) — menyelesaikan rekonsiliasi bug-H17/C1.
- `order_payments` (order_id, amount, method, paid_at) — menyelesaikan bug-H1/H2.
- `counters` / sequence per tipe nomor — menyelesaikan bug-H15.

---

## Kesimpulan & Prioritas Perbaikan
1. **Critical (sekarang):** C1 (transaksi atomic + nomor anti-race), C2 (restore aman) — keduanya menyebabkan kehilangan data/stok.
2. **High (minggu ini):** H1+H2 (uang order tidak pernah sinkron — kemungkinan besar "kasir ngaco" yang dikeluhkan), H3+H13+H14 (status flow loncat — "status servis ngaco"), H6/H7 (stok tampilan & nilai salah), H10/H11 (reminder mati/salah hari), H9 (keamanan), H12 (email order mati).
3. Migrasi PG: ikuti peta di atas + gunakan transaksi & sequence native — secara desain menyelesaikan sebagian besar race condition kelas C1/H15.

**Catatan:** Tidak ada file yang diubah; semua temuan bersumber dari pembacaan penuh file dengan nomor baris yang terverifikasi di sesi ini. Jika ingin, saya bisa mengubah setiap temuan di atas menjadi format GitHub issue siap-paste (judul + body + label severity).