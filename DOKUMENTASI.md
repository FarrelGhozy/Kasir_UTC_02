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
    *   **URL:** Isi dengan `http://backend:5000/api/waha-webhook`
    *   **Events:** Centang box `message` (ini agar bot bisa membalas chat otomatis).
    *   Klik **Save**.

---

## 🔑 5. Daftar Kredensial Default

Setelah proses *seeding*, gunakan data berikut untuk masuk ke sistem:

| Layanan | URL | Username | Password |
| :--- | :--- | :--- | :--- |
| **Aplikasi Utama** | `http://localhost:8080` | `admin` | `admin123` |
| **Dashboard WAHA** | `http://localhost:8000` | `admin-utc01` | `adminutc28` |
| **Database Mongo** | `localhost:27018` | *(tanpa auth)* | *(tanpa auth)* |

---

## 🛠️ 6. Panduan Troubleshooting

| Gejala Masalah | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| **Bot WA Tidak Membalas** | Webhook belum diset atau salah URL. | Pastikan URL Webhook di WAHA menunjuk ke `http://backend:5000/api/waha-webhook`. |
| **Email Nota Gagal Kirim** | App Password salah atau 2-FA mati. | Cek kembali `EMAIL_PASS` dan pastikan Verifikasi 2 Langkah Google aktif. |
| **Gagal Build Container** | Bentrok port (8080/8000/27018). | Pastikan tidak ada aplikasi lain (XAMPP/Mongo Lokal) yang memakai port tersebut. |
| **Layar Hitam/Stuck Backdrop** | Masalah cache modal Bootstrap. | Lakukan **Hard Refresh** di browser (Ctrl + F5). |
| **Data Barang Kosong** | Belum menjalankan seeder. | Jalankan `docker compose exec backend npm run seed`. |

---

> **Catatan Keamanan:** Jangan pernah melakukan *commit* file `.env` yang berisi password asli ke repository publik (GitHub/GitLab).

Dibuat dengan ❤️ untuk Unida Technology Centre.
*Terakhir Diperbarui: April 2026*
