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

## ⚡ Panduan Instalasi & Deployment

### 1. Persiapan Lingkungan (Prerequisites)
Pastikan perangkat Anda sudah terinstal:
- **Docker & Docker Compose**: [Unduh di sini](https://www.docker.com/products/docker-desktop/)
- **Git**: Untuk mendownload source code.
- **Akun Gmail**: Digunakan untuk fitur pengiriman nota otomatis.

### 2. Pengaturan SMTP Gmail (Wajib untuk Email)
Agar sistem bisa mengirim email nota, Anda harus menggunakan **App Password**:
1. Masuk ke [Akun Google](https://myaccount.google.com/).
2. Aktifkan **Verifikasi 2 Langkah**.
3. Cari "Sandi Aplikasi" atau **App Passwords**.
4. Pilih Aplikasi: `Lainnya (Nama Kustom)` -> Isi "Kasir UTC".
5. Salin **kode 16 digit** yang muncul (Hapus spasi jika ada).

### 3. Langkah-Langkah Instalasi

#### A. Clone & Masuk ke Folder
```bash
git clone https://github.com/username/Kasir_UTC_02.git
cd Kasir_UTC_02
```

#### B. Konfigurasi Environment (File `.env`)
Buat file baru bernama `.env` di dalam folder `backend/` atau edit langsung di `docker-compose.yml`. 

**Isi file `backend/.env`:**
```env
PORT=5000
MONGODB_URI=mongodb://mongo_db:27017/bengkel_utc
JWT_SECRET=GantiDenganStringRahasiaApapun
EMAIL_USER=email-anda@gmail.com
EMAIL_PASS=kode-app-password-16-digit
NODE_ENV=production
```

#### C. Menjalankan Server
Jalankan seluruh sistem (Database, Backend, Frontend, WA Bot) dalam satu perintah:
```bash
docker compose up -d --build
```
*Tunggu hingga proses build selesai (~2-5 menit tergantung internet).*

#### D. Setup Data Awal (Seeding)
**Sangat Penting!** Jalankan ini untuk mengisi data akun admin, teknisi, dan barang contoh agar sistem bisa digunakan:
```bash
docker compose exec backend npm run seed
```

### 4. Cara Akses & Penggunaan

| Layanan | URL Akses | Kredensial Default |
| :--- | :--- | :--- |
| **Aplikasi Kasir (Web)** | `http://localhost:8080` | User: `admin-utc01` / Pass: `adminutc28` |
| **WhatsApp Bot (WAHA)** | `http://localhost:8000` | User: `admin-utc01` / Pass: `adminutc28` |
| **Database Explorer** | `localhost:27018` | (Gunakan MongoDB Compass) |

---

### 🛠️ Langkah Setelah Instalasi (Penting!)

### 📱 Menghubungkan WhatsApp & Webhook
1. Buka `http://localhost:8000` di browser.
2. Login dengan username/password di atas.
3. Klik pada session `default`.
4. Pilih tab **Screenshot** atau **QR Code** dan scan menggunakan WhatsApp HP Anda.
5. **PENTING: Pengaturan Webhook** agar Bot Balas Otomatis bekerja:
   - Pilih tab **Webhooks** di dashboard WAHA.
   - Klik **Add Webhook**.
   - **URL:** `http://backend:5000/api/waha-webhook` (Jika menggunakan Docker) atau URL domain Anda.
   - **Events:** Pilih `message` atau `message.any`.
   - **Retries:** Biarkan default (atau set ke 15 attempts jika ingin tangguh).
   - Klik **Save**.
6. Jika status sudah `CONNECTED` dan Webhook aktif, bot sudah siap bekerja!

### 📧 Testing Email
1. Buat **Tiket Servis Baru**.
2. Masukkan email Anda yang valid di kolom email pelanggan.
3. Ubah status servis tersebut menjadi **"Completed"** (Selesai).
4. Cek kotak masuk/spam email Anda untuk melihat nota digital.

---

## 🔐 Akun Akses Default
Jika Anda menggunakan perintah `npm run seed`, gunakan akun berikut:

- **Superadmin:** `admin-utc01` / `adminutc28` (Akses penuh & kelola teknisi)
- **Kasir:** `kasir1` / `kasirutc0326` (Hanya POS & Servis)
- **Teknisi:** `wildan_utc`, `kaukab_utc`, dll.

---

## 📖 Dokumentasi Teknis
Untuk informasi struktur kode, pemeliharaan, dan pengembangan lebih lanjut, silakan merujuk ke:
👉 **[DOKUMENTASI.md](./DOKUMENTASI.md)**

---

## 📖 Dokumentasi Lengkap
Untuk informasi teknis lebih mendalam mengenai struktur kode, alur bot WhatsApp, dan panduan pemeliharaan, silakan baca:
👉 **[DOKUMENTASI.md](./DOKUMENTASI.md)**

---

## 🤝 Lokasi
**Unida Technology Centre (UTC)**
Universitas Darussalam Gontor, Siman, Ponorogo.
