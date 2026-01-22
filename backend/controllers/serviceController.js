// controllers/serviceController.js - Service Ticket Management with Auto Stock Deduction
const ServiceTicket = require('../models/ServiceTicket');
const Item = require('../models/Item');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Create new service ticket
 * @route   POST /api/services
 * @access  Private (Teknisi, Admin)
 */
exports.createTicket = async (req, res, next) => {
  try {
    const { customer, device, technician_id, service_fee, notes } = req.body;

    // Validate technician exists
    const technician = await User.findById(technician_id);
    if (!technician || technician.role !== 'teknisi') {
      return res.status(400).json({
        success: false,
        message: 'Invalid technician ID'
      });
    }

    // Generate ticket number
    const ticket_number = await ServiceTicket.generateTicketNumber();

    // Create service ticket
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
      message: 'Service ticket created successfully',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all service tickets with filters
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
 * @desc    Get single service ticket by ID
 * @route   GET /api/services/:id
 * @access  Private
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Service ticket not found'
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
 * @desc    Update service ticket status
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
        message: 'Service ticket not found'
      });
    }

    await ticket.updateStatus(status);

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add spare part to service ticket (AUTO STOCK DEDUCTION)
 * @route   POST /api/services/:id/parts
 * @access  Private (Teknisi, Admin)
 */
exports.addPartToService = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { item_id, quantity } = req.body;

    // Validate inputs
    if (!item_id || !quantity || quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Item ID and valid quantity are required'
      });
    }

    // Find ticket
    const ticket = await ServiceTicket.findById(req.params.id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Service ticket not found'
      });
    }

    // Find item
    const item = await Item.findById(item_id).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Check stock availability
    if (item.stock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${item.name}. Available: ${item.stock}, Requested: ${quantity}`
      });
    }

    // CRITICAL: Deduct stock atomically
    item.stock -= quantity;
    await item.save({ session });

    // Add part to ticket
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
      message: 'Part added and stock deducted successfully',
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
 * @desc    Update service fee
 * @route   PATCH /api/services/:id/service-fee
 * @access  Private (Teknisi, Admin)
 */
exports.updateServiceFee = async (req, res, next) => {
  try {
    const { service_fee } = req.body;

    if (service_fee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Service fee cannot be negative'
      });
    }

    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Service ticket not found'
      });
    }

    ticket.service_fee = service_fee;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Service fee updated successfully',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete service ticket (soft delete by status)
 * @route   DELETE /api/services/:id
 * @access  Private (Admin only)
 */
exports.deleteTicket = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Service ticket not found'
      });
    }

    // Only allow deletion if not completed
    if (ticket.status === 'Completed' || ticket.status === 'Picked_Up') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed or picked up tickets'
      });
    }

    await ticket.updateStatus('Cancelled');

    res.status(200).json({
      success: true,
      message: 'Service ticket cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get technician workload (count active tickets)
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