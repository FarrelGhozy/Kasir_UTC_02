// controllers/serviceController.js - Manajemen Tiket Servis (FIXED: Filter Multi-Status)
const ServiceTicket = require('../models/ServiceTicket');
const Item = require('../models/Item');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Buat tiket servis baru
 */
exports.createTicket = async (req, res, next) => {
  try {
    const { customer, device, technician_id, service_fee, notes } = req.body;

    const technician = await User.findById(technician_id);
    if (!technician || technician.role !== 'teknisi') {
      return res.status(400).json({ success: false, message: 'ID Teknisi tidak valid' });
    }

    const ticket_number = await ServiceTicket.generateTicketNumber();

    const ticket = await ServiceTicket.create({
      ticket_number,
      customer,
      device,
      technician: { id: technician._id, name: technician.name },
      service_fee: service_fee || 0,
      notes
    });

    res.status(201).json({ success: true, message: 'Tiket servis berhasil dibuat', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil semua tiket servis dengan filter (PERBAIKAN UTAMA DI SINI)
 * @route   GET /api/services
 */
exports.getAllTickets = async (req, res, next) => {
  try {
    const { status, technician_id, customer_phone, start_date, end_date, page = 1, limit = 20 } = req.query;

    const filter = {};
    
    // --- PERBAIKAN LOGIKA FILTER STATUS ---
    if (status) {
        // Jika ada koma (misal: 'Queue,Diagnosing'), pecah jadi array untuk query $in
        if (status.includes(',')) {
            filter.status = { $in: status.split(',') };
        } else {
            filter.status = status;
        }
    }
    // -------------------------------------

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
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket servis tidak ditemukan' });
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Perbarui status tiket servis
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket servis tidak ditemukan' });

    await ticket.updateStatus(status);
    res.status(200).json({ success: true, message: 'Status berhasil diperbarui', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Tambahkan suku cadang ke tiket servis
 */
exports.addPartToService = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { item_id, quantity } = req.body;

    if (!item_id || !quantity || quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'ID Barang dan jumlah valid wajib diisi' });
    }

    const ticket = await ServiceTicket.findById(req.params.id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Tiket servis tidak ditemukan' });
    }

    const item = await Item.findById(item_id).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    if (item.stock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Stok tidak cukup untuk ${item.name}` });
    }

    item.stock -= quantity;
    await item.save({ session });

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

    res.status(200).json({ success: true, message: 'Part ditambahkan', data: ticket });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Perbarui biaya jasa
 */
exports.updateServiceFee = async (req, res, next) => {
  try {
    const { service_fee } = req.body;
    if (service_fee < 0) return res.status(400).json({ success: false, message: 'Biaya tidak boleh negatif' });

    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    ticket.service_fee = service_fee;
    await ticket.save();

    res.status(200).json({ success: true, message: 'Biaya jasa diperbarui', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus tiket servis
 */
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    if (ticket.status === 'Completed' || ticket.status === 'Picked_Up') {
      return res.status(400).json({ success: false, message: 'Tiket selesai tidak bisa dihapus' });
    }

    await ticket.updateStatus('Cancelled');
    res.status(200).json({ success: true, message: 'Tiket dibatalkan' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil beban kerja teknisi
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
        $group: { _id: '$status', count: { $sum: 1 } }
      }
    ]);
    res.status(200).json({ success: true, data: workload });
  } catch (error) {
    next(error);
  }
};