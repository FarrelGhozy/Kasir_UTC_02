// server.js - Entry Point Utama Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const reminderService = require('./services/reminderService');
const errorHandler = require('./middleware/errorHandler');

const app = express();
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

// Permissive CORS logic
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || 
                     allowedOrigins.includes('*') ||
                     origin.includes('localhost') ||
                     origin.includes('127.0.0.1');

    if (isAllowed || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // In production, we are more strict but still allow common patterns
      console.log(`CORS blocked for origin: ${origin}`);
      callback(new Error('CORS: Origin tidak diizinkan'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/backend/uploads', express.static(path.join(__dirname, 'uploads')));

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
