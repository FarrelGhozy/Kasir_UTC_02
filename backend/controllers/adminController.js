const User = require('../models/User');

/**
 * @desc    Ambil semua data teknisi
 * @route   GET /api/admin/technicians
 */
exports.getAllTechnicians = async (req, res, next) => {
  try {
    const technicians = await User.find({ role: 'teknisi' }).sort({ created_at: -1 });
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
    const { name, username, password, phone, status } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }

    const technician = await User.create({
      name,
      username,
      password,
      phone,
      status,
      role: 'teknisi'
    });

    res.status(201).json({ success: true, message: 'Teknisi berhasil ditambahkan', data: technician });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update data teknisi
 * @route   PUT /api/admin/technicians/:id
 */
exports.updateTechnician = async (req, res, next) => {
  try {
    const { name, username, password, phone, status } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
    }

    // Update fields
    if (name) user.name = name;
    if (username) user.username = username;
    if (phone) user.phone = phone;
    if (status) user.status = status;
    
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
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'teknisi') {
      return res.status(404).json({ success: false, message: 'Teknisi tidak ditemukan' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Teknisi berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};