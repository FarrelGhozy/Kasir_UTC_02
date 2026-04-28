# Dokumentasi Sistem Kasir & Workshop - Unida Technology Centre (UTC)

Selamat datang di dokumentasi teknis sistem manajemen Bengkel UTC. Dokumen ini disusun untuk membantu pengembang dan pengelola sistem generasi berikutnya agar dapat memahami, merawat, dan mengembangkan sistem ini dengan lancar.

---

## 📌 1. Gambaran Umum Sistem
Sistem ini dirancang untuk mengelola operasional harian bengkel, meliputi:
1.  **Point of Sale (POS):** Transaksi penjualan barang/sparepart retail.
2.  **Manajemen Servis (Workshop):** Pendataan perbaikan perangkat pelanggan dengan monitoring status.
3.  **Pemesanan Barang (Special Order):** Sistem titip beli barang yang sedang kosong dengan fitur DP.
4.  **Bot WhatsApp (WAHA):** Notifikasi otomatis untuk pelanggan & teknisi, serta auto-reply bot.
5.  **Manajemen Inventaris:** Kontrol stok gudang dan peringatan stok menipis.
6.  **Admin Panel:** Pengelolaan data teknisi khusus peran Superadmin.

---

## 🛠️ 2. Arsitektur Teknologi
Sistem berjalan di atas kontainer **Docker** untuk memudahkan instalasi dan skalabilitas.

*   **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS (Bootstrap 5 & Tailwind CSS untuk halaman Admin).
*   **Backend:** Node.js dengan framework Express.js.
*   **Database:** MongoDB.
*   **WhatsApp Gateway:** WAHA (WhatsApp HTTP API) - Core Version.
*   **Keamanan:** JWT (JSON Web Token) untuk sesi login dan Bcrypt untuk hashing password.

---

## 📁 3. Struktur Folder Utama
```text
Kasir_UTC_02/
├── backend/                # Server API (Node.js)
│   ├── bot/                # Logika Chatbot & Konfigurasi Bot
│   ├── config/             # Koneksi Database
│   ├── controllers/        # Logika Bisnis (Servis, Order, Transaksi)
│   ├── models/             # Skema Database (Mongoose)
│   ├── routes/             # Endpoint API & Webhook
│   ├── services/           # WhatsApp Service (Integrasi WAHA)
│   └── seed.js             # Pengisi data awal (User, Barang, Teknisi)
├── frontend/               # File Statis (Nginx)
│   └── public/             
│       ├── admin-teknisi.html  # Halaman khusus Superadmin
│       ├── index.html          # Aplikasi Utama (Dashboard/POS/Service)
│       └── js/                 # Logika Frontend (API wrapper & Modules)
└── docker-compose.yml      # Konfigurasi seluruh Container
```

---

## 🤖 4. Integrasi WhatsApp (WAHA)
Sistem menggunakan WAHA sebagai jembatan ke WhatsApp.

### **A. Notifikasi Otomatis**
Terkirim saat:
*   **Servis Baru:** Notifikasi ke pelanggan (info tiket) & ke teknisi (penugasan).
*   **Update Status:** Notifikasi perkembangan servis ke pelanggan.
*   **Servis Selesai:** Rincian biaya akhir ke pelanggan.
*   **Pemesanan Barang:** Info pesanan masuk, DP, dan kabar jika barang sudah sampai.

### **B. Auto-Reply Bot & Webhook**
Dikelola di `backend/bot/`. Agar bot dapat menerima pesan, Anda harus mengonfigurasi Webhook di dashboard WAHA:
*   **Endpoint:** `http://backend:5000/api/waha-webhook`
*   **Method:** `POST`
*   **Events:** `message` (Wajib)
*   **Fungsi:** Meneruskan pesan masuk ke logika `botHandler.js` untuk diproses.

**Fitur Bot:**
*   **Session Memory:** Menyapa ramah hanya sekali dalam 12 jam (mencegah spam).
*   **Cek Jam Operasional:** Bot tahu jika chat masuk di luar jam 08.00 - 15.00 WIB atau pada hari Jumat (Libur).
*   **Mode Darurat:** Jika variabel `IS_CAMPUS_EVENT` diset `true`, bot akan membalas bahwa bengkel tutup karena acara kampus.

---

## 📧 5. Sistem Notifikasi Email (Nota Otomatis)
Sistem menggunakan **Nodemailer** dengan layanan SMTP Gmail.

### **A. Alur Pengiriman**
1.  **Input Email:** Admin/Kasir memasukkan email pelanggan saat membuat tiket baru atau mengedit tiket.
2.  **Trigger:** Saat teknisi mengubah status tiket menjadi **"Completed"**, sistem secara otomatis memicu fungsi `sendInvoiceEmail`.
3.  **Konten:** Email berisi rincian perangkat, rincian sparepart yang digunakan, biaya jasa, dan total yang harus dibayar dalam format HTML yang rapi.

### **B. Prasyarat Teknis**
*   **Variabel ENV:** Membutuhkan `EMAIL_USER` (akun Gmail) dan `EMAIL_PASS` (App Password 16 digit).
*   **Keamanan:** Pastikan akun Gmail pengirim sudah mengaktifkan Verifikasi 2 Langkah.

---

## 🔑 6. Akun & Keamanan
*   **Role User:** `admin`, `kasir`, `teknisi`.
*   **Akses Admin Khusus:** Mengelola teknisi di `admin-teknisi.html`.
*   **Auth WAHA:** Dashboard dilindungi password (lihat docker-compose.yml).
*   **Input Nominal:** Seluruh input uang sudah otomatis menggunakan format ribuan (titik) agar minim kesalahan ketik.

---

## 🚀 7. Cara Menjalankan Sistem
1.  Pastikan Docker sudah terinstal.
2.  Jalankan perintah:
    ```bash
    docker compose up --build -d
    ```
3.  Isi data awal (Database Seeding):
    ```bash
    docker compose exec backend npm run seed
    ```
4.  Akses Aplikasi: `http://localhost:8080`
5.  Akses WAHA (Scan QR): `http://localhost:8000` (User: `admin-utc01`, Pass: `adminutc28`)

---

## 📝 8. Panduan Pemeliharaan

*   **Menambah Teknisi:** Gunakan halaman `admin-teknisi.html` atau edit array `TECHNICIANS` di `seed.js` lalu jalankan ulang seeder.
*   **Mengubah Jam Operasional:** Edit file `backend/bot/botConfig.js`.
*   **Ganti Password WAHA:** Ubah di `docker-compose.yml` pada bagian `utc_waha` (environment variables).

---

## 💡 Pesan untuk Generasi Penerus
> "Sistem ini dibangun untuk mempermudah pekerjaan manusia, bukan menggantikannya. Pastikan untuk selalu menjaga keramahan dalam pesan WhatsApp karena teknologi hanyalah alat, tapi pelayanan adalah hati dari Unida Technology Centre."

Dibuat pada: April 2026
Lokasi: Unida Technology Centre (UTC)