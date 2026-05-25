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
      users: await User.find({}).lean(),
      items: await Item.find({}).lean(),
      service_tickets: await ServiceTicket.find({}).lean(),
      transactions: await Transaction.find({}).lean(),
      special_orders: await SpecialOrder.find({}).lean(),
      system_logs: await SystemLog.find({}).lean(),
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
 * @desc    Import/Restore system data (AMAN: insert dulu baru delete)
 * @route   POST /api/admin/backup/import
 * @access  Private (Admin)
 */
exports.importData = async (req, res, next) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, message: 'Tidak ada data untuk diimport' });
    }

    if (!data.users || !data.items) {
      return res.status(400).json({ success: false, message: 'Format file backup tidak valid' });
    }

    const currentAdmin = await User.findById(req.user.id).lean();

    // Simpan data admin agar tetap bisa login setelah restore
    const adminDoc = { ...currentAdmin };
    delete adminDoc._id;

    // 1. Hapus SEMUA data lama terlebih dahulu
    await Promise.all([
      User.deleteMany({}),
      Item.deleteMany({}),
      ServiceTicket.deleteMany({}),
      Transaction.deleteMany({}),
      SpecialOrder.deleteMany({}),
      SystemLog.deleteMany({})
    ]);

    // 2. Insert data dari backup (tanpa hook agar password tetap ter-hash)
    const insertOps = [];
    if (data.users?.length > 0) {
      // Filter admin yg sedang login agar tidak konflik — nanti di-insert manual
      const filteredUsers = data.users.filter(u => u.username !== currentAdmin.username);
      if (filteredUsers.length > 0) insertOps.push(User.collection.insertMany(filteredUsers));
    }
    if (data.items?.length > 0) insertOps.push(Item.collection.insertMany(data.items));
    if (data.service_tickets?.length > 0) insertOps.push(ServiceTicket.collection.insertMany(data.service_tickets));
    if (data.transactions?.length > 0) insertOps.push(Transaction.collection.insertMany(data.transactions));
    if (data.special_orders?.length > 0) insertOps.push(SpecialOrder.collection.insertMany(data.special_orders));
    if (data.system_logs?.length > 0) insertOps.push(SystemLog.collection.insertMany(data.system_logs));

    await Promise.all(insertOps);

    // 3. Insert ulang admin yg sedang login (pakai collection.insertOne agar pre('save') hook tidak terpicu)
    const adminExists = await User.collection.findOne({ username: currentAdmin.username });
    if (!adminExists) {
      await User.collection.insertOne({ ...adminDoc, _id: currentAdmin._id });
    }

    res.status(200).json({
      success: true,
      message: 'Data berhasil direstore'
    });
  } catch (error) {
    next(error);
  }
};
