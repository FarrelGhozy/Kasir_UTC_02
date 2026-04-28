# 🔧 Unida Technology Centre (UTC) — Workshop & POS Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-6%2B-brightgreen?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/WAHA-Ready-blue?logo=whatsapp" alt="WAHA">
  <img src="https://img.shields.io/badge/Docker-Ready-blue?logo=docker" alt="Docker">
</p>

**Bengkel UTC** (Unida Technology Centre) adalah sistem manajemen operasional terintegrasi yang dirancang khusus untuk mengelola servis perangkat (komputer, laptop, HP, printer) dan transaksi kasir dalam satu platform modern.

---

## 🚀 Fitur Unggulan Baru

### 📧 Notifikasi Email & Nota Digital (Baru!)
- **Nota Otomatis** — Sistem secara otomatis mengirimkan rincian biaya dan nota servis ke email pelanggan saat status servis diubah menjadi "Completed".
- **Formulir Terintegrasi** — Input email pelanggan kini tersedia langsung di formulir tiket servis baru dan menu edit.

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

## 🏗️ Stack Teknologi (Tech Stack)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (Express.js v5.2.1)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose v9.1.5)
- **Security**: JWT Authentication & Bcrypt Hashing
- **Automation**: Node-cron untuk penjadwalan tugas
- **WhatsApp Gateway**: [WAHA](https://waha.dev/) (WhatsApp HTTP API) untuk otomasi notifikasi
- **Email**: Nodemailer (SMTP Gmail) untuk pengiriman nota otomatis

### Frontend
- **Core**: Vanilla JS (ES6+ Modules)
- **UI Frameworks**: 
  - [Bootstrap 5.3](https://getbootstrap.com/) (Digunakan di aplikasi utama/Dashboard)
  - [Tailwind CSS](https://tailwindcss.com/) (Digunakan di modul Kelola Teknisi)
- **Data Visualization**: [Chart.js](https://www.chartjs.org/) (v4.4.3)
- **Icons**: Bootstrap Icons

### Infrastruktur
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Orchestration**: Docker Compose untuk menghubungkan Backend, Frontend, MongoDB, dan WAHA.

---

## ⚡ Panduan Instalasi Detail

### A. Persiapan (Prerequisites)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Sudah termasuk Docker Compose)
- Akun Gmail untuk pengiriman email otomatis.

### B. Konfigurasi Email (SMTP Gmail)
Agar fitur pengiriman nota via email berfungsi, Anda perlu mengatur **App Password** di akun Google Anda:
1. Aktifkan **2-Step Verification** pada akun Google Anda.
2. Cari menu **App Passwords** di pengaturan keamanan akun Google.
3. Pilih App: `Mail` dan Device: `Other (Custom Name: Kasir UTC)`.
4. Salin kode 16 digit yang diberikan.

### C. Langkah Instalasi
1.  **Clone Repositori:**
    ```bash
    git clone https://github.com/username/Kasir_UTC_02.git
    cd Kasir_UTC_02
    ```
2.  **Konfigurasi Environment:**
    Edit file `docker-compose.yml` pada bagian environment `backend` atau buat file `.env` di folder `backend/`:
    ```env
    EMAIL_USER=email-anda@gmail.com
    EMAIL_PASS=kode-app-password-16-digit
    ```
3.  **Jalankan dengan Docker:**
    ```bash
    docker compose up -d --build
    ```
4.  **Isi Data Awal (Seeding):**
    ```bash
    docker compose exec backend npm run seed
    ```
5.  **Akses Sistem:**
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
**Unida Technology Centre (UTC)**
Universitas Darussalam Gontor, Siman, Ponorogo.
