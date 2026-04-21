# 🔧 Unida Technology Centere (UTC) — Workshop & POS Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-6%2B-brightgreen?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/WAHA-Ready-blue?logo=whatsapp" alt="WAHA">
  <img src="https://img.shields.io/badge/Docker-Ready-blue?logo=docker" alt="Docker">
</p>

**Bengkel UTC** (Unida Technology Centere) adalah sistem manajemen operasional terintegrasi yang dirancang khusus untuk mengelola servis perangkat (komputer, laptop, HP, printer) dan transaksi kasir dalam satu platform modern.

---

## 🚀 Fitur Unggulan Baru

### 🤖 WhatsApp Automation (WAHA)
- **Auto-Reply Bot** — Salam ramah, info layanan, dan jam operasional otomatis.
- **Notifikasi Penugasan** — Teknisi langsung menerima WA saat ada tugas servis baru.
- **Update Status Pelanggan** — Pelanggan menerima notifikasi otomatis saat barang sedang didiagnosa, dikerjakan, atau selesai.

### 🛒 Pemesanan Barang (Special Order)
- Kelola pesanan barang yang tidak ada di stok.
- Pencatatan DP (Down Payment) dan sisa pembayaran yang harus dilunasi.
- Fitur cetak nota pesanan khusus untuk bukti DP pelanggan.

### 🛠️ Manajemen Servis & Admin
- **Dashboard Workshop** — Monitoring status perbaikan secara real-time.
- **Format Ribuan Otomatis** — Input nominal uang kini lebih mudah dengan pemisah ribuan otomatis (titik).
- **Admin Panel Khusus** — Halaman khusus Superadmin untuk mengelola data akun teknisi.

---

## 🏗️ Tech Stack
- **Backend:** Node.js (Express.js) + MongoDB (Mongoose).
- **Frontend:** Vanilla JS (ES6 Modules), Bootstrap 5, & Tailwind CSS.
- **WhatsApp Gateway:** WAHA (WhatsApp HTTP API).
- **Orchestration:** Docker Compose.

---

## ⚡ Instalasi Cepat

1.  **Jalankan Docker:**
    ```bash
    docker compose up -d --build
    ```
2.  **Isi Data Awal (Seeding):**
    ```bash
    docker compose exec backend npm run seed
    ```
3.  **Akses Sistem:**
    *   **Aplikasi Utama:** `http://localhost:8080`
    *   **Dashboard WAHA:** `http://localhost:8000` (User: `admin-utc01`, Pass: `adminutc28`)

---

## 🔐 Akun Default (Hasil Seeding)
- **Admin:** `admin-utc01` / `adminutc28`
- **Kasir:** `kasir1` / `kasirutc0326`
- **Teknisi:** `wildan_utc`, `kaukab_utc`, dll. (Lihat `seed.js`)

---

## 📖 Dokumentasi Lengkap
Untuk informasi teknis lebih mendalam mengenai struktur kode, alur bot WhatsApp, dan panduan pemeliharaan, silakan baca:
👉 **[DOKUMENTASI.md](./DOKUMENTASI.md)**

---

## 🤝 Lokasi
**Unida Technology Centere (UTC)**
Universitas Darussalam Gontor, Siman, Ponorogo.
