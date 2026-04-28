const SystemLog = require('../models/SystemLog');

// middleware/errorHandler.js - Middleware Penanganan Error Global
const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log ke Konsol untuk Debugging
  console.error('❌ GLOBAL ERROR:', err);

  // LOG KE DATABASE SYSTEMLOGS SECARA OTOMATIS
  try {
    await SystemLog.create({
      level: 'ERROR',
      source: 'GlobalErrorHandler',
      message: err.message || 'Kesalahan Server',
      details: {
        path: req.originalUrl,
        method: req.method,
        body: req.body,
        stack: err.stack,
        user: req.user ? req.user.id : 'Guest'
      }
    });
  } catch (logErr) {
    console.error('Gagal mencatat log ke DB:', logErr);
  }

  // Mongoose bad ObjectId (ID tidak valid)
  if (err.name === 'CastError') {
    const message = 'Sumber daya tidak ditemukan (ID tidak valid)';
    error.statusCode = 404;
    error.message = message;
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