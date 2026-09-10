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

    let decoded;
    try {
      // Verifikasi tanda tangan & kedaluwarsa token
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau kedaluwarsa'
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau kedaluwarsa'
      });
    }

    // Verifikasi sesi & status akun SELALU ke database (bukan dari payload JWT),
    // agar penonaktifan akun dan reset sesi berlaku seketika
    const user = await User.findById(decoded.id).select('role isActive tokenVersion').lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Akun telah dinonaktifkan'
      });
    }

    // Token lama (tanpa versi sesi) atau sesi yang sudah di-reset → wajib login ulang
    if (decoded.tv === undefined || decoded.tv !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Sesi telah berakhir, silakan login kembali'
      });
    }

    req.user = {
      id: decoded.id,
      role: user.role
    };

    next();
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