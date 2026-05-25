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

    const currentAdmin = await User.findById(req.user.id);

    // 1. Insert data baru dulu
    const insertOps = [];
    if (data.users?.length > 0) insertOps.push(User.insertMany(data.users));
    if (data.items?.length > 0) insertOps.push(Item.insertMany(data.items));
    if (data.service_tickets?.length > 0) insertOps.push(ServiceTicket.insertMany(data.service_tickets));
    if (data.transactions?.length > 0) insertOps.push(Transaction.insertMany(data.transactions));
    if (data.special_orders?.length > 0) insertOps.push(SpecialOrder.insertMany(data.special_orders));
    if (data.system_logs?.length > 0) insertOps.push(SystemLog.insertMany(data.system_logs));

    await Promise.all(insertOps);

    // 2. Hapus collection lama (hanya jika insert berhasil)
    await User.deleteMany({ _id: { $nin: (await User.find({ username: currentAdmin.username }).select('_id')).map(u => u._id) } });
    await Item.deleteMany({});
    await ServiceTicket.deleteMany({});
    await Transaction.deleteMany({});
    await SpecialOrder.deleteMany({});
    await SystemLog.deleteMany({});

    // 3. Pastikan admin pengimpor tetap bisa login (insertOne dengan password sudah di-hash, lewati pre-save hook)
    const adminExists = await User.findOne({ username: currentAdmin.username });
    if (!adminExists) {
      const adminDoc = currentAdmin.toObject();
      delete adminDoc._id;
      // Pakai insertOne agar pre('save') hook (hash password) tidak terpicu
      await User.collection.insertOne(adminDoc);
    }

    res.status(200).json({
      success: true,
      message: 'Data berhasil direstore'
    });
  } catch (error) {
    next(error);
  }
};
