// controllers/backupController.js
const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
const Item = require('../models/Item');
const ServiceTicket = require('../models/ServiceTicket');
const Transaction = require('../models/Transaction');
const SpecialOrder = require('../models/SpecialOrder');
const SystemLog = require('../models/SystemLog');
const backupService = require('../services/backupService');
const { convertDateStringsToDates, convertObjectIdFields } = require('../utils/dateUtils');

/**
 * @desc    Export all system data
 * @route   GET /api/admin/backup/export
 * @access  Private (Admin)
 */
exports.exportData = async (req, res, next) => {
  try {
    const data = {
      users: await User.find({}).select('+password').lean(),
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

    const currentAdmin = await User.findById(req.user.id).select('+password').lean();
    const adminUsername = currentAdmin?.username || 'admin-utc01';

    // Simpan data admin agar tetap bisa login setelah restore
    const adminDoc = currentAdmin ? { ...currentAdmin } : {};
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

    // 2. Konversi string tanggal ke Date object & string ObjectId ke ObjectId asli
    //    (biar query filter tanggal, findById, populate, dll berfungsi normal)
    if (data.users?.length > 0) {
      data.users.forEach(convertDateStringsToDates);
      data.users.forEach(convertObjectIdFields);
    }
    if (data.items?.length > 0) {
      data.items.forEach(convertDateStringsToDates);
      data.items.forEach(convertObjectIdFields);
    }
    if (data.service_tickets?.length > 0) {
      data.service_tickets.forEach(convertDateStringsToDates);
      data.service_tickets.forEach(convertObjectIdFields);
    }
    if (data.transactions?.length > 0) {
      data.transactions.forEach(convertDateStringsToDates);
      data.transactions.forEach(convertObjectIdFields);
    }
    if (data.special_orders?.length > 0) {
      data.special_orders.forEach(convertDateStringsToDates);
      data.special_orders.forEach(convertObjectIdFields);
    }
    if (data.system_logs?.length > 0) {
      data.system_logs.forEach(convertDateStringsToDates);
      data.system_logs.forEach(convertObjectIdFields);
    }

    // 3. Insert data dari backup (tanpa hook agar password tetap ter-hash)
    const insertOps = [];
    if (data.users?.length > 0) {
      // Filter admin yg sedang login agar tidak konflik — nanti di-insert manual
      const filteredUsers = data.users.filter(u => u.username !== adminUsername);
      if (filteredUsers.length > 0) insertOps.push(User.collection.insertMany(filteredUsers));
    }
    if (data.items?.length > 0) insertOps.push(Item.collection.insertMany(data.items));
    if (data.service_tickets?.length > 0) insertOps.push(ServiceTicket.collection.insertMany(data.service_tickets));
    if (data.transactions?.length > 0) insertOps.push(Transaction.collection.insertMany(data.transactions));
    if (data.special_orders?.length > 0) insertOps.push(SpecialOrder.collection.insertMany(data.special_orders));
    if (data.system_logs?.length > 0) insertOps.push(SystemLog.collection.insertMany(data.system_logs));

    await Promise.all(insertOps);

    // 4. Insert ulang admin yg sedang login (pakai collection.insertOne agar pre('save') hook tidak terpicu)
    if (currentAdmin) {
      const adminExists = await User.collection.findOne({ username: adminUsername });
      if (!adminExists) {
        await User.collection.insertOne({ ...adminDoc, _id: currentAdmin._id });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Data berhasil direstore'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Daftar file backup di disk
 * @route   GET /api/admin/backup/files
 * @access  Private (Admin)
 */
exports.listBackupFiles = async (req, res, next) => {
  try {
    const files = backupService.listBackups();
    res.status(200).json({ success: true, data: files });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restore data dari file backup di disk
 * @route   POST /api/admin/backup/restore/:filename
 * @access  Private (Admin)
 */
exports.restoreBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    await backupService.restoreFromFile(filename, req.user.id);
    res.status(200).json({ success: true, message: 'Data berhasil direstore' });
  } catch (error) {
    if (error.message === 'File backup tidak ditemukan') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Format file backup tidak valid') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc    Download file backup
 * @route   GET /api/admin/backup/files/:filename
 * @access  Private (Admin)
 */
exports.downloadBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const filePath = backupService.getBackupFilePath(filename);
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    }
    res.download(filePath, path.basename(filename));
  } catch (error) {
    next(error);
  }
};
