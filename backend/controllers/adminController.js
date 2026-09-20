const User = require('../models/User');
const { assertWAValidOrOverride } = require('../utils/waValidation');

/**
 * @desc    Ambil semua data teknisi
 * @route   GET /api/admin/technicians
 */
exports.getAllTechnicians = async (req, res, next) => {
  try {
    const technicians = await User.find({ role: 'teknisi' }).sort({ created_at: -1 }).lean();
    res.status(200).json({ success: true, data: technicians });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Tambah teknisi baru
 * @route   POST /api/admin/technicians
 */
exports.createTechnician = async (req, res, next) => {
  try {
    const { name, username, password, phone, status, jabatan } = req.body;

    const existingUser = await User.findOne({ username }).lean();
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }

    // Validasi WA otoritatif SEBELUM simpan (422 tanpa tulis DB bila invalid tanpa override).
    const overrideFlag = req.body.wa_override_confirmed === true || req.body.wa_override_confirmed === 'true';
    const waCheck = await assertWAValidOrOverride(phone, {
      required: false,
      override: overrideFlag,
      logContext: { by: req.user && (req.user.username || req.user.id), source: 'createTechnician', username }
    });
    if (!waCheck.allowed) {
      return res.status(waCheck.status).json({
        success: false,
        code: waCheck.code,
        message: waCheck.message,
        waStatus: waCheck.waStatus
      });
    }

    const technician = await User.create({
      name,
      username,
      password,
      phone,
      status,
      jabatan: jabatan || null,
      role: 'teknisi',
      is_wa_valid: waCheck.waStatus === 'valid',
      wa_status: waCheck.waStatus,
      wa_checked_at: new Date()
    });

    res.status(201).json({ success: true, message: 'Teknisi berhasil ditambahkan', data: technician });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
    }
    next(error);
  }
};

/**
 * @desc    Update data teknisi
 * @route   PUT /api/admin/technicians/:id
 */
exports.updateTechnician = async (req, res, next) => {
  try {
    const { name, username, password, phone, status, jabatan } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
    }

    if (name) user.name = name;
    if (username) {
      if (username !== user.username) {
        const existingUser = await User.findOne({ username }).lean();
        if (existingUser) {
          return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
        }
      }
      user.username = username;
    }
    if (phone) {
      const oldPhone = user.phone ? String(user.phone) : '';
      if (String(phone) !== oldPhone) {
        const overrideFlag = req.body.wa_override_confirmed === true || req.body.wa_override_confirmed === 'true';
        const waCheck = await assertWAValidOrOverride(phone, {
          required: false,
          override: overrideFlag,
          logContext: { by: req.user && (req.user.username || req.user.id), source: 'updateTechnician', username: user.username }
        });
        if (!waCheck.allowed) {
          return res.status(waCheck.status).json({
            success: false,
            code: waCheck.code,
            message: waCheck.message,
            waStatus: waCheck.waStatus
          });
        }
        user.phone = phone;
        user.is_wa_valid = waCheck.waStatus === 'valid';
        user.wa_status = waCheck.waStatus;
        user.wa_checked_at = new Date();
      } else {
        user.phone = phone;
      }
    }
    if (status) user.status = status;
    if (jabatan !== undefined) user.jabatan = jabatan || null;
    // Sinkron status <-> isActive: login hanya cek isActive, jadi keduanya harus konsisten.
    if (status === 'inactive') user.isActive = false;
    if (status === 'active') user.isActive = true;
    
    // Hanya update password jika diisi
    if (password && password.trim() !== '') {
      user.password = password;
    }

    await user.save();

    res.status(200).json({ success: true, message: 'Data teknisi berhasil diperbarui', data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus teknisi
 * @route   DELETE /api/admin/technicians/:id
 */
exports.deleteTechnician = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user || user.role !== 'teknisi') {
      return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
    }

    await User.findByIdAndDelete(req.params.id).lean();
    res.status(200).json({ success: true, message: 'Teknisi berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};