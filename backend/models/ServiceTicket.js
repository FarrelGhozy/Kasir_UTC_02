// models/ServiceTicket.js - Service Ticket Schema with Embedded Documents
const mongoose = require('mongoose');

// Embedded sub-schemas
const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Customer phone is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['Mahasiswa', 'Dosen', 'Umum'],
    required: [true, 'Customer type is required']
  }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Device type is required'],
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  serial_number: {
    type: String,
    trim: true
  },
  symptoms: {
    type: String,
    required: [true, 'Device symptoms are required'],
    trim: true
  },
  accessories: {
    type: String,
    trim: true,
    default: 'None'
  }
}, { _id: false });

const technicianSchema = new mongoose.Schema({
  id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  }
}, { _id: false });

const partUsedSchema = new mongoose.Schema({
  item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  qty: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    }
  },
  price_at_time: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  }
}, { _id: true });

// Main Service Ticket Schema
const serviceTicketSchema = new mongoose.Schema({
  ticket_number: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  customer: {
    type: customerSchema,
    required: true
  },
  device: {
    type: deviceSchema,
    required: true
  },
  technician: {
    type: technicianSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress', 'Completed', 'Cancelled', 'Picked_Up'],
    default: 'Queue',
    required: true
  },
  parts_used: {
    type: [partUsedSchema],
    default: []
  },
  service_fee: {
    type: Number,
    min: [0, 'Service fee cannot be negative'],
    default: 0
  },
  total_cost: {
    type: Number,
    min: [0, 'Total cost cannot be negative'],
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  timestamps: {
    created_at: {
      type: Date,
      default: Date.now
    },
    diagnosed_at: {
      type: Date
    },
    completed_at: {
      type: Date
    },
    picked_up_at: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes
serviceTicketSchema.index({ status: 1 });
serviceTicketSchema.index({ 'technician.id': 1 });
serviceTicketSchema.index({ 'timestamps.created_at': -1 });
serviceTicketSchema.index({ 'customer.phone': 1 });

// ✅ FIX: Pre-save middleware without 'next' param (Async compatible)
serviceTicketSchema.pre('save', async function() {
  // 1. Calculate Total Cost
  let partsTotal = 0;
  if (this.parts_used && this.parts_used.length > 0) {
    partsTotal = this.parts_used.reduce((sum, part) => sum + part.subtotal, 0);
  }
  this.total_cost = partsTotal + (this.service_fee || 0);

  // 2. Generate Ticket Number
  if (this.isNew && !this.ticket_number) {
    try {
      this.ticket_number = await this.constructor.generateTicketNumber();
    } catch (error) {
      throw new Error('Failed to generate ticket number: ' + error.message);
    }
  }
});

// Static method to generate next ticket number
serviceTicketSchema.statics.generateTicketNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `SRV-${year}`;
  
  const lastTicket = await this.findOne({
    ticket_number: new RegExp(`^${prefix}`)
  }).sort({ ticket_number: -1 });
  
  let nextNumber = 1;
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.ticket_number.slice(-3));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
};

// ✅ FIX: Instance method to add parts (Removed Session)
serviceTicketSchema.methods.addPart = async function(itemId, quantity) {
  const Item = mongoose.model('Item');
  
  // No session here
  const item = await Item.findById(itemId);
  if (!item) {
    throw new Error('Item not found');
  }
  
  if (item.stock < quantity) {
    throw new Error(`Insufficient stock for ${item.name}. Available: ${item.stock}, Requested: ${quantity}`);
  }
  
  // Deduct stock
  item.stock -= quantity;
  await item.save(); // Save without session
  
  // Add to parts_used
  const subtotal = item.selling_price * quantity;
  this.parts_used.push({
    item_id: item._id,
    name: item.name,
    qty: quantity,
    price_at_time: item.selling_price,
    subtotal: subtotal
  });
  
  await this.save(); // Save without session
  return this;
};

// Instance method to update status with timestamp tracking
serviceTicketSchema.methods.updateStatus = async function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'Diagnosing' && !this.timestamps.diagnosed_at) {
    this.timestamps.diagnosed_at = new Date();
  } else if (newStatus === 'Completed' && !this.timestamps.completed_at) {
    this.timestamps.completed_at = new Date();
  } else if (newStatus === 'Picked_Up' && !this.timestamps.picked_up_at) {
    this.timestamps.picked_up_at = new Date();
  }
  
  await this.save();
  return this;
};

// Virtual for duration in days
serviceTicketSchema.virtual('duration_days').get(function() {
  if (!this.timestamps.completed_at) return null;
  const diff = this.timestamps.completed_at - this.timestamps.created_at;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

serviceTicketSchema.set('toJSON', { virtuals: true });
serviceTicketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ServiceTicket', serviceTicketSchema);