// controllers/backupController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const ServiceTicket = require('../models/ServiceTicket');
const Transaction = require('../models/Transaction');
const SpecialOrder = require('../models/SpecialOrder');
const SystemLog = require('../models/SystemLog');

/**
 * @desc    Export all system data
 * @route   GET /api/admin/backup/export
 * @access  Private (Admin)
 */
exports.exportData = async (req, res, next) => {
  try {
    const data = {
      users: await User.find({}),
      items: await Item.find({}),
      service_tickets: await ServiceTicket.find({}),
      transactions: await Transaction.find({}),
      special_orders: await SpecialOrder.find({}),
      system_logs: await SystemLog.find({}),
      exported_at: new Date(),
      version: '1.0.0'
    };

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Import/Restore system data
 * @route   POST /api/admin/backup/import
 * @access  Private (Admin)
 */
exports.importData = async (req, res, next) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, message: 'Tidak ada data untuk diimport' });
    }

    // 1. Validasi struktur data minimal
    if (!data.users || !data.items) {
      return res.status(400).json({ success: false, message: 'Format file backup tidak valid' });
    }

    // 2. Simpan user admin saat ini (agar tidak terkunci keluar)
    const currentAdmin = await User.findById(req.user.id);

    // 3. Clear Collections
    await User.deleteMany({});
    await Item.deleteMany({});
    await ServiceTicket.deleteMany({});
    await Transaction.deleteMany({});
    await SpecialOrder.deleteMany({});
    await SystemLog.deleteMany({});

    // 4. Insert Data
    if (data.users && data.users.length > 0) await User.insertMany(data.users);
    if (data.items && data.items.length > 0) await Item.insertMany(data.items);
    if (data.service_tickets && data.service_tickets.length > 0) await ServiceTicket.insertMany(data.service_tickets);
    if (data.transactions && data.transactions.length > 0) await Transaction.insertMany(data.transactions);
    if (data.special_orders && data.special_orders.length > 0) await SpecialOrder.insertMany(data.special_orders);
    if (data.system_logs && data.system_logs.length > 0) await SystemLog.insertMany(data.system_logs);

    // 5. Pastikan admin pengimpor tetap ada/update jika ID berubah di file backup
    const adminExists = await User.findOne({ username: currentAdmin.username });
    if (!adminExists) {
        // Jika di backup tidak ada admin yang sama, masukkan admin saat ini kembali
        await User.create(currentAdmin.toObject());
    }

    res.status(200).json({
      success: true,
      message: 'Data berhasil direstore'
    });
  } catch (error) {
    next(error);
  }
};
