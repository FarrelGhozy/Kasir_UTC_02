// server.js - Aplikasi Utama Express
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Hubungkan ke MongoDB
connectDB();

// Middleware keamanan
app.use(helmet());

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:8080'])
    : '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitasi input untuk mencegah NoSQL injection
app.use(mongoSanitize());

// Rate limiting untuk endpoint autentikasi
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan login, coba lagi setelah 15 menit' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

// Middleware pencatatan request (logging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rute API
app.use('/api', apiRoutes);

// Endpoint pemeriksaan kesehatan (Health check)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'API Bengkel UTC sedang berjalan',
    timestamp: new Date().toISOString()
  });
});

// Handler 404 (Rute tidak ditemukan)
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Rute tidak ditemukan' 
  });
});

// Global Error Handler (harus diletakkan terakhir)
app.use(errorHandler);

// Jalankan server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server API Bengkel UTC Berjalan`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Lingkungan (Env): ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Dimulai pada: ${new Date().toLocaleString('id-ID')}`);
  console.log('='.repeat(50));
});

// Penanganan shutdown yang aman (Graceful shutdown)
process.on('SIGTERM', () => {
  console.log('Sinyal SIGTERM diterima: menutup server HTTP');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection (Janji Ditolak Tidak Tertangani):', err);
  process.exit(1);
});