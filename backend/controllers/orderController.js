const SpecialOrder = require('../models/SpecialOrder');
const SystemLog = require('../models/SystemLog');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const { assertWAValidOrOverride, applyWACustomerMeta } = require('../utils/waValidation');
const { sendInvoiceEmail } = require('../services/emailService');

exports.createOrder = async (req, res, next) => {
  try {
    let { customer, item_name, item_description, estimated_price, down_payment, handled_by_id, notes, service_ticket } = req.body;

    if (typeof customer === 'string') {
      try { customer = JSON.parse(customer); } catch (e) { return res.status(400).json({ success: false, message: 'Format data pelanggan tidak valid (JSON rusak)' }); }
    }

    let handled_by = undefined;
    if (handled_by_id) {
      const user = await User.findById(handled_by_id).lean();
      if (user) {
        handled_by = { id: user._id, name: user.name };
      }
    }

    // Validasi WA otoritatif SEBELUM simpan: nomor invalid tanpa override -> 422, tanpa tulis DB.
    // Flag override ikut di dalam customer (FormData) atau top-level body (JSON).
    const overrideFlag = req.body.wa_override_confirmed === true
      || req.body.wa_override_confirmed === 'true'
      || (customer && (customer.wa_override_confirmed === true || customer.wa_override_confirmed === 'true'));
    const waCheck = await assertWAValidOrOverride(customer && customer.phone, {
      required: true,
      override: overrideFlag,
      logContext: { by: req.user && (req.user.username || req.user.id), source: 'createOrder' }
    });
    if (!waCheck.allowed) {
      return res.status(waCheck.status).json({
        success: false,
        code: waCheck.code,
        message: waCheck.message,
        waStatus: waCheck.waStatus
      });
    }
    if (customer && typeof customer === 'object') {
      // Client tidak boleh memalsukan badge WA — selalu tulis dari hasil cek server.
      delete customer.wa_override_confirmed;
      delete customer.is_wa_valid;
      delete customer.wa_status;
      delete customer.wa_checked_at;
      applyWACustomerMeta(customer, waCheck.waStatus);
    }

    // Validasi harga: DP tidak boleh melebihi estimasi (tolak 400, bukan auto-Lunas diam-diam).
    const estNum = estimated_price !== undefined && estimated_price !== null && estimated_price !== '' ? Number(estimated_price) : 0;
    const dpNum = down_payment !== undefined && down_payment !== null && down_payment !== '' ? Number(down_payment) : 0;
    if (!Number.isFinite(estNum) || estNum < 0) {
      return res.status(400).json({ success: false, message: 'Estimasi harga harus angka non-negatif' });
    }
    if (!Number.isFinite(dpNum) || dpNum < 0) {
      return res.status(400).json({ success: false, message: 'DP harus angka non-negatif' });
    }
    if (estNum > 0 && dpNum > estNum) {
      return res.status(400).json({ success: false, message: 'DP tidak boleh melebihi estimasi harga' });
    }

    const order_number = await SpecialOrder.generateOrderNumber();

    let photo = undefined;
    if (req.file) {
      const protocol = req.protocol;
      const host = req.get('host');
      photo = `${protocol}://${host}/api/uploads/${req.file.filename}`;
    }

    const order = await SpecialOrder.create({
      order_number,
      customer,
      item_name,
      item_description,
      estimated_price,
      down_payment,
      handled_by,
      photo,
      notes,
      service_ticket: service_ticket || undefined
    });
    
    if (order.customer.email) {
      // Fire-and-forget: email gagal JANGAN menggagalkan order yang sudah tersimpan
      // (kasir bisa kira gagal lalu membuat order duplikat).
      sendInvoiceEmail(order).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'EmailService',
          message: 'Gagal kirim email nota order',
          details: { order_id: order._id, error: err.message }
        }).catch(() => {});
      });
    }

    // Kirim notifikasi WA - SEKUENSE 3 PESAN
    if (order.customer.phone) {
      whatsappService.sendOrderWelcomeMessages(order).catch(err => {
        SystemLog.create({
          level: 'ERROR',
          source: 'WhatsAppService',
          message: 'Gagal kirim sekuense pesan sambutan (3 pesan)',
          details: { order_id: order._id, error: err.message }
        });
      });
    }

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, customer_phone, service_ticket, page = 1, limit = 20 } = req.query;
    const VALID_ORDER_STATUSES = ['Pending', 'Searching', 'Ordered', 'Arrived', 'Picked_Up', 'Cancelled'];
    const filter = {};
    if (status) {
      if (!VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Status pesanan tidak valid' });
      }
      filter.status = status;
    }
    if (customer_phone) filter['customer.phone'] = customer_phone;
    if (service_ticket) filter.service_ticket = service_ticket;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    let orders = await SpecialOrder.find(filter)
      .sort({ 'history.created_at': -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    orders = orders.map(o => ({
      ...o,
      remaining_payment: Math.max(0, (o.estimated_price || 0) - (o.down_payment || 0))
    }));

    const total = await SpecialOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        current_page: pageNum,
        total_pages: Math.ceil(total / limitNum),
        total_records: total
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await SpecialOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    order.remaining_payment = Math.max(0, (order.estimated_price || 0) - (order.down_payment || 0));
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    // Whitelist status: error transisi jadi 400 yang jelas, bukan 500 dari pre-save.
    const VALID_STATUSES = ['Pending', 'Searching', 'Ordered', 'Arrived', 'Picked_Up', 'Cancelled'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status pesanan tidak valid' });
    }
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    // Validasi transisi SEBELUM simpan agar kasir dapat 400, bukan 500.
    const allowedNext = SpecialOrder.validTransitions[order.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Transisi status tidak valid: ${order.status} → ${status}. Status yang diizinkan: ${allowedNext.join(', ') || 'tidak ada (status final)'}`
      });
    }

    // Aturan pengambilan: Picked_Up berarti barang diambil + lunas.
    // Jika masih ada sisa, tandai otomatis Lunas (sisa dilunasi saat ambil).
    if (status === 'Picked_Up') {
      order.payment_status = 'Lunas';
    }

    order.status = status;
    if (status === 'Ordered') order.history.ordered_at = new Date();
    if (status === 'Arrived') order.history.arrived_at = new Date();
    if (status === 'Picked_Up') order.history.picked_up_at = new Date();

    await order.save();
    
    if (order.customer.email) {
      await sendInvoiceEmail(order);
    }

    // Kirim notifikasi WA
    whatsappService.notifyOrderStatus(order).catch(err => console.error('[WhatsApp] Gagal kirim notifikasi status:', err.message));

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderDetails = async (req, res, next) => {
  try {
    let { customer, item_name, item_description, estimated_price, down_payment, handled_by_id, notes } = req.body;

    if (typeof customer === 'string') {
      try { customer = JSON.parse(customer); } catch (e) { return res.status(400).json({ success: false, message: 'Format data pelanggan tidak valid (JSON rusak)' }); }
    }
    
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    // Bila nomor HP diubah, validasi ulang ke WAHA sebelum disimpan (422 tanpa tulis DB).
    if (customer && customer.phone !== undefined) {
      const oldPhone = order.customer && order.customer.phone ? String(order.customer.phone) : '';
      if (String(customer.phone) !== oldPhone) {
        const overrideFlag = req.body.wa_override_confirmed === true
          || req.body.wa_override_confirmed === 'true'
          || customer.wa_override_confirmed === true
          || customer.wa_override_confirmed === 'true';
        const waCheck = await assertWAValidOrOverride(customer.phone, {
          required: true,
          override: overrideFlag,
          logContext: { by: req.user && (req.user.username || req.user.id), source: 'updateOrderDetails', order_number: order.order_number }
        });
        if (!waCheck.allowed) {
          return res.status(waCheck.status).json({
            success: false,
            code: waCheck.code,
            message: waCheck.message,
            waStatus: waCheck.waStatus
          });
        }
        delete customer.wa_override_confirmed;
        applyWACustomerMeta(customer, waCheck.waStatus);
      }
    }

    if (customer) order.customer = { ...order.customer.toObject(), ...customer };
    if (item_name) order.item_name = item_name;
    if (item_description !== undefined) order.item_description = item_description;
    if (estimated_price !== undefined) order.estimated_price = estimated_price;
    if (down_payment !== undefined) order.down_payment = down_payment;
    if (notes !== undefined) order.notes = notes;

    if (req.file) {
      const protocol = req.protocol;
      const host = req.get('host');
      order.photo = `${protocol}://${host}/api/uploads/${req.file.filename}`;
    }

    if (handled_by_id) {
      // Cek apakah ada perubahan penanggung jawab
      const isReassigned = order.handled_by && order.handled_by.id && order.handled_by.id.toString() !== handled_by_id;
      
      const user = await User.findById(handled_by_id).lean();
      if (user) {
        order.handled_by = { id: user._id, name: user.name };
        
        // Jika dipindah tugas ke orang baru, beri notifikasi
        if (isReassigned) {
          whatsappService.notifyOrderAssignment(user, order).catch(err => console.error('[WhatsApp] Gagal kirim notifikasi assignment:', err.message));
        }
      }
    }

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { payment_status } = req.body;
    if (!['Lunas', 'Belum Lunas'].includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Status pembayaran tidak valid' });
    }

    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    order.payment_status = payment_status;
    if (payment_status === 'Lunas') {
      order.status = 'Picked_Up';
      order.history.picked_up_at = new Date();

      const ServiceTicket = require('../models/ServiceTicket');
      let ticket = null;

      // Cari via direct reference
      if (order.service_ticket) {
        ticket = await ServiceTicket.findById(order.service_ticket);
      }

      // Fallback: cari dari nomor tiket di notes
      if (!ticket && order.notes) {
        const match = order.notes.match(/#([A-Z0-9-]+)/);
        if (match) {
          ticket = await ServiceTicket.findOne({ ticket_number: match[1] });
          if (ticket) {
            order.service_ticket = ticket._id;
          }
        }
      }

      if (ticket) {
        try {
          // Validasi transisi dulu: tiket final (Picked_Up/Cancelled) tidak bisa
          // dipaksa ke In_Progress — jangan biarkan order-tiket inkonsisten diam-diam.
          const allowedTicketNext = {
            'Queue': ['Diagnosing', 'Cancelled', 'Completed', 'In_Progress', 'Waiting_Part'],
            'Diagnosing': ['Waiting_Part', 'In_Progress', 'Cancelled', 'Queue', 'Completed'],
            'Waiting_Part': ['In_Progress', 'Cancelled', 'Queue', 'Diagnosing', 'Completed'],
            'In_Progress': ['Completed', 'Waiting_Part', 'Cancelled', 'Queue', 'Diagnosing'],
            'Completed': ['Picked_Up', 'In_Progress', 'Queue', 'Diagnosing', 'Waiting_Part'],
            'Cancelled': ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress'],
            'Picked_Up': []
          }[ticket.status] || [];
          if (allowedTicketNext.includes('In_Progress')) {
            await ticket.updateStatus('In_Progress');
          } else {
            console.error(`[Order] Tiket ${ticket.ticket_number} status ${ticket.status} tidak bisa ke In_Progress — order tetap Picked_Up tanpa ubah tiket`);
          }
        } catch (statusErr) {
          console.error(`[Order] Gagal update status tiket servis ${ticket._id}: ${statusErr.message}`);
        }
      }
    }
    await order.save();

    if (order.status === 'Picked_Up' && order.customer && order.customer.phone) {
      whatsappService.notifyOrderStatus(order).catch(err => {
        console.error('[updatePaymentStatus] Gagal kirim WA picked_up:', err.message);
      });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    
    // JIKA USER ADALAH ADMIN: Bisa hapus permanen (Overpower)
    if (req.user && req.user.role === 'admin') {
      await SpecialOrder.findByIdAndDelete(req.params.id).lean();
      return res.status(200).json({ success: true, message: 'Pesanan barang berhasil dihapus permanen oleh Admin' });
    }

    // JIKA BUKAN ADMIN: Hanya ubah status jadi Cancelled
    order.status = 'Cancelled';
    await order.save();

    if (order.customer && order.customer.phone) {
      whatsappService.notifyOrderStatus(order).catch(err => {
        console.error('[deleteOrder] Gagal kirim WA cancel:', err.message);
      });
    }
    
    res.status(200).json({ success: true, message: 'Pesanan berhasil dibatalkan' });
  } catch (error) {
    next(error);
  }
};