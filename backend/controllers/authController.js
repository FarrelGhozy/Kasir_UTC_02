// controllers/authController.js - Manajemen & Autentikasi Pengguna
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { assertWAValidOrOverride } = require('../utils/waValidation');

// Generate JWT Token (berisi versi sesi agar bisa dicabut seketika)
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * @desc    Registrasi pengguna baru
 * @route   POST /api/auth/register
 * @access  Private (Hanya Admin)
 */
exports.register = async (req, res, next) => {
  try {
    const { name, username, password, role, phone } = req.body;

    // Cek apakah user sudah ada
    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Nama pengguna sudah digunakan'
      });
    }

    // Validasi WA otoritatif SEBELUM simpan (bila nomor diisi).
    let waMeta = { is_wa_valid: false, wa_status: 'unknown', wa_checked_at: null };
    if (phone) {
      const overrideFlag = req.body.wa_override_confirmed === true || req.body.wa_override_confirmed === 'true';
      const waCheck = await assertWAValidOrOverride(phone, {
        required: false,
        override: overrideFlag,
        logContext: { by: req.user && (req.user.username || req.user.id), source: 'register', username }
      });
      if (!waCheck.allowed) {
        return res.status(waCheck.status).json({
          success: false,
          code: waCheck.code,
          message: waCheck.message,
          waStatus: waCheck.waStatus
        });
      }
      waMeta = { is_wa_valid: waCheck.waStatus === 'valid', wa_status: waCheck.waStatus, wa_checked_at: new Date() };
    }

    // Buat pengguna
    const user = await User.create({
      name,
      username,
      password,
      role,
      phone: phone || '',
      ...waMeta
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
    // Race dua request username sama: findOne lolos dua-duanya, satu kena unique index.
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Nama pengguna sudah digunakan' });
    }
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
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Data permintaan tidak valid'
      });
    }

    const { username, password } = req.body;

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
    const token = generateToken(user);

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
    if (error.message === 'Username atau password salah' || error.message === 'Invalid credentials') {
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
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

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

    const users = await User.find(filter).sort({ created_at: -1 }).lean();

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
    }).select('name username').lean();

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
    const { name, role, isActive, phone } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan'
      });
    }

    // Cegah admin mengunci diri sendiri / sistem: tidak boleh ubah role
    // atau nonaktifkan akun sendiri, dan tidak boleh menonaktifkan admin terakhir.
    const isSelf = req.user && String(req.params.id) === String(req.user.id);
    if (isSelf && ((role && role !== user.role) || (isActive !== undefined && !isActive))) {
      return res.status(400).json({ success: false, message: 'Tidak dapat mengubah peran/menonaktifkan akun sendiri' });
    }
    if (isActive !== undefined && !isActive && user.role === 'admin') {
      const otherActiveAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan admin terakhir yang aktif' });
      }
    }

    if (name) user.name = name;
    // Nomor HP diubah -> validasi ulang ke WAHA sebelum disimpan.
    if (phone !== undefined && String(phone) !== String(user.phone || '')) {
      const overrideFlag = req.body.wa_override_confirmed === true || req.body.wa_override_confirmed === 'true';
      const waCheck = await assertWAValidOrOverride(phone, {
        required: false,
        override: overrideFlag,
        logContext: { by: req.user && (req.user.username || req.user.id), source: 'updateUser', username: user.username }
      });
      if (!waCheck.allowed) {
        return res.status(waCheck.status).json({
          success: false,
          code: waCheck.code,
          message: waCheck.message,
          waStatus: waCheck.waStatus
        });
      }
      user.phone = phone || '';
      user.is_wa_valid = waCheck.waStatus === 'valid';
      user.wa_status = waCheck.waStatus;
      user.wa_checked_at = new Date();
    }
    // Perubahan role/status mencabut semua sesi aktif user tersebut
    const resetSesi = (role && role !== user.role) ||
      (isActive !== undefined && isActive !== user.isActive);
    if (role) user.role = role;
    if (isActive !== undefined) {
      user.isActive = isActive;
      // Sinkron status string: login hanya cek isActive.
      user.status = isActive ? 'active' : 'inactive';
    }
    if (resetSesi) user.tokenVersion = (user.tokenVersion || 0) + 1;

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

    // Perbarui kata sandi + naikkan versi sesi agar token lama langsung hangus
    user.password = new_password;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
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

    if (req.user && String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan akun sendiri' });
    }
    if (user.role === 'admin') {
      const otherActiveAdmins = await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan admin terakhir yang aktif' });
      }
    }

    user.isActive = false;
    // Cabut semua sesi aktif agar akun yang dinonaktifkan langsung terblokir
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Pengguna berhasil dinonaktifkan'
    });
  } catch (error) {
    next(error);
  }
};