// controllers/dutyScheduleController.js - Controller Jadwal Piket Kebersihan
const DutySchedule = require('../models/DutySchedule');

const DAY_LABELS = {
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat'
};

/**
 * @desc    Ambil semua jadwal piket
 * @route   GET /api/duty-schedules
 * @access  Private (Admin)
 */
exports.getAllSchedules = async (req, res, next) => {
  try {
    const schedules = await DutySchedule.find({})
      .populate('user', 'name username phone jabatan')
      .sort({ day: 1, created_at: 1 })
      .lean();

    const formatted = schedules.map(s => ({
      ...s,
      day_label: DAY_LABELS[s.day] || s.day
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil jadwal piket per hari
 * @route   GET /api/duty-schedules/day/:day
 * @access  Private (Admin)
 */
exports.getScheduleByDay = async (req, res, next) => {
  try {
    const { day } = req.params;
    const validDays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Hari tidak valid. Gunakan: senin, selasa, rabu, kamis, jumat' });
    }

    const schedules = await DutySchedule.find({ day: day.toLowerCase() })
      .populate('user', 'name username phone jabatan')
      .sort({ created_at: 1 })
      .lean();

    res.status(200).json({
      success: true,
      message: `Jadwal piket hari ${DAY_LABELS[day.toLowerCase()]}`,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Buat jadwal piket baru
 * @route   POST /api/duty-schedules
 * @access  Private (Admin)
 */
exports.createSchedule = async (req, res, next) => {
  try {
    const { user, day } = req.body;

    if (!user || !day) {
      return res.status(400).json({ success: false, message: 'User dan day wajib diisi' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(user)) {
      return res.status(400).json({ success: false, message: 'ID user tidak valid' });
    }

    const validDays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Hari tidak valid' });
    }

    const existing = await DutySchedule.findOne({ user, day: day.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User ini sudah memiliki jadwal piket di hari tersebut' });
    }

    const schedule = await DutySchedule.create({
      user,
      day: day.toLowerCase()
    });

    const populated = await DutySchedule.findById(schedule._id)
      .populate('user', 'name username phone jabatan')
      .lean();

    res.status(201).json({ success: true, message: 'Jadwal piket berhasil dibuat', data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update jadwal piket (ganti hari)
 * @route   PUT /api/duty-schedules/:id
 * @access  Private (Admin)
 */
exports.updateSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { day } = req.body;

    const schedule = await DutySchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Jadwal piket tidak ditemukan' });
    }

    if (day) {
      const validDays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
      if (!validDays.includes(day.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Hari tidak valid' });
      }
      const newDay = day.toLowerCase();

      if (newDay !== schedule.day) {
        const duplicate = await DutySchedule.findOne({ user: schedule.user, day: newDay });
        if (duplicate) {
          return res.status(400).json({ success: false, message: 'User ini sudah memiliki jadwal piket di hari tersebut' });
        }
      }

      schedule.day = newDay;
    }

    await schedule.save();

    const populated = await DutySchedule.findById(schedule._id)
      .populate('user', 'name username phone jabatan')
      .lean();

    res.status(200).json({ success: true, message: 'Jadwal piket berhasil diperbarui', data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus jadwal piket
 * @route   DELETE /api/duty-schedules/:id
 * @access  Private (Admin)
 */
exports.deleteSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schedule = await DutySchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Jadwal piket tidak ditemukan' });
    }

    await DutySchedule.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Jadwal piket berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil jadwal piket milik user yang login
 * @route   GET /api/duty-schedules/my
 * @access  Private
 */
exports.getMySchedule = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const schedules = await DutySchedule.find({ user: userId })
      .populate('user', 'name username phone jabatan')
      .sort({ day: 1 })
      .lean();

    res.status(200).json({
      success: true,
      message: schedules.length > 0 ? 'Jadwal piket Anda' : 'Anda tidak memiliki jadwal piket',
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil jadwal piket hari ini
 * @route   GET /api/duty-schedules/today
 * @access  Private
 */
exports.getTodaySchedule = async (req, res, next) => {
  try {
    const now = new Date();
    const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const dayIndex = wibTime.getDay();

    const dayMap = {
      1: 'senin',
      2: 'selasa',
      3: 'rabu',
      4: 'kamis',
      5: 'jumat'
    };

    const todayDay = dayMap[dayIndex];

    if (!todayDay) {
      return res.status(200).json({
        success: true,
        message: 'Hari ini tidak ada jadwal piket (Sabtu/Minggu)',
        data: []
      });
    }

    const schedules = await DutySchedule.find({ day: todayDay })
      .populate('user', 'name username phone jabatan')
      .sort({ created_at: 1 })
      .lean();

    res.status(200).json({
      success: true,
      message: `Jadwal piket hari ${DAY_LABELS[todayDay]}`,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};
