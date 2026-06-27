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
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length !== 2 || !parts[1]) {
        return res.status(401).json({ success: false, message: 'Format token tidak valid' });
      }
      token = parts[1];
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

      // Ambil data user dari JWT payload
      req.user = {
        id: decoded.id,
        role: decoded.role
      };

      // Fallback: jika role tidak ada di JWT (token lama), ambil dari DB
      if (!req.user.role) {
        const user = await User.findById(req.user.id).select('role isActive').lean();
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Pengguna tidak ditemukan'
          });
        }
        req.user.role = user.role;
        req.user.isActive = user.isActive;
      } else if (decoded.isActive === false) {
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
 * Protect — juga terima token dari query parameter (untuk window.open)
 */
exports.protectQuery = async (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return exports.protect(req, res, next);
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