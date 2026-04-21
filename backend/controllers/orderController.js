const SpecialOrder = require('../models/SpecialOrder');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');

exports.createOrder = async (req, res, next) => {
  try {
    const { customer, item_name, item_description, estimated_price, down_payment, handled_by_id, notes } = req.body;

    let handled_by = undefined;
    if (handled_by_id) {
      const user = await User.findById(handled_by_id);
      if (user) {
        handled_by = { id: user._id, name: user.name };
      }
    }

    const order_number = await SpecialOrder.generateOrderNumber();

    const order = await SpecialOrder.create({
      order_number,
      customer,
      item_name,
      item_description,
      estimated_price,
      down_payment,
      handled_by,
      notes
    });

    // Kirim notifikasi WA
    whatsappService.notifyOrderStatus(order);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, customer_phone, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (customer_phone) filter['customer.phone'] = customer_phone;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await SpecialOrder.find(filter)
      .sort({ 'timestamps.created_at': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SpecialOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_records: total
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    order.status = status;
    if (status === 'Ordered') order.timestamps.ordered_at = new Date();
    if (status === 'Arrived') order.timestamps.arrived_at = new Date();
    if (status === 'Picked_Up') order.timestamps.picked_up_at = new Date();

    await order.save();

    // Kirim notifikasi WA
    whatsappService.notifyOrderStatus(order);

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderDetails = async (req, res, next) => {
  try {
    const { customer, item_name, item_description, estimated_price, down_payment, handled_by_id, notes } = req.body;
    
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });

    if (customer) order.customer = { ...order.customer.toObject(), ...customer };
    if (item_name) order.item_name = item_name;
    if (item_description !== undefined) order.item_description = item_description;
    if (estimated_price !== undefined) order.estimated_price = estimated_price;
    if (down_payment !== undefined) order.down_payment = down_payment;
    if (notes !== undefined) order.notes = notes;

    if (handled_by_id) {
      // Cek apakah ada perubahan penanggung jawab
      const isReassigned = order.handled_by && order.handled_by.id && order.handled_by.id.toString() !== handled_by_id;
      
      const user = await User.findById(handled_by_id);
      if (user) {
        order.handled_by = { id: user._id, name: user.name };
        
        // Jika dipindah tugas ke orang baru, beri notifikasi
        if (isReassigned) {
          whatsappService.notifyOrderAssignment(user, order);
        }
      }
    }

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    
    // Instead of hard delete, maybe just cancel? User might want to keep records.
    order.status = 'Cancelled';
    await order.save();
    
    res.status(200).json({ success: true, message: 'Pesanan dibatalkan' });
  } catch (error) {
    next(error);
  }
};