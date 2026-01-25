// controllers/authController.js - Manajemen & Autentikasi Pengguna
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

/**
 * @desc    Registrasi pengguna baru
 * @route   POST /api/auth/register
 * @access  Private (Hanya Admin)
 */
exports.register = async (req, res, next) => {
  try {
    const { name, username, password, role } = req.body;

    // Cek apakah user sudah ada
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Nama pengguna sudah digunakan'
      });
    }

    // Buat pengguna
    const user = await User.create({
      name,
      username,
      password,
      role
    });

    res.status(201).json({
      success: true,
      message: 'Registrasi pengguna berhasil',
      data: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login pengguna
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mohon sertakan nama pengguna dan kata sandi'
      });
    }

    // Cari pengguna berdasarkan kredensial
    const user = await User.findByCredentials(username, password);

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Akun telah dinonaktifkan'
      });
    }

    // Buat token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Berhasil masuk',
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        message: 'Nama pengguna atau kata sandi salah'
      });
    }
    next(error);
  }
};

/**
 * @desc    Ambil profil pengguna saat ini
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil semua pengguna
 * @route   GET /api/auth/users
 * @access  Private (Admin)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const users = await User.find(filter).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil hanya teknisi
 * @route   GET /api/auth/technicians
 * @access  Private
 */
exports.getTechnicians = async (req, res, next) => {
  try {
    const technicians = await User.find({ 
      role: 'teknisi',
      isActive: true 
    }).select('name username');

    res.status(200).json({
      success: true,
      count: technicians.length,
      data: technicians
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Perbarui data pengguna
 * @route   PUT /api/auth/users/:id
 * @access  Private (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, role, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Data pengguna berhasil diperbarui',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ubah kata sandi
 * @route   PATCH /api/auth/change-password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi saat ini dan kata sandi baru wajib diisi'
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    
    // Verifikasi kata sandi lama
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Kata sandi saat ini salah'
      });
    }

    // Perbarui kata sandi
    user.password = new_password;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diubah'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus pengguna (soft delete)
 * @route   DELETE /api/auth/users/:id
 * @access  Private (Admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Pengguna berhasil dinonaktifkan'
    });
  } catch (error) {
    next(error);
  }
};