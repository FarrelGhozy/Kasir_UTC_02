# 🔧 Bengkel UTC — Workshop & POS Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-6%2B-brightgreen?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/Bootstrap-5.3-purple?logo=bootstrap" alt="Bootstrap">
  <img src="https://img.shields.io/badge/Docker-Ready-blue?logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License">
</p>

**Bengkel UTC** adalah sistem manajemen bengkel komputer dan kasir (POS) berbasis web yang lengkap. Dibangun dengan arsitektur **full-stack** menggunakan Node.js/Express sebagai backend REST API, MongoDB sebagai database, dan Vanilla JavaScript (ES6 Modules) sebagai frontend.

---

## 🚀 Fitur Utama

### 🛠️ Manajemen Servis Bengkel
- **Sistem Tiket** — Lacak perbaikan dari "Antrian" hingga "Diambil Pelanggan"
- **Assignment Teknisi** — Tugaskan pekerjaan ke teknisi tertentu
- **Tracking Spare Part** — Tambahkan part ke tiket dengan pengurangan stok otomatis
- **Riwayat Servis** — Log lengkap perbaikan dan biaya

### 🛒 Point of Sale (POS / Kasir)
- **Transaksi Retail** — Checkout cepat untuk suku cadang dan aksesoris
- **Keranjang Belanja** — Total real-time dengan validasi stok
- **Multi Metode Bayar** — Tunai, Transfer Bank, QRIS, dan Kartu Debit/Kredit
- **Cetak Struk** — Otomatis cetak struk setelah transaksi berhasil
- **Operasi Atomik** — Menjamin integritas stok saat penjualan bersamaan

### 📦 Inventaris & Laporan
- **Manajemen Stok** — Pelacakan real-time dengan alert stok menipis
- **Export CSV** — Export data inventaris langsung dari browser
- **Analitik** — Laporan pendapatan harian/bulanan, barang terlaris, performa staf
- **RBAC** — Panel berbeda untuk Admin, Teknisi, dan Kasir

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Backend** | Node.js 18+, Express.js 4 |
| **Database** | MongoDB 6+, Mongoose ODM |
| **Autentikasi** | JWT (JSON Web Token), Bcrypt |
| **Frontend** | HTML5, Vanilla JS (ES6 Modules) |
| **UI Framework** | Bootstrap 5.3, Bootstrap Icons |
| **Container** | Docker, Docker Compose |
| **Web Server** | Nginx (untuk frontend via Docker) |

---

## 📂 Struktur Proyek

```
Kasir_UTC_02/
├── backend/                  # Express REST API
│   ├── config/
│   │   └── database.js       # Konfigurasi koneksi MongoDB
│   ├── controllers/          # Logika bisnis (request handler)
│   │   ├── authController.js
│   │   ├── inventoryController.js
│   │   ├── serviceController.js
│   │   ├── transactionController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   └── auth.js           # JWT guard & RBAC middleware
│   ├── models/               # Mongoose schema & model
│   │   ├── User.js
│   │   ├── Item.js
│   │   ├── ServiceTicket.js
│   │   └── Transaction.js
│   ├── routes/
│   │   └── api.js            # Semua definisi route API
│   ├── seeder.js             # Script seed data awal
│   ├── server.js             # Entry point aplikasi
│   ├── .env.example          # Template konfigurasi environment
│   ├── Dockerfile            # Docker image backend
│   └── package.json
│
├── frontend/                 # Static Web Application
│   ├── public/
│   │   ├── index.html        # Shell utama aplikasi
│   │   ├── css/
│   │   │   └── styles.css    # Custom theme & overrides
│   │   └── js/
│   │       ├── api.js        # HTTP client (Fetch API wrapper)
│   │       ├── auth.js       # Auth & token management
│   │       ├── app.js        # Router & navigasi
│   │       └── modules/
│   │           ├── dashboard.js
│   │           ├── pos.js
│   │           ├── service.js
│   │           ├── inventory.js
│   │           └── reports.js
│   ├── Dockerfile            # Docker image frontend (Nginx)
│   └── nginx.conf            # Konfigurasi Nginx
│
├── docker-compose.yml        # Orkestrasi semua service
└── README.md                 # Dokumentasi ini
```

---

## ⚡ Panduan Instalasi

Pilih salah satu metode instalasi di bawah ini:

---

## 🐳 Metode 1: Docker (Direkomendasikan)

Cara paling cepat dan mudah. Semua dependensi (Node.js, MongoDB, Nginx) berjalan dalam container yang terisolasi.

### Prasyarat
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (sudah termasuk Docker Compose)
- Git

### Langkah-Langkah

**1. Clone repositori**
```bash
git clone https://github.com/FarrelGhozy/Kasir_UTC_02.git
cd Kasir_UTC_02
```

**2. Buat file konfigurasi environment**
```bash
# Salin template .env
cp backend/.env.example backend/.env
```

Lalu edit `backend/.env` dan **ganti nilai `JWT_SECRET`** dengan string acak yang kuat:
```env
PORT=5000
MONGODB_URI=mongodb://mongo_db:27017/bengkel_utc
JWT_SECRET=ganti_ini_dengan_string_rahasia_yang_sangat_panjang_dan_acak
NODE_ENV=production
```

> ⚠️ **PENTING:** Jangan pernah menggunakan nilai default `JWT_SECRET` di lingkungan produksi!

**3. Jalankan semua service dengan Docker Compose**
```bash
docker compose up -d --build
```

Perintah ini akan:
- Build image Docker untuk backend (Node.js) dan frontend (Nginx)
- Unduh image MongoDB dari Docker Hub
- Menjalankan 3 container sekaligus secara background

**4. Seed database (buat data awal)**
```bash
docker exec utc_backend node seeder.js
```

**5. Akses aplikasi**

| Service | URL |
|---------|-----|
| 🌐 **Frontend (Aplikasi)** | http://localhost:8080 |
| ⚙️ **Backend API** | http://localhost:5200/api |
| 🗄️ **MongoDB** | `localhost:27018` (via MongoDB Compass) |

### Perintah Docker Berguna

```bash
# Lihat status semua container
docker compose ps

# Lihat log realtime semua service
docker compose logs -f

# Lihat log service tertentu saja
docker compose logs -f backend

# Hentikan semua container
docker compose down

# Hentikan DAN hapus semua volume (HATI-HATI: data database terhapus!)
docker compose down -v

# Restart service tertentu
docker compose restart backend

# Rebuild image setelah ada perubahan kode
docker compose up -d --build backend
```

---

## 💻 Metode 2: Instalasi Manual (Tanpa Docker)

Cocok untuk development atau jika tidak menggunakan Docker.

### Prasyarat

Pastikan sudah terinstal:
- **Node.js** v18 atau lebih baru — [Download](https://nodejs.org/)
- **MongoDB** v6 atau lebih baru — [Download](https://www.mongodb.com/try/download/community) atau gunakan [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratis)
- **Git** — [Download](https://git-scm.com/)

Verifikasi instalasi:
```bash
node --version    # Harus v18.x.x atau lebih tinggi
npm --version     # Biasanya sudah ikut Node.js
mongod --version  # Jika pakai MongoDB lokal
```

### Langkah 1 — Clone Repositori

```bash
git clone https://github.com/FarrelGhozy/Kasir_UTC_02.git
cd Kasir_UTC_02
```

### Langkah 2 — Setup Backend

```bash
# Masuk ke direktori backend
cd backend

# Install semua dependensi
npm install

# Buat file konfigurasi environment
cp .env.example .env
```

Edit file `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bengkel_utc
JWT_SECRET=ganti_ini_dengan_string_rahasia_minimal_32_karakter
NODE_ENV=development
```

> 💡 Jika menggunakan **MongoDB Atlas**, ganti `MONGODB_URI` dengan connection string dari dashboard Atlas, contoh:
> `MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/bengkel_utc`

**Seed database** (buat user default & data sampel):
```bash
npm run seed
```

Output yang diharapkan:
```
✅ Seeder selesai!
   - 7 Teknisi dibuat
   - 1 Admin: admin / admin123
   - 1 Kasir: kasir1 / kasir123
   - 10 Item sampel dibuat
```

**Jalankan backend server:**
```bash
# Mode development (auto-restart saat ada perubahan file)
npm run dev

# Mode production
npm start
```

Backend akan berjalan di: `http://localhost:5000`

Verifikasi dengan membuka: `http://localhost:5000/api/health` — harus mengembalikan `{"status":"ok"}`

### Langkah 3 — Setup Frontend

Buka terminal **baru** (jangan tutup terminal backend):

```bash
# Dari root direktori proyek, masuk ke frontend
cd frontend/public

# Pilih salah satu cara untuk menjalankan server statis:

# Opsi A: Python (biasanya sudah terinstal di Linux/macOS)
python3 -m http.server 8080

# Opsi B: Node.js http-server
npx http-server -p 8080 --cors

# Opsi C: VS Code Live Server
# Klik kanan index.html → "Open with Live Server"
```

### Langkah 4 — Konfigurasi URL Backend (Jika Port Berbeda)

Jika backend berjalan di port selain `5000`, buka `frontend/public/js/api.js` dan sesuaikan:
```javascript
// Untuk instalasi manual (backend di port 5000)
const API_BASE_URL = 'http://localhost:5000/api';

// Untuk Docker (backend di-expose ke port 5200)
const API_BASE_URL = 'http://localhost:5200/api';
```

### Langkah 5 — Akses Aplikasi

Buka browser dan kunjungi: **http://localhost:8080**

---

## 🔐 Akun Default

Setelah menjalankan seeder, gunakan akun berikut untuk login:

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| **Administrator** | `admin` | `admin123` | Penuh (semua fitur + manajemen user) |
| **Kasir** | `kasir1` | `kasir123` | POS, Inventaris, Laporan Harian |
| **Teknisi** | `farrel` | `password123` | Servis Bengkel, Lihat Inventaris |
| **Teknisi** | `wildan` | `password123` | Servis Bengkel, Lihat Inventaris |
| **Teknisi** | `kaukab` | `password123` | Servis Bengkel, Lihat Inventaris |

> 🔒 **Segera ganti password default setelah pertama kali login di lingkungan produksi!**

---

## 🔄 Alur Penggunaan Aplikasi

### Alur POS (Kasir)
1. Login sebagai **kasir1**
2. Buka menu **"Kasir"**
3. Klik produk untuk menambahkan ke keranjang
4. Atur jumlah sesuai kebutuhan
5. Pilih metode pembayaran
6. Masukkan nominal uang diterima (untuk pembayaran tunai)
7. Klik **"Bayar & Cetak"** → struk otomatis muncul

### Alur Servis Bengkel
1. Login sebagai **farrel** (teknisi)
2. Buka menu **"Servis"**
3. Isi form data pelanggan dan perangkat
4. Assign ke teknisi
5. Klik **"Buat Tiket"**
6. Update status tiket seiring progres perbaikan
7. Tambahkan spare part jika diperlukan (stok akan berkurang otomatis)

### Alur Admin
1. Login sebagai **admin**
2. **Dashboard** — pantau pendapatan dan tiket aktif hari ini
3. **Gudang** — kelola stok barang, tambah/edit/hapus item
4. **Laporan** — lihat laporan pendapatan dan performa staf
5. Tambah user baru melalui panel Admin (fitur manajemen user)

---

## 🌐 Referensi API

Backend berjalan di port `5000` (manual) atau `5200` (Docker).

### Autentikasi
```http
POST   /api/auth/login              # Login
GET    /api/auth/me                 # Info user saat ini
POST   /api/auth/register           # Daftarkan user baru (Admin)
GET    /api/auth/users              # Daftar semua user (Admin)
GET    /api/auth/technicians        # Daftar teknisi
PATCH  /api/auth/change-password    # Ganti password
PUT    /api/auth/users/:id          # Update user (Admin)
DELETE /api/auth/users/:id          # Nonaktifkan user (Admin)
```

### Inventaris
```http
GET    /api/inventory                        # Daftar semua barang
POST   /api/inventory                        # Tambah barang baru
GET    /api/inventory/alerts/low-stock       # Alert stok menipis
GET    /api/inventory/summary/value          # Total nilai inventaris
GET    /api/inventory/summary/by-category    # Rekapitulasi per kategori
GET    /api/inventory/:id                    # Detail barang
PUT    /api/inventory/:id                    # Update barang
PATCH  /api/inventory/:id/stock              # Adjustment stok manual
DELETE /api/inventory/:id                    # Nonaktifkan barang
```

### Servis Bengkel
```http
GET    /api/services                              # Daftar semua tiket
POST   /api/services                              # Buat tiket baru
GET    /api/services/technician/:id/workload      # Beban kerja teknisi
GET    /api/services/:id                          # Detail tiket
PATCH  /api/services/:id/status                   # Update status
POST   /api/services/:id/parts                    # Tambah part (kurangi stok)
PATCH  /api/services/:id/service-fee              # Update biaya servis
DELETE /api/services/:id                          # Batalkan tiket
```

### Transaksi POS
```http
GET    /api/transactions                          # Daftar transaksi
POST   /api/transactions                          # Buat transaksi baru
GET    /api/transactions/summary/today            # Ringkasan hari ini
GET    /api/transactions/invoice/:invoice_no      # Cari by nomor faktur
GET    /api/transactions/:id                      # Detail transaksi
DELETE /api/transactions/:id                      # Hapus transaksi (Admin)
```

### Laporan
```http
GET    /api/reports/revenue/daily                 # Pendapatan harian
GET    /api/reports/revenue/monthly               # Pendapatan bulanan
GET    /api/reports/revenue/range                 # Rentang tanggal custom
GET    /api/reports/top-items                     # Barang terlaris
GET    /api/reports/cashier-performance           # Performa kasir
GET    /api/reports/technician-performance        # Performa teknisi
```

> Semua endpoint (kecuali `/api/auth/login`) memerlukan header:
> `Authorization: Bearer <jwt_token>`

---

## ⚠️ Troubleshooting

### ❌ Frontend tidak bisa konek ke backend
```
Error: Failed to fetch / CORS error
```
**Solusi:**
1. Pastikan backend sudah berjalan (`npm run dev` atau `docker compose ps`)
2. Periksa URL di `frontend/public/js/api.js` sudah benar
3. Pastikan menggunakan HTTP server (bukan `file://`) untuk membuka frontend

### ❌ Login gagal / Error 401
```
Solusi: Pastikan sudah menjalankan seeder: npm run seed
```
Atau jika pakai Docker:
```bash
docker exec utc_backend node seeder.js
```

### ❌ Koneksi MongoDB gagal
```
Error: MongoServerSelectionError
```
**Untuk instalasi manual:**
- Pastikan MongoDB service berjalan: `sudo systemctl start mongod` (Linux) atau buka MongoDB Compass
- Periksa `MONGODB_URI` di file `.env`

**Untuk Docker:**
```bash
# Periksa status container MongoDB
docker compose ps
docker compose logs mongo_db
```

### ❌ Port sudah digunakan
```
Error: EADDRINUSE: address already in use :::5000
```
**Solusi:** Ganti port di `.env`:
```env
PORT=5001
```
Dan update `API_BASE_URL` di `frontend/public/js/api.js`.

### ❌ Module tidak bisa dimuat di browser
```
SyntaxError: Cannot use import statement
```
**Penyebab:** Frontend diakses melalui `file://` bukan HTTP server.
**Solusi:** Gunakan salah satu cara serve frontend yang disebutkan di Langkah 3.

---

## 🔒 Catatan Keamanan untuk Produksi

- [ ] Ganti semua password default (`admin123`, `kasir123`, `password123`)
- [ ] Set `JWT_SECRET` dengan string acak minimal 32 karakter
- [ ] Aktifkan HTTPS (gunakan reverse proxy Nginx/Caddy)
- [ ] Batasi akses port MongoDB (jangan expose ke internet publik)
- [ ] Set `NODE_ENV=production` di file `.env`
- [ ] Terapkan rate limiting pada endpoint API
- [ ] Backup database secara rutin

---

## 🤝 Kontribusi

Kontribusi sangat disambut! Silakan:
1. Fork repositori ini
2. Buat branch fitur baru: `git checkout -b feat/nama-fitur`
3. Commit perubahan: `git commit -m 'feat: tambah fitur X'`
4. Push ke branch: `git push origin feat/nama-fitur`
5. Buat Pull Request

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License**.

---

<p align="center">
  Dibuat dengan ❤️ untuk <strong>Bengkel Unida Teknologi Center (UTC)</strong><br>
  Universitas Darussalam Gontor, Ponorogo
</p>
