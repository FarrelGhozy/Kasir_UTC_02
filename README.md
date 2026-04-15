# 🔧 Bengkel UTC — Workshop & POS Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-6%2B-brightgreen?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/Bootstrap-5.3-purple?logo=bootstrap" alt="Bootstrap">
  <img src="https://img.shields.io/badge/Docker-Ready-blue?logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License">
</p>

**Bengkel UTC** adalah sistem manajemen operasional terintegrasi untuk **Unida Teknologi Center (UTC)**. Aplikasi ini menggabungkan manajemen servis komputer (workshop) dan sistem kasir (POS) dalam satu platform berbasis web modern.

---

## 🚀 Fitur Utama

### 🛠️ Manajemen Servis Bengkel (Workshop)
- **Sistem Tiket Modern** — Alur pengerjaan transparan dari Antrian, Diagnosa, Tunggu Part, hingga Selesai.
- **Monitoring Teknisi** — Nama teknisi dan beban kerja terpantau langsung di kartu servis.
- **Detail Inventaris Terintegrasi** — Tambahkan sparepart ke servis dengan pengurangan stok gudang secara otomatis.
- **Riwayat Lengkap** — Pencatatan waktu masuk (pendaftaran) dan waktu keluar (pengambilan) barang.
- **Cetak Nota Otomatis** — Format cetak nota termal untuk pelanggan setelah servis selesai.

### 🛒 Point of Sale (POS / Kasir)
- **Checkout Cepat** — Antarmuka ramah pengguna untuk penjualan barang retail.
- **Validasi Stok Real-time** — Mencegah penjualan barang yang stoknya habis.
- **Multi Metode Pembayaran** — Mendukung Tunai dan Transfer.
- **Invoice Otomatis** — Generasi nomor faktur unik untuk setiap transaksi.

### 📦 Inventaris & Gudang
- **Manajemen Katalog** — Kelola kategori barang, harga jual, dan stok minimum.
- **Alert Stok Menipis** — Notifikasi visual untuk barang yang perlu restock.
- **Dashboard Analitik** — Ringkasan pendapatan, jumlah tiket aktif, dan status gudang.

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Backend** | Node.js (Express.js) |
| **Database** | MongoDB (Mongoose ODM) |
| **Frontend** | Vanilla JS (ES6 Modules), HTML5, CSS3 |
| **UI Framework** | Bootstrap 5.3 + Bootstrap Icons |
| **Auth** | JWT (JSON Web Token) |
| **Orchestration** | Docker + Docker Compose |

---

## 📂 Struktur Proyek

```
Kasir_UTC_02/
├── backend/                  # REST API Server
│   ├── controllers/          # Logika bisnis per modul
│   ├── models/               # Skema database (MongoDB)
│   ├── routes/               # Endpoint API
│   └── seed.js               # Script inisialisasi data default
├── frontend/                 # Client Side Application
│   └── public/
│       ├── js/modules/       # Modul fungsional (POS, Servis, Inventaris)
│       └── index.html        # Single Page Application Shell
└── docker-compose.yml        # Konfigurasi containerization
```

---

## ⚡ Panduan Instalasi Cepat (Docker)

1. **Clone Repositori**
   ```bash
   git clone https://github.com/FarrelGhozy/Kasir_UTC_02.git
   cd Kasir_UTC_02
   ```

2. **Konfigurasi Environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env jika perlu menyesuaikan JWT_SECRET
   ```

3. **Jalankan Aplikasi**
   ```bash
   docker compose up -d --build
   ```

4. **Inisialisasi Data (PENTING)**
   ```bash
   docker exec -it utc_backend node seed.js
   ```

5. **Akses**
   - Aplikasi: `http://localhost:8080`
   - API: `http://localhost:5200/api`

---

## 🔐 Akun Akses Default

Gunakan kredensial berikut setelah menjalankan perintah `seed.js`:

| Role | Username | Password |
|------|----------|----------|
| **Admin** | `admin` | `admin123` |
| **Kasir** | `kasir1` | `kasir123` |
| **Teknisi** | `farrel`, `wildan`, `kaukab` | `password123` |

---

## 🤝 Kontribusi

Dibuat dengan ❤️ untuk efisiensi operasional **Bengkel Unida Teknologi Center (UTC)**.
Universitas Darussalam Gontor, Ponorogo.
