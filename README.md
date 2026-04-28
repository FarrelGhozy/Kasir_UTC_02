# 🔧 Unida Technology Centre (UTC) — Workshop & POS Management System

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <br>
  <img src="https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chart.js&logoColor=white" alt="Chart.js">
  <img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx">
  <br>
  <img src="https://img.shields.io/badge/WAHA-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WAHA">
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail">
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

## 🏗️ Arsitektur & Stack Teknologi

Sistem ini dibangun dengan arsitektur **Modern Monolith** yang dikemas dalam kontainer untuk performa maksimal dan kemudahan deployment.

### 🌐 Frontend (User Interface)
| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Logic** | ![JS](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?logo=javascript&logoColor=black) | Pemrograman fungsional tanpa framework berat. |
| **Styling** | ![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white) | Kombinasi Bootstrap untuk Dashboard & Tailwind untuk Admin. |
| **Charts** | ![Chart.js](https://img.shields.io/badge/Chart.js-4.4-FF6384?logo=chart.js&logoColor=white) | Visualisasi data pendapatan dan statistik pelanggan. |
| **Optimization**| `browser-image-compression` | Kompresi foto perangkat langsung di browser sisi klien. |

### ⚙️ Backend (API Server)
*   **Runtime**: ![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=node.js&logoColor=white) (Express.js v5.2.1)
*   **Database**: ![MongoDB](https://img.shields.io/badge/MongoDB-6.0-47A248?logo=mongodb&logoColor=white) (ODM: Mongoose v9.1.5)
*   **Security**: ![JWT](https://img.shields.io/badge/JWT-JSON_Web_Token-black?logo=json-web-tokens) ![Bcrypt](https://img.shields.io/badge/Bcrypt-Password_Hashing-blue)
*   **File Handling**: `Multer` untuk manajemen upload foto perangkat.
*   **Automation**: `Node-cron` untuk scheduler pengingat servis otomatis.
*   **Email**: `Nodemailer` (SMTP) untuk pengiriman nota digital.

### 🤖 Integrasi & DevOps
*   **WhatsApp Gateway**: ![WAHA](https://img.shields.io/badge/WAHA-WhatsApp_API-25D366?logo=whatsapp&logoColor=white) Integrasi API untuk notifikasi real-time.
*   **Containerization**: ![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white) ![Docker Compose](https://img.shields.io/badge/Docker_Compose-Infrastructure-2496ED?logo=docker)
*   **Web Server**: ![Nginx](https://img.shields.io/badge/Nginx-Web_Server-009639?logo=nginx&logoColor=white) (Reverse Proxy & Static Serving)

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
