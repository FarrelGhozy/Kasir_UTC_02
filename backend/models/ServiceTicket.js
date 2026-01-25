// models/ServiceTicket.js - Skema Tiket Servis dengan Dokumen Tertanam (Embedded)
const mongoose = require('mongoose');

// Sub-schema tertanam
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
    required: [true, 'Tipe pelanggan wajib dipilih']
  }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Tipe perangkat wajib diisi'],
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
    required: [true, 'Keluhan/Gejala wajib diisi'],
    trim: true
  },
  accessories: {
    type: String,
    trim: true,
    default: 'Tidak ada'
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
    min: [1, 'Jumlah harus minimal 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Jumlah harus berupa bilangan bulat'
    }
  },
  price_at_time: {
    type: Number,
    required: true,
    min: [0, 'Harga tidak boleh negatif']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal tidak boleh negatif']
  }
}, { _id: true });

// Skema Utama Tiket Servis
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
    min: [0, 'Biaya jasa tidak boleh negatif'],
    default: 0
  },
  total_cost: {
    type: Number,
    min: [0, 'Total biaya tidak boleh negatif'],
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

// Middleware pre-save (Kompatibel dengan Async)
serviceTicketSchema.pre('save', async function() {
  // 1. Hitung Total Biaya
  let partsTotal = 0;
  if (this.parts_used && this.parts_used.length > 0) {
    partsTotal = this.parts_used.reduce((sum, part) => sum + part.subtotal, 0);
  }
  this.total_cost = partsTotal + (this.service_fee || 0);

  // 2. Generate Nomor Tiket
  if (this.isNew && !this.ticket_number) {
    try {
      this.ticket_number = await this.constructor.generateTicketNumber();
    } catch (error) {
      throw new Error('Gagal membuat nomor tiket: ' + error.message);
    }
  }
});

// Method static untuk membuat nomor tiket berikutnya
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

// Method instance untuk menambah part (Tanpa Session untuk kompatibilitas Localhost)
serviceTicketSchema.methods.addPart = async function(itemId, quantity) {
  const Item = mongoose.model('Item');
  
  const item = await Item.findById(itemId);
  if (!item) {
    throw new Error('Barang tidak ditemukan');
  }
  
  if (item.stock < quantity) {
    throw new Error(`Stok tidak cukup untuk ${item.name}. Tersedia: ${item.stock}, Diminta: ${quantity}`);
  }
  
  // Kurangi stok
  item.stock -= quantity;
  await item.save();
  
  // Tambahkan ke parts_used
  const subtotal = item.selling_price * quantity;
  this.parts_used.push({
    item_id: item._id,
    name: item.name,
    qty: quantity,
    price_at_time: item.selling_price,
    subtotal: subtotal
  });
  
  await this.save();
  return this;
};

// Method instance untuk update status dengan pelacakan waktu
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

// Virtual untuk durasi pengerjaan dalam hari
serviceTicketSchema.virtual('duration_days').get(function() {
  if (!this.timestamps.completed_at) return null;
  const diff = this.timestamps.completed_at - this.timestamps.created_at;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

serviceTicketSchema.set('toJSON', { virtuals: true });
serviceTicketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ServiceTicket', serviceTicketSchema);