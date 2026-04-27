// controllers/serviceController.js - Manajemen Tiket Servis (FIXED: No Transactions)
const ServiceTicket = require('../models/ServiceTicket');
const Item = require('../models/Item');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const whatsappService = require('../services/whatsappService');
const emailService = require('../services/emailService');
const mongoose = require('mongoose');

/**
 * @desc    Buat tiket servis baru
 */
exports.createTicket = async (req, res, next) => {
  try {
    let { customer, device, technician_id, service_fee, notes } = req.body;

    // Parse JSON strings if they come from FormData
    if (typeof customer === 'string') customer = JSON.parse(customer);
    if (typeof device === 'string') device = JSON.parse(device);

    const technician = await User.findById(technician_id);
    if (!technician || technician.role !== 'teknisi') {
      return res.status(400).json({ success: false, message: 'ID Teknisi tidak valid' });
    }

    const ticket_number = await ServiceTicket.generateTicketNumber();

    // Handling photos if uploaded
    const photos = {};
    if (req.files) {
      const baseURL = `${req.protocol}://${req.get('host')}`;
      if (req.files.front) photos.front = `${baseURL}/${req.files.front[0].path.replace(/\\/g, '/')}`;
      if (req.files.back) photos.back = `${baseURL}/${req.files.back[0].path.replace(/\\/g, '/')}`;
      if (req.files.left) photos.left = `${baseURL}/${req.files.left[0].path.replace(/\\/g, '/')}`;
      if (req.files.right) photos.right = `${baseURL}/${req.files.right[0].path.replace(/\\/g, '/')}`;
    }

    const ticket = await ServiceTicket.create({
      ticket_number,
      customer,
      device: { ...device, photos },
      technician: { id: technician._id, name: technician.name },
      service_fee: service_fee || 0,
      notes
    });

    // Kirim notifikasi WA ke Pelanggan (Jika ada nomor WA)
    if (ticket.customer.phone) {
      whatsappService.notifyServiceStatus(ticket).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'WhatsAppService',
          message: 'Gagal kirim notifikasi pembuatan tiket',
          details: { ticket_id: ticket._id, error: err.message }
        });
      });
    }

    // Kirim notifikasi WA ke Teknisi (Asynchronous)
    if (technician && technician.phone) {
      whatsappService.notifyTechnicianAssignment(technician, ticket).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'WhatsAppService',
          message: 'Gagal kirim notifikasi penugasan teknisi',
          details: { ticket_id: ticket._id, technician_id: technician._id, error: err.message }
        });
      });
    }

    res.status(201).json({ success: true, message: 'Tiket servis berhasil dibuat', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil semua tiket servis dengan filter
 */
exports.getAllTickets = async (req, res, next) => {
  try {
    const { status, technician_id, customer_phone, start_date, end_date, page = 1, limit = 20 } = req.query;

    const filter = {};
    
    if (status) {
        if (status.includes(',')) {
            filter.status = { $in: status.split(',') };
        } else {
            filter.status = status;
        }
    }

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

    // LOGIKA BARU: Jika status Completed, kirim email nota
    if (status === 'Completed') {
      emailService.sendInvoiceEmail(ticket).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'EmailService',
          message: 'Gagal kirim email nota otomatis',
          details: { ticket_id: ticket._id, error: err.message }
        });
      });
    }

    // LOGIKA BARU: Jika status Picked_Up, set garansi 14 hari
    if (status === 'Picked_Up') {
      ticket.warranty_expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await ticket.save();
    }

    // Kirim notifikasi WA
    if (ticket.customer.phone) {
      whatsappService.notifyServiceStatus(ticket).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'WhatsAppService',
          message: 'Gagal kirim update status via WA',
          details: { ticket_id: ticket._id, status, error: err.message }
        });
      });
    }

    res.status(200).json({ success: true, message: 'Status berhasil diperbarui', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Tambahkan suku cadang ke tiket servis (LOGIKA BARU: TANPA TRANSAKSI)
 */
exports.addPartToService = async (req, res, next) => {
  try {
    const { item_id, quantity } = req.body;

    if (!item_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'ID Barang dan jumlah valid wajib diisi' });
    }

    // 1. Cek Tiket
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Tiket servis tidak ditemukan' });
    }

    // 2. Validasi status tiket — diperlonggar: hanya Picked_Up yang dilarang tambah part
    if (['Picked_Up'].includes(ticket.status)) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menambah part ke tiket yang sudah diambil (Picked_Up)`
      });
    }

    // 3. Cek Barang
    const item = await Item.findById(item_id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    // 4. Cek Stok
    if (item.stock < quantity) {
      return res.status(400).json({ success: false, message: `Stok tidak cukup untuk ${item.name}. Sisa: ${item.stock}` });
    }

    // 5. Kurangi Stok & Simpan Barang
    item.stock -= quantity;
    await item.save();

    // 6. Update Tiket & Simpan — jika gagal, rollback stok
    try {
      const subtotal = item.selling_price * quantity;
      ticket.parts_used.push({
        item_id: item._id,
        name: item.name,
        qty: quantity,
        price_at_time: item.selling_price,
        subtotal: subtotal
      });
      await ticket.save();
    } catch (ticketSaveError) {
      // ROLLBACK: Kembalikan stok jika tiket gagal disimpan
      item.stock += quantity;
      await item.save();
      throw ticketSaveError;
    }

    res.status(200).json({ success: true, message: 'Part ditambahkan', data: ticket });
  } catch (error) {
    next(error);
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
 * @desc    Hapus tiket servis (Hard delete untuk Admin, Cancel untuk yang lain)
 */
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    // JIKA USER ADALAH ADMIN: Bisa hapus permanen (Overpower)
    if (req.user && req.user.role === 'admin') {
      await ServiceTicket.findByIdAndDelete(req.params.id);
      return res.status(200).json({ success: true, message: 'Tiket servis berhasil dihapus permanen oleh Admin' });
    }

    // JIKA BUKAN ADMIN: Hanya bisa membatalkan jika status belum final
    if (['Completed', 'Picked_Up', 'Cancelled'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Tiket ini tidak dapat dibatalkan (status final). Hanya Admin yang dapat menghapus data ini.' });
    }

    await ticket.updateStatus('Cancelled');
    res.status(200).json({ success: true, message: 'Tiket berhasil dibatalkan' });
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

/**
 * @desc    Update Detail Tiket (Nama, Perangkat, dll)
 * @route   PUT /api/services/:id
 */
exports.updateTicketDetails = async (req, res, next) => {
  try {
    let { customer, device, technician_id, service_fee, notes } = req.body;

    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
    }

    if (customer) {
        const customerData = typeof customer === 'string' ? JSON.parse(customer) : customer;
        ticket.customer = { ...ticket.customer.toObject(), ...customerData };
    }
    
    // Update device fields
    if (device) {
        const deviceData = typeof device === 'string' ? JSON.parse(device) : device;
        ticket.device = { ...ticket.device.toObject(), ...deviceData };
    }

    // Handling photos updates if uploaded
    if (req.files) {
      const baseURL = `${req.protocol}://${req.get('host')}`;
      if (req.files.front) ticket.device.photos.front = `${baseURL}/${req.files.front[0].path.replace(/\\/g, '/')}`;
      if (req.files.back) ticket.device.photos.back = `${baseURL}/${req.files.back[0].path.replace(/\\/g, '/')}`;
      if (req.files.left) ticket.device.photos.left = `${baseURL}/${req.files.left[0].path.replace(/\\/g, '/')}`;
      if (req.files.right) ticket.device.photos.right = `${baseURL}/${req.files.right[0].path.replace(/\\/g, '/')}`;
    }

    if (notes !== undefined) ticket.notes = notes;
    if (service_fee !== undefined) ticket.service_fee = service_fee;

    if (technician_id) {
      const isReassigned = ticket.technician && ticket.technician.id && ticket.technician.id.toString() !== technician_id;
      const technician = await User.findById(technician_id);
      if (technician && technician.role === 'teknisi') {
        ticket.technician = { id: technician._id, name: technician.name };
        if (isReassigned) {
          whatsappService.notifyTechnicianAssignment(technician, ticket).catch(err => console.error(err));
        }
      }
    }

    await ticket.save();
    res.status(200).json({ success: true, message: 'Data tiket berhasil diperbarui', data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validasi nomor WhatsApp via WAHA
 */
exports.validateWA = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Nomor WA wajib diisi' });

    const result = await whatsappService.checkExists(phone);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Kirim ulang notifikasi WA secara manual
 */
exports.resendWANotification = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    if (!ticket.customer.phone) {
      return res.status(400).json({ success: false, message: 'Pelanggan tidak memiliki nomor HP' });
    }

    const result = await whatsappService.notifyServiceStatus(ticket);
    if (result) {
      res.status(200).json({ success: true, message: 'Notifikasi WA berhasil dikirim ulang' });
    } else {
      res.status(500).json({ success: false, message: 'Gagal mengirim ulang notifikasi WA' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Klaim Garansi (Buat tiket baru berbasis tiket lama)
 */
exports.claimWarranty = async (req, res, next) => {
  try {
    const oldTicket = await ServiceTicket.findById(req.params.id);
    if (!oldTicket) return res.status(404).json({ success: false, message: 'Tiket asal tidak ditemukan' });

    // Cek apakah masih dalam masa garansi
    if (!oldTicket.warranty_expires_at || new Date() > oldTicket.warranty_expires_at) {
      return res.status(400).json({ success: false, message: 'Masa garansi telah habis' });
    }

    const ticket_number = await ServiceTicket.generateTicketNumber();
    
    // Buat tiket baru dengan data dari tiket lama
    const newTicket = new ServiceTicket({
      ticket_number: `GRS-${ticket_number.split('-')[1]}-${ticket_number.split('-')[2]}`, // Contoh: GRS-2026-0001
      customer: oldTicket.customer,
      device: oldTicket.device,
      technician: oldTicket.technician,
      status: 'Queue',
      service_fee: 0, // Garansi biasanya gratis jasa
      notes: `KLAIM GARANSI dari Tiket #${oldTicket.ticket_number}`,
      klaim_dari_id: oldTicket._id
    });

    await newTicket.save();
    res.status(201).json({ success: true, message: 'Tiket klaim garansi berhasil dibuat', data: newTicket });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil log sistem
 */
exports.getSystemLogs = async (req, res, next) => {
  try {
    const logs = await SystemLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};