const SystemLog = require('../models/SystemLog');

// middleware/errorHandler.js - Middleware Penanganan Error Global
const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log ke Konsol untuk Debugging
  console.error('❌ GLOBAL ERROR:', err);

  // LOG KE DATABASE SYSTEMLOGS — fire-and-forget, jangan blocking response
  SystemLog.create({
    level: 'ERROR',
    source: 'GlobalErrorHandler',
    message: err.message || 'Kesalahan Server',
    details: {
      method: req.method,
      body: req.body ? (() => {
        const sanitized = { ...req.body };
        // Daftar field sensitif — sinkron dengan nama field di authController
        // (current_password/new_password) + varian umum lainnya
        ['password', 'current_password', 'new_password', 'password_baru', 'password_lama', 'currentPassword', 'newPassword', 'password_confirmation', 'token', 'accessToken', 'secret', 'api_key', 'apiKey', 'EMAIL_PASS', 'email_pass'].forEach(k => delete sanitized[k]);
        return sanitized;
      })() : undefined,
      // Jangan log token unduhan nota yang dikirim via query string
      path: typeof req.originalUrl === 'string'
        ? req.originalUrl.replace(/([?&]token=)[^&]*/g, '$1***')
        : req.originalUrl,
      stack: err.stack,
      user: req.user ? req.user.id : 'Guest'
    }
  }).catch(err => console.error('Gagal mencatat log ke DB:', err));

  // Mongoose bad ObjectId (ID tidak valid)
  if (err.name === 'CastError') {
    const message = 'Sumber daya tidak ditemukan (ID tidak valid)';
    error.statusCode = 404;
    error.message = message;
  }

  // Multer: file terlalu besar / terlalu banyak / tipe ditolak -> 400 yang jelas.
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Ukuran file melebihi batas 5MB'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Jumlah/jenis file tidak sesuai ketentuan'
        : 'Upload file gagal';
    error.statusCode = 400;
    error.message = message;
  }
  // fileFilter menolak dengan Error biasa (pesan 'Hanya file gambar...')
  if (err.message && err.message.startsWith('Hanya file gambar')) {
    error.statusCode = 400;
  }

  // Mongoose duplicate key (Data ganda)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Nilai duplikat pada kolom: ${field}. Mohon gunakan nilai lain.`;
    error.statusCode = 400;
    error.message = message;
  }

  // Mongoose validation error (Validasi gagal)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error.statusCode = 400;
    error.message = message;
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token tidak valid';
    error.statusCode = 401;
    error.message = message;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token telah kedaluwarsa, silakan login kembali';
    error.statusCode = 401;
    error.message = message;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Kesalahan Server Internal',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;