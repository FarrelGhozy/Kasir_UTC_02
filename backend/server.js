// server.js - Entry Point Utama Backend
// Memuat environment terpusat dari file .env di ROOT project (sejajar docker-compose.yml)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const reminderService = require('./services/reminderService');
const backupService = require('./services/backupService');
const { startDutyReminderCron } = require('./bot/dutyScheduler');
const { startWeekendReminderCron } = require('./bot/weeklyScheduler');
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');
const sanitize = require('./middleware/sanitize');

// Validasi environment variables kritis saat startup (fail-fast)
const startupErrors = [];

if (!process.env.MONGODB_URI) {
  startupErrors.push('MONGODB_URI wajib diisi untuk koneksi database (lihat .env.example)');
}

const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) {
  startupErrors.push('JWT_SECRET wajib diisi. Generate: openssl rand -hex 32');
} else if (jwtSecret.length < 32 || jwtSecret.includes('change_this_in_production')) {
  startupErrors.push('JWT_SECRET tidak aman (minimal 32 karakter acak, jangan pakai nilai default)');
}

if (startupErrors.length > 0) {
  console.error('[STARTUP ERROR] Konfigurasi environment tidak valid:');
  startupErrors.forEach((msg) => console.error(`  - ${msg}`));
  process.exit(1);
}

if (!process.env.WAHA_URL) console.warn('[WARN] WAHA_URL tidak di-set — fitur WhatsApp tidak akan berfungsi');
if (!process.env.WAHA_API_KEY) console.warn('[WARN] WAHA_API_KEY tidak di-set — fitur WhatsApp tidak akan berfungsi');
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) console.warn('[WARN] EMAIL_USER/EMAIL_PASS tidak di-set — nota email tidak akan terkirim');

const app = express();
// Percaya TEPAT 1 hop proxy (container nginx frontend) agar req.ip = IP asli klien.
// Jangan set 'true' (percaya semua hop) — header X-Forwarded-For dari internet
// bisa dipalsukan untuk mem-bypass rate limit.
app.set('trust proxy', 1);
// Sembunyikan fingerprint framework
app.disable('x-powered-by');

// ==========================================
// 0. SECURITY HEADERS (tanpa dependensi tambahan)
// ==========================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY'); // API tidak untuk di-embed iframe
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS hanya bila production + diakses via HTTPS (jangan aktifkan di HTTP murni)
  if (process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(compression());
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SETUP MIDDLEWARE & CORS
// ==========================================

// Log semua request — samarkan token di query string agar tidak bocor ke file log
app.use((req, res, next) => {
  const urlAman = String(req.originalUrl || '').replace(/([?&]token=)[^&\s]*/g, '$1***');
  console.log(`[${new Date().toISOString()}] ${req.method} ${urlAman} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

const defaultAllowedOrigins = [
  'https://kasir.utc.web.id',
  'https://www.kasir.utc.web.id',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000'
];

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : defaultAllowedOrigins;

// Strict CORS — production hanya izinkan origin yang terdaftar
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // Tolak wildcard '*' — tidak aman digabung dengan credentials: true
    if (allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] CORS_ORIGIN=* tidak diizinkan di production. Isi daftar origin eksplisit.');
      return callback(null, false);
    }

    const isAllowed = allowedOrigins.indexOf(origin) !== -1;

    if (isAllowed) {
      return callback(null, true);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      const isLocalDev = origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isLocalDev) return callback(null, true);
    }
    
    console.log(`CORS blocked for origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Sanitasi NoSQL injection untuk semua input (body/query/params)
app.use(sanitize);

// ==========================================
// 1b. RATE LIMITING
// ==========================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi 15 menit.' },
  validate: { trustProxy: false }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
  validate: { trustProxy: false }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ==========================================
// 2. ROUTES
// ==========================================

app.use('/api', apiRoutes);
app.use('/api', webhookRoutes);

// Backward compatibility: serve foto dari URL lama (database existing)
// Diproteksi auth — foto perangkat memuat data pelanggan, bukan untuk publik
app.use('/backend/uploads/services', protect, express.static(path.join(__dirname, 'uploads', 'services')));

// Serve file nota digital
// SENGAJA publik: link ini dikirim ke pelanggan via WhatsApp agar bisa dibuka tanpa login.
// Nama file mengandung sufiks acak (lihat utils/notaStorage.js) sehingga tidak bisa ditebak/di-enumerasi.
// Jangan simpan file sensitif lain di folder ini.
app.use('/uploads/notas', express.static(path.join(__dirname, 'uploads', 'notas')));

// Endpoint verifikasi keaslian nota via QR Code
const ServiceTicket = require('./models/ServiceTicket');
const SpecialOrder = require('./models/SpecialOrder');

app.get('/api/verify-nota/:model/:id', async (req, res) => {
  try {
    // Status nota harus selalu fresh — jangan di-cache browser/proxy
    res.set('Cache-Control', 'no-store');
    const { model, id } = req.params;
    let doc;
    if (model === 'ServiceTicket') {
      doc = await ServiceTicket.findById(id).select('ticket_number customer.name customer.phone status total_cost payment_method payment_status warranty_expires_at history.created_at history.completed_at').lean();
    } else if (model === 'SpecialOrder') {
      doc = await SpecialOrder.findById(id).select('order_number customer.name customer.phone status estimated_price down_payment payment_status').lean();
    }
    if (!doc) return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    // Samarkan nomor HP pelanggan — cukup tampilkan 4 digit terakhir untuk verifikasi.
    // Endpoint ini publik (link QR di nota bisa tersebar), jangan bocorkan PII penuh.
    if (doc.customer && doc.customer.phone) {
      const hp = String(doc.customer.phone);
      doc.customer.phone = hp.length > 4 ? `${'*'.repeat(hp.length - 4)}${hp.slice(-4)}` : '****';
    }
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Kode verifikasi tidak valid' });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Bengkel UTC Ready' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
});

// Error Handler
app.use(errorHandler);

// ==========================================
// 3. START SERVER
// ==========================================

const startServer = async () => {
  try {
    // 1. Hubungkan Database
    await connectDB();
    
    // 2. Jalankan Scheduler
    reminderService.init();
    backupService.init();
    startDutyReminderCron();
    startWeekendReminderCron();
    
    // 3. Jalankan Listen Port
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server API Bengkel UTC Berjalan`);
      console.log(`📍 URL: http://0.0.0.0:${PORT}`);
      console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
    });

  } catch (err) {
    console.error('🔥 Gagal Menjalankan Server:', err);
    process.exit(1);
  }
};

startServer();

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('Sinyal SIGTERM diterima: menutup server HTTP');
  process.exit(0);
});
