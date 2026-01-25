// controllers/serviceController.js - Manajemen Tiket Servis dengan Pengurangan Stok Otomatis
const ServiceTicket = require('../models/ServiceTicket');
const Item = require('../models/Item');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Buat tiket servis baru
 * @route   POST /api/services
 * @access  Private (Teknisi, Admin)
 */
exports.createTicket = async (req, res, next) => {
  try {
    const { customer, device, technician_id, service_fee, notes } = req.body;

    // Validasi apakah teknisi ada
    const technician = await User.findById(technician_id);
    if (!technician || technician.role !== 'teknisi') {
      return res.status(400).json({
        success: false,
        message: 'ID Teknisi tidak valid'
      });
    }

    // Generate nomor tiket
    const ticket_number = await ServiceTicket.generateTicketNumber();

    // Buat tiket servis
    const ticket = await ServiceTicket.create({
      ticket_number,
      customer,
      device,
      technician: {
        id: technician._id,
        name: technician.name
      },
      service_fee: service_fee || 0,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Tiket servis berhasil dibuat',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil semua tiket servis dengan filter
 * @route   GET /api/services
 * @access  Private
 */
exports.getAllTickets = async (req, res, next) => {
  try {
    const { status, technician_id, customer_phone, start_date, end_date, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (technician_id) filter['technician.id'] = technician_id;
    if (customer_phone) filter['customer.phone'] = customer_phone;
    
    if (start_date || end_date) {
      filter['timestamps.created_at'] = {};
      if (start_date) filter['timestamps.created_at'].$gte = new Date(start_date);
      if (end_date) filter['timestamps.created_at'].$lte = new Date(end_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await ServiceTicket.find(filter)
      .sort({ 'timestamps.created_at': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ServiceTicket.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: tickets,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_records: total,
        records_per_page: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil satu tiket servis berdasarkan ID
 * @route   GET /api/services/:id
 * @access  Private
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket servis tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Perbarui status tiket servis
 * @route   PATCH /api/services/:id/status
 * @access  Private (Teknisi, Admin)
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket servis tidak ditemukan'
      });
    }

    await ticket.updateStatus(status);

    res.status(200).json({
      success: true,
      message: 'Status berhasil diperbarui',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Tambahkan suku cadang ke tiket servis (STOK BERKURANG OTOMATIS)
 * @route   POST /api/services/:id/parts
 * @access  Private (Teknisi, Admin)
 */
exports.addPartToService = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { item_id, quantity } = req.body;

    // Validasi input
    if (!item_id || !quantity || quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'ID Barang dan jumlah yang valid wajib diisi'
      });
    }

    // Cari tiket
    const ticket = await ServiceTicket.findById(req.params.id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Tiket servis tidak ditemukan'
      });
    }

    // Cari barang
    const item = await Item.findById(item_id).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Barang tidak ditemukan'
      });
    }

    // Cek ketersediaan stok
    if (item.stock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Stok tidak cukup untuk ${item.name}. Tersedia: ${item.stock}, Diminta: ${quantity}`
      });
    }

    // KRITIS: Kurangi stok secara atomik
    item.stock -= quantity;
    await item.save({ session });

    // Tambahkan part ke tiket
    const subtotal = item.selling_price * quantity;
    ticket.parts_used.push({
      item_id: item._id,
      name: item.name,
      qty: quantity,
      price_at_time: item.selling_price,
      subtotal: subtotal
    });

    await ticket.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Suku cadang berhasil ditambahkan dan stok telah dikurangi',
      data: ticket
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Perbarui biaya jasa
 * @route   PATCH /api/services/:id/service-fee
 * @access  Private (Teknisi, Admin)
 */
exports.updateServiceFee = async (req, res, next) => {
  try {
    const { service_fee } = req.body;

    if (service_fee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Biaya jasa tidak boleh negatif'
      });
    }

    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket servis tidak ditemukan'
      });
    }

    ticket.service_fee = service_fee;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Biaya jasa berhasil diperbarui',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus tiket servis (soft delete berdasarkan status)
 * @route   DELETE /api/services/:id
 * @access  Private (Hanya Admin)
 */
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Tiket servis tidak ditemukan'
      });
    }

    // Hanya izinkan penghapusan jika belum selesai
    if (ticket.status === 'Completed' || ticket.status === 'Picked_Up') {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus tiket yang sudah selesai atau diambil'
      });
    }

    await ticket.updateStatus('Cancelled');

    res.status(200).json({
      success: true,
      message: 'Tiket servis berhasil dibatalkan'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil beban kerja teknisi (hitung tiket aktif)
 * @route   GET /api/services/technician/:id/workload
 * @access  Private
 */
exports.getTechnicianWorkload = async (req, res, next) => {
  try {
    const workload = await ServiceTicket.aggregate([
      {
        $match: {
          'technician.id': new mongoose.Types.ObjectId(req.params.id),
          status: { $in: ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress'] }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: workload
    });
  } catch (error) {
    next(error);
  }
};