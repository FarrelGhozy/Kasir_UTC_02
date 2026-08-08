Audit selesai. Semua file backend (31 file) sudah dibaca secara menyeluruh — berikut laporan lengkapnya.

---

# 🔐 LAPORAN AUDIT KEAMANAN — Backend Kasir_UTC_02 (Node.js/Express + MongoDB)

**Cakupan:** 31 file dibaca (middleware, routes, controllers, models, services, bot, Docker, env, seed). **Tidak ada file yang diubah.**

---

## 🚨 TEMUAN PALING PARAH (urut dari paling kritis)

### [CRITICAL] JWT Secret default diketahui publik → total authentication bypass
- **`docker-compose.yml:35`** — `JWT_SECRET=${JWT_SECRET:-change_this_in_production}`
- **`backend/server.js:18-21`** — startup hanya cek *keberadaan* `JWT_SECRET`, bukan nilainya.
- **Potongan kode:**
  ```yaml
  - JWT_SECRET=${JWT_SECRET:-change_this_in_production}
  ```
  ```js
  if (!process.env[env.name]) { console.error(...); process.exit(1); }
  ```
- **Dampak:** Jika deployment tidak mengeset `JWT_SECRET`, secret = string publik yang ada di repo. Siapa pun bisa forge JWT `{id: <ObjectId apa pun>, role: 'admin', isActive: true}` → akses penuh semua endpoint admin (backup export/import, user management, hapus data). Nilai yang sama juga di `.env.example:20` (`change_this_in_production_min_32_chars`).
- **Fix:** Wajib generate secret acak per-deployment (`openssl rand -hex 32`), hilangkan default di docker-compose (buat jadi *required* tanpa fallback), dan tambahkan validasi startup yang **menolak** nilai placeholder (mis. cek `JWT_SECRET` ≠ `change_this_in_production*`).

### [CRITICAL] Hardcoded credential WAHA & dashboard (API key + password di repo)
- **`docker-compose.yml:38, 95, 97, 99`** — `WAHA_API_KEY=adminutc28`, `WHATSAPP_SWAGGER_PASSWORD=adminutc28`, `WAHA_DASHBOARD_PASSWORD=adminutc28`, username `admin-utc01`.
- **Dampak:** Siapa pun yang tahu repo ini bisa mengambil alih session WhatsApp bisnis (baca semua chat pelanggan, kirim pesan sebagai bisnis, exfiltrasi data). `WAHA_URL` diekspos ke host di port `8000` (`docker-compose.yml:86`) — dashboard WAHA bisa diakses dari LAN.
- **Fix:** Pindah semua ke environment/secret manager (`.env` yang tidak di-commit, atau Docker secrets). Jangan pernah hardcode kredensial di compose file. Ganti password dashboard WAHA segera.

### [HIGH] CORS wildcard + `credentials: true` → origin apa pun di-reflect di production
- **`docker-compose.yml:41`** — `CORS_ORIGIN=*` + **`backend/server.js:61-83`**:
  ```js
  const isAllowed = allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*');  // baris 65-66
  ...
  credentials: true,   // baris 80
  ```
- **Dampak:** Karena callback mengembalikan `true`, header `Access-Control-Allow-Origin` di-reflect mengikuti origin peminta + `Access-Control-Allow-Credentials: true` → *situs jahat mana pun* bisa membuat request cross-origin ber-credential ke API dan **membaca respons** (data pelanggan, laporan, dll). Konfigurasi "strict CORS" di komentar (baris 60) tidak berlaku karena `CORS_ORIGIN=*` di compose.
- **Fix:** Hapus `*` dari produksi; set `CORS_ORIGIN=https://kasir.utc.web.id` eksplisit; jangan pakai `credentials: true` dengan origin wildcard.

### [HIGH] File upload & nota PDF disajikan publik TANPA autentikasi
- **`backend/routes/api.js:150-160`** — route `/api/uploads/:filename` **tidak memakai `protect`** padahal komentar bilang "(terproteksi auth)":
  ```js
  router.get('/uploads/:filename', (req, res) => {   // ← TANPA protect!
    const filename = path.basename(req.params.filename);
    ...
  ```
- **`backend/server.js:117, 120`** — `express.static` publik untuk `uploads/services` (foto perangkat + **payment_proof / bukti transfer**) dan `uploads/notas` (PDF nota berisi nama, no. HP, alamat, total biaya pelanggan).
- **Dampak:** Foto perangkat pelanggan, bukti pembayaran, dan PDF nota (PII) bisa diakses siapa pun tanpa login. Nama file nota bahkan *predictable* (`NOTA-SVC-{nomor}_{nama}_{tanggal}.pdf`).
- **Fix:** Taruh file di luar `public`/static, serve via route ber-`protect` dengan cek otorisasi, dan beri nama file acak (random token) yang tidak bisa ditebak.

### [HIGH] Role & isActive dari JWT dipercaya tanpa verifikasi ke database
- **`backend/middleware/auth.js:33-36`**:
  ```js
  req.user = { id: decoded.id, role: decoded.role };   // role langsung dari payload JWT
  ```
- **`auth.js:49-54`** — cek `decoded.isActive === false` hanya snapshot saat login (7 hari), bukan kondisi DB saat ini.
- **Dampak:** (1) User yang di-nonaktifkan/di-hapus **tetap bisa akses semua route sampai token expire (7 hari)** — `protect` tidak pernah query DB selama `role` ada di payload. (2) Admin yang di-demote ke kasir tetap punya `role: 'admin'` di token lama. (3) Token lama tanpa `isActive` claim lolos cek baris 49 (`undefined === false` → false).
- **Fix:** Setiap request, ambil user dari DB (`findById` + cek `isActive` + pakai `role` dari DB, bukan payload). Atau minimal verifikasi `decoded.id` masih eksis & aktif. Pertimbangkan token expiry lebih pendek + refresh token.

### [HIGH] Rate limiting login bisa di-bypass dengan spoof `X-Forwarded-For`
- **`backend/server.js:34`** — `app.set('trust proxy', true)` → `req.ip` diambil dari header `X-Forwarded-For` yang bisa dipalsukan attacker.
- **`server.js:92-107`** — `loginLimiter` (20 percobaan/15 mnt) dan `apiLimiter` keyed ke `req.ip`; opsi `validate: { trustProxy: false }` hanya menekan error validasi, **tidak** menonaktifkan pemakaian XFF.
- **Dampak:** Attacker tinggal ganti-ganti header `X-Forwarded-For` → brute-force password tanpa batas. Ini makin kritis karena password cuma min 6 karakter (`models/User.js:24`) dan akun default ada di seed.
- **Fix:** Pakai keyGenerator berbasis kombinasi IP + User-Agent, atau batasi trust proxy hanya ke proxy internal yang sudah dikonfigurasi (bukan `true`), aktifkan `validate.trustProxy`, dan tambahkan lockout berbasis username + delay eksponensial.

### [HIGH] Endpoint publik `verify-nota` bocorkan PII pelanggan (enumerable)
- **`backend/server.js:126-140`**:
  ```js
  app.get('/api/verify-nota/:model/:id', async (req, res) => {
    doc = await ServiceTicket.findById(id).select('ticket_number customer.name customer.phone status total_cost payment_method warranty_expires_at').lean();
  ```
- **Dampak:** Tanpa autentikasi, siapa pun bisa **enumerate MongoDB ObjectId** (berisi timestamp, mudah ditebak urutannya) untuk menarik nama, **no. HP**, status, metode & total pembayaran semua pelanggan.
- **Fix:** Token verifikasi acak (mis. hash SHA-256 dari id+ticket_number) di query, bukan id mentah; tambahkan rate limit pada endpoint ini.

---

## 🟠 MEDIUM

### [MEDIUM] Kredensial dummy/backdoor di seed — akun admin dengan password publik
- **`backend/seed.dummy.js:17-27, 68-70`** — `DummyPass123` (10 teknisi), `DummyAdmin456`, `DummyKasir456`, `DummyManajer456` (role admin). Dicetak ke console di baris 206-211. **`backend/README.md:76,110`** — dokumentasi `admin / admin123`.
- **Dampak:** Jika seed dijalankan di produksi (atau DB pernah di-seed), ada akun admin dengan password yang diketahui publik → backdoor permanen.
- **Fix:** Seed hanya untuk dev; jangan pernah jalankan di produksi; audit DB produksi untuk username `*_dummy` / `admin` dengan password default; hapus kredensial dari README.

### [MEDIUM] MongoDB tanpa autentikasi & port terekspos ke host
- **`docker-compose.yml:7-8`** — `ports: "27018:27017"` + image `mongo:8.2.11` tanpa user/password; `MONGODB_URI=mongodb://mongo_db:27017/bengkel_utc` (tanpa kredensial).
- **Dampak:** Siapa pun di host/LAN yang bisa menjangkau port 27018 dapat akses penuh ke database (baca/ubah/hapus semua data + hash password) — melewati semua autentikasi aplikasi.
- **Fix:** Aktifkan MongoDB auth (root user + password), jangan expose port ke host (hapus baris ports atau bind ke 127.0.0.1), set `--bind_ip` internal network saja.

### [MEDIUM] Docker socket di-mount ke container → host takeover
- **`docker-compose.yml:110-113`** — service `auto_restart` mount `/var/run/docker.sock:/var/run/docker.sock`.
- **Dampak:** Kontrol penuh Docker daemon dari dalam container = eksekusi kode sebagai root di host. Jika backend/WAHA (yang menerima input publik) dikompromikan, attacker langsung punya host.
- **Fix:** Ganti mekanisme restart (cron di host, systemd timer, atau `restart: always` + healthcheck). Jangan mount docker.sock.

### [MEDIUM] Backup restore via `insertMany` mem-bypass hook hash password
- **`backend/services/backupService.js:225, 228-232`** + **`backend/controllers/backupController.js:106`** — `User.collection.insertMany(...)` **tidak memicu `pre('save')`** yang meng-hash password (`models/User.js:65-71`).
- **Dampak:** Password di-insert apa adanya. File backup yang diedit/di-craft berisi password plaintext → akun tersimpan plaintext (login-nya rusak/error, dan plaintext bocor di DB). Plus: **`backend/docker-entrypoint.sh:6-7`** — `chmod -R 777 /app/backups` → file backup (berisi **hash password + seluruh data pelanggan**, `backupService.js:62`) world-readable di host volume.
- **Fix:** Pakai `User.create`/`insertMany` dengan re-hash eksplisit (loop `bcrypt.hash`), validasi format backup (password harus hash bcrypt), dan ganti chmod 777 dengan permission user-owned (e.g. 750).

### [MEDIUM] File upload: hanya cek MIME header, tanpa verifikasi isi (magic bytes)
- **`backend/utils/upload.js:66-72`** — `fileFilter` hanya `allowedMimeTypes.includes(file.mimetype)`; `file.mimetype` dikirim klien dan bisa dipalsukan. Limit ukuran 5MB OK (`upload.js:77-79`), filename di-sanitasi + random suffix (`upload.js:48-56`) → **path traversal & overwrite sudah aman**.
- **Dampak:** Polyglot / file berbahaya (HTML, SVG-XSS, shell) bisa disimpan sebagai `.jpg`/`.png`. Karena diserve statis tanpa auth, risiko stored-content abuse.
- **Fix:** Verifikasi magic bytes (mis. `file-type` package) + konversi ulang gambar (sharp), dan simpan di luar webroot dengan akses terkontrol.

### [MEDIUM] Tidak ada security headers (Helmet tidak dipakai)
- **`backend/server.js:3-7`** — imports: cors, compression, rateLimit — **tidak ada `helmet`**. Semua response tanpa `X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `Referrer-Policy`, dll.
- **Fix:** `app.use(helmet())` + sesuaikan CSP untuk frontend & QR.

### [MEDIUM] Token JWT lewat query string + semua URL di-log → token bocor ke log
- **`backend/middleware/auth.js:71-76`** — `protectQuery` menerima `?token=...` (untuk window.open PDF). **`backend/server.js:43-46`** — log semua request: `console.log(... ${req.method} ${req.originalUrl} ...)` → token tercetak di console/log server, dan bisa bocor via browser history/referrer.
- **Fix:** Hindari token di URL (pakai `fetch` blob + sessionStorage, atau one-time signed URL). Jangan log `originalUrl` penuh; log path saja.

### [MEDIUM] IDOR: semua role bisa baca semua tiket termasuk password perangkat
- **`backend/controllers/serviceController.js:203-217`** — `getTicketById` mengembalikan **seluruh dokumen** (`device.password`, `device.pattern`, PII pelanggan) ke siapa pun yang login, tanpa cek kepemilikan/scope teknisi. `updateTicketDetails` (`serviceController.js:445-497`) juga mass-assignment: teknisi bisa ubah `service_fee` (baris 497) tanpa validasi negatif/non-numerik (berbeda dengan `updateServiceFee` baris 372 yang ada ceknya).
- **Dampak:** Teknisi/kasir bisa intip password PIN perangkat semua pelanggan; CastError 500 untuk input invalid.
- **Fix:** Batasi scope (teknisi hanya tiket miliknya), gunakan `.select()` untuk mengecualikan `device.password`/`pattern` dari respons default, dan validasi `service_fee` (Number, >= 0, finite) di semua jalur.

### [MEDIUM] Webhook WAHA tanpa secret secara default
- **`backend/routes/webhook.js:30-35`** — `if (!secret) return true; // backward compat` — jika `WAHA_WEBHOOK_SECRET` kosong (default `.env.example:32`), endpoint `/api/waha-webhook` **terbuka publik**. Attacker bisa inject pesan palsu → memicu `markChatUnread` (abuse) dan log spam. `token` via query string juga bocor ke log.
- **Fix:** Wajibkan secret (reject startup jika kosong di production), bandingkan dengan timing-safe compare (`crypto.timingSafeEqual`), dan letakkan token di header saja.

### [MEDIUM] JWT 7 hari tanpa mekanisme revoke
- **`backend/controllers/authController.js:6-12`** — `expiresIn: '7d'`, tanpa daftar blacklist/refresh token.
- **Fix:** Perpendek expiry (15m-1h) + refresh token rotasi, atau setidaknya bump `tokenVersion` di User saat ganti password/nonaktif.

---

## 🟡 LOW

- **[LOW] Stack trace bocor jika NODE_ENV ≠ production** — `backend/middleware/errorHandler.js:64-68`: `...(process.env.NODE_ENV === 'development' && { stack: err.stack })`. docker-compose sudah set production, tapi `npm run dev` / tanpa env → bocor. *Fix:* default ke `'production'`, jangan pernah kirim stack.
- **[LOW] Password hash ikut diekspor** — `backend/controllers/backupController.js:21` & `backupService.js:62`: `User.find({}).select('+password')` — hash password + seluruh data pelanggan dalam satu file backup yang chmod 777. *Fix:* enkripsi file backup.
- **[LOW] Password perangkat disimpan & dikirim plaintext** — `backend/models/ServiceTicket.js:68-75` (`device.password`, `device.pattern`). *Fix:* enkripsi-at-rest atau minimal jangan tampilkan di respons.
- **[LOW] Input validation tidak konsisten** — `serviceController.js:372` (`service_fee < 0` gagal untuk null/string) & `:497` (tanpa validasi); `adminController.js:51-75` (`updateTechnician` tak validasi format phone/status). *Fix:* validasi tipe + rentang eksplisit di semua body input.
- **[LOW] `checkWANumber` membocorkan respons WAHA mentah** — `backend/controllers/waController.js:21-27` (`details: result`) — info internal session/error ke semua user login. *Fix:* return boolean saja.
- **[LOW] bcrypt cost 10 & password min 6 karakter** — `models/User.js:24, 69`. *Fix:* min 8-12 karakter, cost 12, tambah kompleksitas.
- **[LOW] Global rate limit longgar & webhook tanpa limit** — `server.js:99-104` (500 req/15 mnt per IP, spoofable). *Fix:* limit per-endpoint, per-user.
- **[LOW] Teknisi bisa lihat laporan pendapatan** — `routes/api.js:123-125` (`authorize('admin','kasir','teknisi')`). *Fix:* batasi ke admin/kasir.
- **[LOW] Log error menyimpan body request (sanitized) + stack di SystemLog 90 hari** — `errorHandler.js:12-27` — berisi nomor HP/data pelanggan; endpoint `GET /services/logs` admin-only. *Fix:* redaksi lebih ketat (hapus phone/email juga).
- **[LOW] Dependensi belum di-audit** — `backend/package.json:24-47`: `bcrypt ^6.0.0`, `multer ^2.1.1`, `express ^5.2.1`, `mongoose ^9.1.5`, `axios ^1.6.0`. Versi ini tergolong modern (multer 2.x sudah menutup CVE 1.x), **tapi belum ada bukti `npm audit` dijalankan**. *Fix:* jalankan `npm audit --omit=dev` di CI + `npm audit fix`; pasang renovate/dependabot. (Catatan: `scripts.seed` di package.json:9 menunjuk `seed.js` yang tidak ada.)

---

## ✅ AREA YANG SUDAH AMAN (diverifikasi, untuk roadmap "no-action")

| Area | Bukti |
|---|---|
| **NoSQL injection / `$where` / regex user-controlled** — TIDAK ditemukan. Semua regex berbasis konstanta prefix (nomor tiket): `ServiceTicket.js:245`, `Transaction.js:118`, `SpecialOrder.js:135`. Filter query dari user di-whitelist (`authController.js:140-144`, `reportController.js:27-33, 45-55`) | bersih |
| **Hashing password** — bcrypt pre-save hook + `select: false` + `toJSON` menghapus password: `User.js:25, 65-71, 100-105` | OK |
| **Harga transaksi tidak bisa dimanipulasi klien** — harga diambil dari DB (`transactionController.js:65, 101`, `serviceController.js:310-317`) | OK |
| **Stok atomik** — `$inc` + `$gte` cegah race condition (`Item.js:111-147`, `ServiceTicket.js:262-293`) | OK |
| **State machine status servis** — transisi divalidasi (`ServiceTicket.js:296-339`) | OK |
| **Path traversal backup/upload** — `path.basename()` (`backupService.js:157, 252, 259`, `api.js:151`) | OK |
| **XSS email** — `escapeHtml` di semua field (`emailService.js:12-20`) | OK |
| **Error JWT ditangani** — `TokenExpiredError`/`JsonWebTokenError` → 401 (`errorHandler.js:52-62`) | OK |
| **Ekspor password di respons API umum** — tidak ada (kecuali backup admin) | OK |
| **Header injection nama file nota** — nama customer di-sanitasi (`notaController.js:29, 58`, `notaStorage.js:8`) | OK |

---

## Ringkasan Eksekutif

- **6 Critical/High** yang wajib difix duluan (semuanya di `docker-compose.yml` + `middleware/auth.js` + route statis): **JWT secret default publik**, **kredensial WAHA hardcoded**, **CORS wildcard**, **file publik tanpa auth**, **trust JWT payload**, **rate-limit bypass**.
- Pola umum: konfigurasi deployment (docker-compose) adalah titik terlemah — 3 temuan teratas berasal dari sana.
- Kualitas kode controller bisnis relatif baik (stok atomik, harga dari DB, validasi schema Mongoose); kelemahan utama ada di lapisan middleware/konfigurasi/deployment.

*Tidak ada file yang dibuat/diubah; audit 100% read-only.*