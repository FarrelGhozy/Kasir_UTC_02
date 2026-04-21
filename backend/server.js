// server.js - Entry Point Utama Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SETUP MIDDLEWARE & CORS
// ==========================================

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

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa Origin header (curl, healthcheck, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin tidak diizinkan'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Logging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==========================================
// 2. ROUTES
// ==========================================

app.use('/api', apiRoutes);
app.use('/api', webhookRoutes);

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
    
    // 2. Jalankan Listen Port
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server API Bengkel UTC Berjalan`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
    });

  } catch (err) {
    console.error('🔥 Gagal Menjalankan Server:', err);
    process.exit(1);
  }
};

// Jalankan fungsi utama
startServer();

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('Sinyal SIGTERM diterima: menutup server HTTP');
  process.exit(0);
});
