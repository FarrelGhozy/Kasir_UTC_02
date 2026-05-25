// server.js - Entry Point Utama Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const reminderService = require('./services/reminderService');
const errorHandler = require('./middleware/errorHandler');

// Validasi environment variables kritis saat startup
const criticalEnvVars = [
  { name: 'MONGODB_URI', message: 'MONGODB_URI wajib diisi untuk koneksi database' },
  { name: 'JWT_SECRET', message: 'JWT_SECRET wajib diisi. Generate: openssl rand -hex 32' },
];

for (const env of criticalEnvVars) {
  if (!process.env[env.name]) {
    console.error(`[STARTUP ERROR] ${env.message}`);
    process.exit(1);
  }
}

if (!process.env.WAHA_URL) console.warn('[WARN] WAHA_URL tidak di-set — fitur WhatsApp tidak akan berfungsi');
if (!process.env.WAHA_API_KEY) console.warn('[WARN] WAHA_API_KEY tidak di-set — fitur WhatsApp tidak akan berfungsi');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SETUP MIDDLEWARE & CORS
// ==========================================

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'No Origin'}`);
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
    
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 ||
                     allowedOrigins.includes('*');

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

// ==========================================
// 1b. RATE LIMITING
// ==========================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi 15 menit.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ==========================================
// 2. ROUTES
// ==========================================

app.use('/api', apiRoutes);
app.use('/api', webhookRoutes);

// Backward compatibility: serve foto dari URL lama (database existing)
app.use('/backend/uploads/services', express.static(path.join(__dirname, 'uploads', 'services')));

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
    
    // 2. Jalankan Scheduler Pengingat
    reminderService.init();
    
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
