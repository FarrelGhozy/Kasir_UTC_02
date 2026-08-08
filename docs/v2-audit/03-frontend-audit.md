Saya telah membaca seluruh file frontend secara lengkap pada `/home/ghozy/Kasir_UTC_02/frontend/public/` — kedua HTML, `app.js`, `auth.js`, `api.js`, 8 modul JS (`dashboard`, `pos`, `pelayanan`, `service`, `order`, `reports`, `inventory`, `admin`), dan `css/styles.css`. Berikut analisis lengkap untuk roadmap migrasi React.

---

# 1. PETA HANYA Halaman/Fitur/Screen Yang Ada Sekarang

Arsitektur saat ini = **2 file HTML independen** + **router manual berbasis `data-page`** di dalam `index.html`.

## Arsitektur Dasar
| Aspek | Detail |
|---|---|
| **Entry (kasir/admin)** | `index.html` — SPA tiruan: login + sidebar (`#sidebar` desktop, `#bottom-nav` mobile) + `#app-content`, router via `app.js` (`data-page` attribute, `app-ready` event + anti-race-condition) |
| **Entry (manajemen teknisi)** | `admin-teknisi.html` — halaman TERPISAH berdiri sendiri (Tailwind CDN), tabel CRUD teknisi |
| **State/auth** | `localStorage` (`token`, `user`), `auth.js` |
| **API layer** | `api.js` (singleton fetch wrapper + helper) |
| **Library eksternal** | Bootstrap 5.3.2, Bootstrap Icons, Chart.js, Tailwind (hanya admin-teknisi), jsPDF+autotable, pastaparse, pako, browser-image-compression — dimuat **dinamis via `loadScript`** |

## Daftar Lengkap Screen (SPA index.html — 6 halaman + login)

| # | Data-page / Screen | Fungsi | Elemen UI utama |
|---|---|---|---|
| 0 | **Login** (`#login-screen`) | Otentikasi username+password, toggle lihat sandi, animasi shake, cek status WAHA (modal peringatan) | Card login, form, error alert |
| 1 | **dashboard** (`Dashboard`) | Ringkasan KPI + grafik + aktivitas | 4 `StatCard` (Pendapatan hari ini, Penjualan retail, Servis aktif, Stok menipis), Chart.js bar (pelanggan 30 hari) + line (penghasilan 30 hari) + badge tren, daftar low-stock, daftar aktivitas gabungan (retail+servis), skeleton loading |
| 2 | **pos** (`POS`) | Kasir: grid produk ↔ keranjang → bayar → cetak struk | Search (debounce 300ms), filter kategori, `product-grid` (kartu stok/status), cart table (+/-/hapus), metode bayar (Cash/Transfer/QRIS/Card), input uang, tombol quick-denominasi (+10rb/dst), kembalian, tombol "BAYAR & CETAK", print struk via hidden iframe |
| 3 | **pelayanan** (menggabung `Service` + `Order`) | 2 tab: **Servis** & **Pesanan Barang** + Riwayat Nota | Tab toggle, panel service (form tiket kiri + daftar tiket kanan), panel order (form pesanan kiri + monitoring kanan), modal `notaHistoryModal` (search + filter tipe) |
| 3a | **Servis — detail fitur** (`Service` modul) | Buat/edit tiket servis, manajemen status, part, finalize, pay, garansi, log | Form tiket (informasi pelanggan, **upload foto 4 sisi** + bulk, jenis/merek/model/SN, keluhan auto-expand, kelengkapan, password, **Pattern Lock** 9-titik, teknisi, estimasi jasa), daftar tiket (card w/ badge status, durasi antrian, tombol aksi), status-select, `paymentModal`, `finalizeModal`, `addPartModal`, `editModal`, `detailModal`, `logsModal` (admin), WA-resend/notify-teknisi |
| 3b | **Pesanan Barang** (`Order` modul) | Buat/monitor pesanan khusus | Form (nama pelanggan, WA, nama barang, deskripsi, est harga+DP, penanggung jawab, foto barang), list monitoring (status Badge, DP, sisa bayar, toggle bayar lunas, transisi status stateful), edit modal, cetak nota |
| 4 | **inventory** (`Inventory`) | Manajemen gudang **REVISI**: CRUD barang, stok, sort header, filter, import/export CSV + template + dragdrop | Search, filter kategori, tabel (SKU, nama, kategori, harga beli/jual, stok, status, aksi), sorting klik header, `itemModal`, `stockModal` (restock/koreksi), `importModal` (PapaParse, drag-drop), export CSV BOM |
| 5 | **admin** (`Admin` — hanya admin) | 3 tab: **Laporan & Analitik, Manajemen Pengguna, Backup & Restore** | Tab toggle, user CRUD form + jadwal piket checkbox (Senin–Jumat 21:30), daftar user tabel, `editTechModal`, backup panel (export `.json`/`.json.gz`, import restore warning keras, daftar backup server) |
| 5a | **Laporan** (`Reports` modul, sub-halaman admin) | 4 tab laporan + unduh rekap PDF | Tab daily/monthly/top-items/performance (lock icon + guard non-admin), `renderDailyReport`, `renderMonthlyReport`, `renderTopItemsReport`, `renderPerformanceReport` (kasir & teknisi), tombol "Unduh Rekap Lengkap" → `recapRangeModal` (30 hari / semua) → generate PDF multi-halaman osspline Chart.js-to-canvas |

## 7. Halaman terpisah (admin-teknisi.html)
| Screen | Fungsi | Elemen |
|---|---|---|
| **Manajemen Teknisi** (terpisah) | CRUD teknisi, hanya role admin (guard alert), akses via sidebar "Pengaturan" namink dari index | Navbar Tailwind, tombol Tambah, tabel (nama/avatar inisial, username, WA+62-formatted, status badge, edit/hapus), modal form (cacat password opsional saat edit), validasi & format WA |

> **Catatan penting**: Fitur laporan (reports) HANYA bisa diakses lewat tab "Pengaturan Sistem" → "Laporan & Analitik" oleh admin; non-admin melihat tajuk laporan dengan icon lock + pesan "Akses Terbatas".

---

# 2. Masalah UI/UX Existing (dikumpulkan dari kode)

### A. Arsitektur / Flow
| # | Masalah | Lokasi | Dampak |
|---|---|---|---|
| A1 | **Router buatan sendiri, tidak ada deep-linking/back button** | `app.js` | Tidak bisa refresh di halaman tertentu / share URL / hapus browser back; state hilang |
| A2 | **2 aplikasi terpisah** (`index.html` vs `admin-teknisi.html`) dengan styling berbeda (Bootstrap vs Tailwind) | — | Inkonsisten visual, duplicate code, navigasi pindah antara halaman berbeda |
| A3 | **Login ganda/boot race-condition** — `auth.js` `dispatchEvent('app-ready')` + juga `app.js` cek manual `auth.isAuthenticated()` | `app.js`/`auth.js` | complexity, opsi bug; sinkronisasi event rapuh |
| A4 | **Error global pada 401 = `window.location.reload()` lebih banyak men copy** | `api.js` `handleResponse` | Reload kasar hilangkan pesan konteks |
| A5 | **`onclick` inline + global `window.app/window.service/window.orderModule/window.adminModule`** | Semua modul | Sulit di-debug, global namespace kotor, XSS/escaping pressure |

### B. Layout & Visual
| # | Masalah | Lokasi |
|---|---|---|
| B1 | **Sidebar width navbar besar & statik (`--sidebar-width: 280px`)**; overlay mobile; banyak `max-height: calc(100vh - Xpx)` magic numbers | `styles.css` |
| B2 | **POS daging dinamis `height: 600px` hard-coded** di `card-body` (produk) → rusak di layar tertentu | `pos.js:47` |
| B3 | **Banyak `!important` dan inline `<style>` hack per modul** (service inject `<style>`; pattern-lock `!important` massif) → sulit maintenance | `service.js`, `styles.css` |
| B4 | **Dua tempat alamat berbeda**: struk = "Jln. Raya Siman, Ponorogo" sedangkan PDF = "Jl. Raya Unida No. 1, Ponorogo" → duplikasi / data tak konsisten | `pos.js` vs `reports.js` |
| B5 | **Inkonsisten brand/copy**: "BENGKEL UTC" (struk/PDF) vs "Unida Technology Centre" (admin) vs "Bengkel UTC - Sistem Manajemen Bengkel" (title) | semua |

### C. Responsivitas & Aksesibilitas
| # | Masalah |
|---|---|
| C1 | Sebagian backend gede sudah responsive (media queries 991/768/400px) tetapi banyak **inline width fixed** (input `width:200px`, `width:150px`) yang meletup pada layar kecil |
| C2 | **Banyak ikon-only button tanpa aria-label / title** (mis. tombol icon-only di tabel) → a11y buruk |
| C3 | Tab `<a>` memakai `href="#"` tanpa `role="tab"`, `aria-selected` tidak dikelola → screenreader salah |
| C4 | Modal `detailModal`, `logsModal` sering `tabindex`/`aria` nggak lengkap; confirm modal reusable tapi button "Hapus" fixed pod ika context batal |
| C5 | `#login-screen` background image `../assets/unidapuenya.jpg` di CSS tapi file yang ada justru `css/unidapoenya.jpg` (perhatikan zebra misspelled `unidapoenya.jpg` vs `unidapuenya.jpg` in body!) → **background bag possível broken** |

### D. Error / Feedback Message
| # | Masalah | Lokasi |
|---|---|---|
| D1 | **Percampuran alert JS bawaan** (`alert()`) dengan toast/modal: `alert('Akses Ditolak...')`, `alert('Data berhasil dipulihkan...')` di admin restore/import & admin-teknisi | `admin.js`, `admin-teknisi` |
| D2 | **Error message generik & teknis** (mis. "Server mengembalikan format respons yang tidak valid") bocor internal detail, tidak user-friendly |
| D3 | Toast auto-dismiss 3s — pesan penting (impor, hapus) bisa terlewat sebelum dibaca |
| D4 | Konfirmasi hapus/permanen tidak konsisten: `confirm()` native vs `confirmDialog()` modal vs `alert`. Tombol dialog reusable selalu label "Hapus" padahal bisa "Batal"/"Ya, Ubah" |

### E. Efisiensi
| # | Masalah |
|---|---|
| E1 | **Banyaknya masked untuk susah** - mis. untuk ubah status order: dropdown select → sinkronize, belum tanggal konfirm maji inline |
| E2 | Cetak struk lewat iframe hidden `window.print()` — muncul dialog print sistem yang tidak selalu ada di device kasir (mobile) |
| E3 | **Chart.js dimuat via CDN** setiap dashboard/reports — offline gagal sepenti (fragile) |
| E4 | Foto-foto diupload & compressed per-file loop serial tanpa progress bar per item |

---

# 3. Struktur React Router yang Diusulkan (Route lengkap, TIDAK ADA fitur yang hilang)

> Semua fitur existing dipetakan → route + komponen halaman. Struktur direktori `src/`.

| Path (React Router) | Komponen Halaman | Menggantikan / Fitur |
|---|---|---|
| `/login` | `LoginPage` | Login screen + toast + WAHA status modal |
| `/` (Index) | `DashboardPage` | Dashboard (StatCard, charts, low-stock, aktivitas) |
| `/pos` | `PosPage` | Grid produk, keranjang, bayar, struk |
| `/pelayanan` | `PelayananPage` (tab parent) | wrapper Servis+Pesanan |
| `/pelayanan/servis` | `ServicePage` | Form tiket + daftar tiket + action modal |
| `/pelayanan/servis/:id` | `ServiceDetailPage` (bisa jadi route / modal) | Modal detail tiket (info, timeline, cost) |
| `/pelayanan/pesanan` | `OrderPage` | Form pesanan + monitoring |
| `/pelayanan/pesanan/:id` | `OrderDetailPage` | Modal detail/edit pesanan |
| `/gudang` | `InventoryPage` | Tabel gudang (list/filter/sort/CRUD) |
| `/gudang/barang/:id` | `InventoryItemFormPage` (atau modal) | betambah/edit barang |
| `/laporan` | `ReportsPage` | Tab reports (harian/bulanan/top/performa) |
| `/laporan/rekap/pdf` | `RecapPdfGenerator` | Unduh rekap PDF (30d/all) |
| `/pengaturan` | `AdminSettingsPage` | Admin 3 tab |
| `/pengaturan/pengguna` | `UserManagementPage` | CRUD user + jadwal piket |
| `/pengaturan/backup` | `BackupPage` | export/import/restore backup |
| `/pengaturan/teknisi` | `TechnicianManagementPage` | MAKN: admin-teknisi.html standalone → jadi route |
| `/nota` | `NotaHistoryPage` | Riwayat nota modal |
| `/error/403` | `ForbiddenPage` | Access denied (non-admin reports) |
| `/error/404` | `NotFoundPage` | Halaman tak ada |
| `/error/500` | `ServerErrorPage` | Error global |

**Protective wrapper**: `<ProtectedRoute>` (cek token+role), `<RoleGate allow={['admin']}/>`, guard `restore` retry. Semua stateless, pakai React Router data-fetching + `useQuery`.

---

## 4. Design System UI Reusable (Komponen)

| Komponen | Spesifikasi singkat (prop) |
|---|---|
| **`Button`** | variant (primary/primary-soft/outline/ghost/danger/warning), size (sm/md/lg), loading, icon hanya, disabled |
| **`Card`** | header (title + actions), body, footer, optional hoverable, toning (default/success/danger) |
| **`StatCard`** | u39selabel icont/ logo bound (icon, label, value, trend, tone) — selimut dashboard |
| **`DataTable`** | columns, data, loading/empty state, sortable header, search slot, pagination, row click |
| **`Modal`** | size, title, footer actions, `confirm`/`danger` preset, focus/escape/scroll lockdown, das (dialog) |
| **`ConfirmDialog`/`AlertDialog`** | variant (danger/warning), title, message, confirm/cancel label (params para nggak fixed "Hapus") |
| **`Toast`** | type (success/error/warning/info), position, duration, action button, stack/animation |
| **`FormField`/`Input`** | label, required*, error msg, help text, prefix icon/unit, currency mask, number |
| **`CurrencyInput`** | berbasis Controlled `format-currency-id` (IDR, ribuan. perautomatic), focus selection intact |
| **`Sidebar` / `Navbar` / `MobileBottomNav`** | responsive layout shell |
| **`StatusBadge`** | mapping (Queue/Antrian, Diagnosing/Diagnosa, Waiting_Part/Tunggu Part, In_Progress, Completed, Picked_Up, Cancelled) + order (Pending/Searching/Ordered/Arrived/Picked_Up)+ stock (Aman/Sedang/Menipis) |
| **`EmptyState`** | icon, title, message, action button — user semua list kosong |
| **`PhotoUploadGrid`** | 4-slot (front/back/left/right) + bulk upload + preview + remove + compress |
| **`PaymentMethodSelector`** | radio-Card (Cash/QRIS/Transfer) + amount/cabback |
| **`FileUploadZone`** | drag-drop + file name + fallback click (CSV/backup) |
| **`SwitchToasts/Skeleton`** | skeleton loading shimmer |
| **`TimeAgo` / `DurationLabel`** | lama antrian/servis, highlight >24/48 jam |
| **`BarcodeInput` / `QuickPayButtons`** | POS-specific |

---

## 5. Halaman Baru untuk Menaikkan Profesionalisme (added value)

| Prioritas | Halaman/Komponen | Why |
|---|---|---|
| P1 | **Landing login redesain** — branding konsisten, wallpaper, hint akun dev, lebih baik dari `#login-screen` simple | First impression |
| P1 | **`EmptyStates`** di seluruh list (inventory, servis, order, report) — icon+CTA | Menghindari kartu kosong polos |
| P1 | **`NotFoundPage (404)`**, **`ForbiddenPage (403)`**, **`ServerErrorPage (500)`** profesional | Saat maintenance/eks | Salah role |
| P2 | **Global error boundary + offline indicator** | Ketahanan |
| P2 | **Notification center/bell** (gabung low-stock, WAHA down, servis >48jam) — prompt | Proactive |
| P2 | **Dashboard lebih data-driven"**: grafik tren bulanan, breakdown kategori di POS | efisiensi kasir |
| P3 | **Print receipt preview** (focus terus di konfirm cetak, bukan dialog OS auto) | workflow kasir |
| P3 | **Payment proof upload flow sudah ada** tapi perlu jadi komponen reusable + konfirmasi |
| P3 | **Pengaturan profil user + change password halaman** (sementara hanya bisa via admin) | Self-service |

---

## 6. Evaluasi UX Flow (Skor /5) & Rekomendasi

| Flow | Frekuensi | Skor UX saat ini | Pain point | Rekomendasi perbaikan |
|---|---|---|---|---|
| **Login** | Setiap session | **3.5/5** | Card simpel, error hanya `alert` div, tak ada "remehkan terakhir", race reload | Route login dedika, remember me, password strength legend, show/hide sudah ada, landing branding, error inline friendly |
| **Buat tiket servis** | Inti operasi | **3/5** | Form SANGAT panjang (pelanggan+4 foto+perangkat+password+pattern+tugas) — 1 kolom sidebar, banyak scroll; WA validasi async tapi tombol tetap aktif; photos compress baca | Split jadi **multistep wizard** (1: Pelanggan, 2: Foto&Unit, 3: Masalah&Keamanan, 4: Rangkuman/Save), simpan draft, autosave |
| **Kasir/POS** | Core daily | **4/5** | Grid produk ↔ keranjang ok; tapi **cetak struk = iframe+print dialog**, di device mobile mesti safari; `height` hard-coded; tanpa penghitung UI tampilan; konfirmasi `confirm()` blokir | route `POS`, receipt preview modal + export PDF/nota server integration, responsive grid, tetap qty-qty di toto jalur (clamp), pay flow dengan recap ringkas |
| **Laporan** | Occasional (harian mingg) | **3.5/5** | Buka lewat "Pengaturan Sistem" → double click ke "Laporan" awlim rote; ada lock icon → pesan "akses terbatas" (OK); PDF generate via CDN + Chart can-container (berat) | Pecah route `/laporan` lebih visible di sidebar untuk semua; jadwalkan render jika CDN gagal (offline fallback bundle); PDF status progress toast; grafik interaktif tooltip |
| **Inventaris** | P2 | **4/5** | CRUD rapi, import/export bagus; namun perlu akses terpisah tanpa route global; tabel tanpa pagination untuk >100 item (semakin select API limit 100) | Tambah pagination/server-side search, route `/gudang` clean, bulk adjust stock |
| **Pesanan Barang** | Support | **3.5/5** | Good transition status; tapi `.catch`/double-click risk, buat foto order manual; sisa doket lunas | God if solvia, foto compress, inline payment toggle fine, notifikasi ke cust saat status berubah via WA sudah ada |

---

## Ringkasan untuk GitHub Issues Roadmap

| Prioritas | Issue Group | Ringkasan |
|---|---|---|
| **1. Foundation** | Setup React + Tailwind + React Router | Vite/CRA + struktur, route map (langkap), folder `src/`, env |
| **2. Auth & Routing** | Upgrade `auth.js` → Context/Provider + `RequireAuth`/`RoleGate` | Ganti localStorage-driven race dengan auth flow solid, 401 refresh |
| **3. Design System** | Migrate komponen reusable (§4) ke ra lipat, hapus semua `<style>` inline + `!important` dan hard-coded CSS |
| **4. Page Migrations** | Migre per halaman: Login→Dashboard→POS→Gudang→Pelayanan(Servis+Pesanan)→Admin(Laporan) |
| **5. New Polishes** | Landing login, empty states, error pages (403/404/500), sidebar baru |
| **6. UX/UX Flow rework** | Multi-step service form, POS print preview, laporan di sidebar, pagination gudang, feedback WA unify (hapus `alert()`) |

**Perhatian**: Aplikasi saat ini tidak punya `package.json`/build; modal, toast, dan semua state di `localStorage`. Migrasi React akan memerlukan **backend tetap sama** (`/api/*`) — `api.js` wrapper dengan token tetap bisa dipakai/diadaptasi menjadi axios/fetch hook. Ada **data brand/business info yang konsisten** untuk diputuskan (nama vs alamat bengkel).

---

### Ringkasan kerja yang dilakukan
- **Membaca lengkap** 12 file frontend (2 HTML, 3 JS core, 8 modul, 1 CSS) di `/home/ghozy/Kasir_UTC_02/frontend/public/`.
- **Pemetaan lengkap** (bagian 1): 6 screen di index.html + login + 1 halaman ekor (admin-teknisi) + semua fitur Service/Order/Reports sub-menu.
- **Identifikasi masalah** (bagian 2) kelompok A–E (arsitektur, layout, aksesibility, feedback, efisiensi).
- **Rekomendasi React Router** (bagian 3) ~20 route yang menutup SEMUA fitur existing.
- **Design system** (bagian 4): 20+ komponen reusable dengan spesifikasi prop.
- **Halaman baru** (bagian 5) untuk profesionalisme.
- **Evaluasi UX skor + rekomendasi** (bagian 6) per 6 flow.
- **Tidak ada file yang diubah/dibuat** — analisis read-only sesuai instruksi.

Tidak ada kendala teknis. (Satu catatan kecil: CSS merujuk `unidapuenya.jpg` sedangkan file ditemukan di folder css/ sebagai `unidapoenya.jpg` — diduga typo, untuk dicek saat migrasi agar background login tidak broken.)