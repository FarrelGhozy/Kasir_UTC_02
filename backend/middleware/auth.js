// middleware/auth.js - Middleware Autentikasi & Otorisasi JWT
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Lindungi rute - Verifikasi token JWT
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Cek token di headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Tidak diizinkan untuk mengakses rute ini (Token tidak ditemukan)'
      });
    }

    try {
      // Verifikasi token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ambil user dari token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Pengguna tidak ditemukan'
        });
      }

      if (!req.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Akun telah dinonaktifkan'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau kedaluwarsa'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Otorisasi peran tertentu (Role Authorization)
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Peran pengguna '${req.user.role}' tidak diizinkan untuk mengakses rute ini`
      });
    }
    next();
  };
};