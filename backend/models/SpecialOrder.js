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
    trim: true
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
  handled_by: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String
  },
  notes: {
    type: String,
    trim: true
  },
  timestamps: {
    created_at: { type: Date, default: Date.now },
    ordered_at: Date,
    arrived_at: Date,
    picked_up_at: Date,
    last_customer_reminder_at: Date
  }
});

// Calculate remaining payment
specialOrderSchema.virtual('remaining_payment').get(function() {
  return Math.max(0, this.estimated_price - this.down_payment);
});

specialOrderSchema.pre('save', async function() {
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
  }).sort({ 'timestamps.created_at': -1 });
  
  let nextNumber = 1;
  if (lastOrder) {
    const match = lastOrder.order_number.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
};

specialOrderSchema.set('toJSON', { virtuals: true });
specialOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SpecialOrder', specialOrderSchema);