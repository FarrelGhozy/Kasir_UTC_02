const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nama pelanggan wajib diisi'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Nomor telepon pelanggan wajib diisi'],
    trim: true,
    match: [/^(08|\+628|628)\d{7,12}$/, 'Format nomor telepon tidak valid. Gunakan format: 08xx-xxxx-xxxx atau +628xx-xxxx-xxxx']
  },
  type: {
    type: String,
    enum: ['Mahasiswa', 'Dosen', 'Umum'],
    default: 'Umum'
  }
}, { _id: false });

const specialOrderSchema = new mongoose.Schema({
  order_number: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  customer: {
    type: customerSchema,
    required: true
  },
  item_name: {
    type: String,
    required: [true, 'Nama barang wajib diisi'],
    trim: true
  },
  item_description: {
    type: String,
    trim: true
  },
  estimated_price: {
    type: Number,
    default: 0,
    min: 0
  },
  down_payment: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Searching', 'Ordered', 'Arrived', 'Picked_Up', 'Cancelled'],
    default: 'Pending'
  },
  payment_status: {
    type: String,
    enum: ['Belum Lunas', 'Lunas'],
    default: 'Belum Lunas'
  },
  handled_by: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String
  },
  photo: {
    type: String
  },
  service_ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceTicket'
  },
  notes: {
    type: String,
    trim: true
  },
  history: {
    created_at: { type: Date, default: Date.now },
    ordered_at: Date,
    arrived_at: Date,
    picked_up_at: Date,
    last_customer_reminder_at: Date
  }
}, { timestamps: true });

// Valid state transitions map
specialOrderSchema.statics.validTransitions = {
  'Pending': ['Searching', 'Picked_Up', 'Cancelled'],
  'Searching': ['Ordered', 'Picked_Up', 'Cancelled'],
  'Ordered': ['Arrived', 'Picked_Up', 'Cancelled'],
  'Arrived': ['Picked_Up', 'Cancelled'],
  'Picked_Up': ['Cancelled'],
  'Cancelled': ['Pending']
};

// Calculate remaining payment
specialOrderSchema.virtual('remaining_payment').get(function() {
  return Math.max(0, this.estimated_price - this.down_payment);
});

specialOrderSchema.pre('save', async function() {
  // Status transition validation
  if (this.isModified('status') && !this.isNew) {
    const original = await this.constructor.findById(this._id).select('status').lean();
    const originalStatus = original?.status;
    if (originalStatus) {
      const transitions = this.constructor.validTransitions;
      const allowedNext = transitions[originalStatus];
      if (!allowedNext) {
        throw new Error(`Status tidak dikenali: ${originalStatus}`);
      }
      if (!allowedNext.includes(this.status)) {
        throw new Error(
          `Transisi status tidak valid: ${originalStatus} → ${this.status}. ` +
          `Status yang diizinkan: ${allowedNext.join(', ') || 'tidak ada (status final)'}`
        );
      }
    }
  }

  // Generate nomor pesanan
  if (this.isNew && !this.order_number) {
    try {
      this.order_number = await this.constructor.generateOrderNumber();
    } catch (error) {
      throw new Error('Gagal membuat nomor pesanan: ' + error.message);
    }
  }
});

specialOrderSchema.statics.generateOrderNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}`;
  const lastOrder = await this.findOne({
    order_number: new RegExp(`^${prefix}`)
  }).sort({ 'history.created_at': -1 });
  
  let nextNumber = 1;
  if (lastOrder) {
    const match = lastOrder.order_number.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
};

specialOrderSchema.index({ status: 1, 'history.created_at': -1 });
specialOrderSchema.index({ 'customer.phone': 1 });
// order_number already indexed via unique: true in schema

specialOrderSchema.set('toJSON', { virtuals: true });
specialOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SpecialOrder', specialOrderSchema);