# 📑 Dokumentasi Teknis Sistem Kasir & Workshop Bengkel UTC

Dokumen ini berisi panduan lengkap untuk instalasi, konfigurasi, dan pemeliharaan sistem manajemen Bengkel UTC (Unida Technology Centre).

---

## 🏗️ 1. Prasyarat Sistem (Prerequisites)

Sebelum memulai instalasi, pastikan software berikut sudah terinstal di komputer Anda:

*   **Docker Engine & Docker Compose:** Wajib untuk menjalankan seluruh layanan (Database, Backend, Frontend, WAHA).
*   **Git:** Untuk melakukan clone repository.
*   **Akun Gmail Aktif:** Diperlukan untuk fitur pengiriman nota otomatis via email.
*   **Google Chrome / Browser Modern:** Untuk mengakses dashboard sistem.
*   **VS Code (Disarankan):** Dengan ekstensi berikut untuk kenyamanan pengembangan:
    *   *Docker* (oleh Microsoft)
    *   *ESLint* & *Prettier*
    *   *MongoDB for VS Code*

---

## ⚙️ 2. Konfigurasi Variabel Lingkungan (.env)

Sistem membutuhkan file `.env` di dalam folder `backend/` untuk mengatur koneksi dan kredensial pihak ketiga.

### **Tabel Referensi .env**

| Nama Variabel | Nilai Default / Contoh | Deskripsi Fungsi |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port internal backend (Express.js) |
| `NODE_ENV` | `development` | Mode aplikasi (`development` atau `production`) |
| `MONGODB_URI` | `mongodb://mongo_db:27017/bengkel_utc` | URL koneksi ke database MongoDB |
| `JWT_SECRET` | `(isi_string_bebas_minimal_32_karakter)` | Kunci rahasia untuk enkripsi token login |
| `WAHA_URL` | `http://waha:8000` | URL layanan WhatsApp Gateway (WAHA) |
| `WAHA_SESSION` | `default` | Nama session WhatsApp yang akan diputar |
| `WAHA_API_KEY` | `adminutc28` | API Key untuk keamanan akses ke WAHA |
| `EMAIL_USER` | `bengkelutc@gmail.com` | Alamat Gmail pengirim nota |
| `EMAIL_PASS` | `abcd efgh ijkl mnop` | **App Password** 16 digit dari Google |

### **💡 Cara Mendapatkan App Password Gmail (EMAIL_PASS):**
1.  Buka [Akun Google](https://myaccount.google.com/) Anda.
2.  Aktifkan **Verifikasi 2 Langkah (2-Step Verification)** di menu *Keamanan*.
3.  Cari kolom pencarian di bagian atas, ketik **"Sandi Aplikasi"** atau **"App Passwords"**.
4.  Pilih aplikasi: `Lainnya (Nama Kustom)` dan beri nama "Sistem Kasir UTC".
5.  Klik **Buat**. Google akan menampilkan kode **16 digit**. Salin kode ini (tanpa spasi) ke variabel `EMAIL_PASS` di file `.env`.

---

## 🚀 3. Panduan Setup Lokal (Step-by-Step)

Ikuti urutan perintah berikut di terminal Anda:

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/username/Kasir_UTC_02.git
    cd Kasir_UTC_02
    ```

2.  **Siapkan Konfigurasi:**
    Salin file contoh ke file aktif:
    ```bash
    cp backend/.env.example backend/.env
    ```
    *Lalu edit file `backend/.env` sesuai dengan panduan pada Bagian 2 di atas.*

3.  **Jalankan Layanan (Docker):**
    ```bash
    docker compose up --build -d
    ```
    *Tunggu hingga seluruh container (utc_mongo, utc_backend, utc_frontend, utc_waha) berstatus 'Started'.*

4.  **Eksekusi Database Seeding:**
    Langkah ini penting untuk membuat akun admin pertama dan mengisi data barang awal:
    ```bash
    docker compose exec backend npm run seed
    ```

---

## 🤖 4. Setup WAHA & Webhook (Krusial)

Sistem notifikasi otomatis tidak akan berjalan sebelum langkah-langkah ini selesai:

1.  **Akses Dashboard WAHA:** Buka `http://localhost:8000` di browser.
2.  **Login WAHA:** Gunakan Username: `admin-utc01` dan Password: `adminutc28`.
3.  **Mulai Session:** Klik pada session bernama `default`, lalu klik tombol **Start**.
4.  **Scan QR Code:** Munculkan kode QR di dashboard, lalu scan menggunakan menu "Perangkat Tertaut" di aplikasi WhatsApp HP Anda.
5.  **Konfigurasi Webhook:**
    *   Klik menu **Webhooks** di dashboard WAHA.
    *   Klik **Add New Webhook**.
    *   **URL:** Isi dengan `http://backend:5000/api/waha-webhook` (WAHA di dalam Docker akan otomatis resolve `backend` ke container backend). Jika backend tidak ada di Docker, gunakan URL publik/domain.
    *   **Events:** Centang box `message` atau `message.any` (WAHA Plus menggunakan event `message.upsert` — backend sudah menangani ketiganya).
    *   **Retries:** Biarkan default (15 attempts) agar WAHA mencoba ulang jika webhook gagal.
    *   Klik **Save**.
6.  **Verifikasi Webhook:** Setelah disimpan, kirim pesan WhatsApp ke nomor yang sudah discan. Cek log backend:
    ```bash
    docker compose logs backend -f
    ```
    Jika berhasil akan muncul log:
    ```
    [WAHA Webhook] Data Diterima: { ... }
    [WAHA Webhook] Pesan dari: 62812xxxxxx@..., Isi: Halo
    [Bot] Mengirim balasan ke 62812xxxxxx@c.us...
    ```
    Jika tidak muncul, periksa:
    - Apakah session WAHA berstatus `WORKING`? Cek di dashboard WAHA.
    - Apakah webhook URL sesuai? WAHA harus bisa mencapai `http://backend:5000/api/waha-webhook`.
    - Apakah firewall memblokir koneksi antar container?

---

## 🔑 5. Daftar Kredensial Default

Setelah proses *seeding*, gunakan data berikut untuk masuk ke sistem:

| Layanan | URL | Username | Password |
| :--- | :--- | :--- | :--- |
| **Aplikasi Utama (Admin)** | `http://localhost:8080` | `admin-utc01` | `adminutc28` |
| **Aplikasi Utama (Kasir)** | `http://localhost:8080` | `kasir1` | `kasirutc0326` |
| **Dashboard WAHA** | `http://localhost:8000` | `admin-utc01` | `adminutc28` |
| **Database Mongo** | `localhost:27018` | *(tanpa auth)* | *(tanpa auth)* |

---

## 🛠️ 6. Panduan Troubleshooting

| Gejala Masalah | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| **Bot WA Tidak Membalas** | Webhook belum diset, salah URL, atau payload WAHA Plus tidak cocok dengan format yang diharapkan backend. | Pastikan URL Webhook di WAHA menunjuk ke `http://backend:5000/api/waha-webhook`. Cek log backend dengan `docker compose logs backend -f` setelah kirim pesan WA. Pastikan ada log `[WAHA Webhook] Pesan dari: ...`. |
| **Bot WA Tidak Membalas (no hp tidak terbaca)** | WAHA Plus mengirim format Baileys (`key.remoteJid`) — backend versi lama hanya membaca `from`. | **Update backend** — webhook.js sekarang sudah punya `normalizeWAHA()` yang handle kedua format. Pastikan container di-rebuild: `docker compose up -d --build backend`. |
| **Session WAHA tidak WORKING** | Belum scan QR, atau sesi expired. | Buka dashboard WAHA, klik session `default`, scan ulang QR. Jika sering disconnect, kurangi beban RAM WAHA (image WAHA butuh ~1.5GB). |
| **WAHA error 401 saat kirim pesan** | API Key mismatch. | Pastikan `WAHA_API_KEY` di `.env` backend cocok dengan `WAHA_API_KEY` di `docker-compose.yml` (default: `adminutc28`). |
| **Email Nota Gagal Kirim** | App Password salah atau 2-FA mati. | Cek kembali `EMAIL_PASS` dan pastikan Verifikasi 2 Langkah Google aktif. |
| **Gagal Build Container** | Bentrok port (8080/8000/27018). | Pastikan tidak ada aplikasi lain (XAMPP/Mongo Lokal) yang memakai port tersebut. |
| **Layar Hitam/Stuck Backdrop** | Masalah cache modal Bootstrap. | Lakukan **Hard Refresh** di browser (Ctrl + F5). |
| **Data Barang Kosong** | Belum menjalankan seeder. | Jalankan `docker compose exec backend npm run seed`. |

---

## 🛠️ 7. Pemeliharaan Sistem (Maintenance)

Untuk menjaga stabilitas sistem (terutama layanan WAHA yang rentan terhadap kebocoran memori), telah diimplementasikan mekanisme **Auto-Restart Terjadwal** yang terintegrasi langsung dengan Docker Compose.

### **Jadwal Restart Otomatis**
Layanan `backend` (`utc_backend`) dan `waha` (`utc_waha`) dijadwalkan untuk restart setiap **2 hari sekali pada pukul 00:00**.

### **Mekanisme Implementasi**
Fitur ini dijalankan oleh service `auto_restart` di dalam `docker-compose.yml` menggunakan image `docker:cli`. Service ini berfungsi sebagai *sidecar container* yang mengirimkan perintah restart melalui Docker Socket.

**Keuntungan:**
*   **Portable:** Konfigurasi ikut berpindah jika project dipindah ke server lain.
*   **Otomatis:** Langsung aktif saat perintah `docker compose up` dijalankan.
*   **Aman:** Tidak memerlukan akses root/crontab pada OS Host server.

**Catatan:**
*   Restart ini hanya memakan waktu sekitar 5-10 detik.
*   Data tidak akan hilang karena database tetap menyala dan volume sudah dipasang.
*   Sesi WhatsApp akan otomatis terhubung kembali setelah container WAHA menyala.

---

> **Catatan Keamanan:** Jangan pernah melakukan *commit* file `.env` yang berisi password asli ke repository publik (GitHub/GitLab).

Dibuat dengan ❤️ untuk Unida Technology Centre.
*Terakhir Diperbarui: Mei 2026*
