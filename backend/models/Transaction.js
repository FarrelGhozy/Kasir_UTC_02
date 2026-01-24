// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema({
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
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  invoice_no: {
    type: String,
    unique: true
  },
  cashier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cashier_name: {
    type: String,
    required: true
  },
  items: [transactionItemSchema],
  grand_total: {
    type: Number,
    required: true,
    min: 0
  },
  payment_method: {
    type: String,
    enum: ['Cash', 'Transfer', 'QRIS', 'Card'],
    required: true
  },
  amount_paid: {
    type: Number,
    required: true,
    min: 0
  },
  change: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ✅ PERBAIKAN UTAMA: Menghapus parameter 'next'
transactionSchema.pre('save', async function() {
  // 1. Hitung Kembalian otomatis
  if (this.amount_paid >= this.grand_total) {
    this.change = this.amount_paid - this.grand_total;
  }

  // 2. Generate Nomor Invoice (INV-YYYYMM-XXXX)
  if (this.isNew && !this.invoice_no) {
    try {
        this.invoice_no = await this.constructor.generateInvoiceNumber();
    } catch (error) {
        throw new Error('Gagal membuat nomor invoice: ' + error.message);
    }
  }
});

// Fungsi Static untuk membuat nomor urut invoice
transactionSchema.statics.generateInvoiceNumber = async function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}`;

  const lastTransaction = await this.findOne({
    invoice_no: new RegExp(`^${prefix}`)
  }).sort({ invoice_no: -1 });

  let sequence = 1;
  if (lastTransaction) {
    const lastSequence = parseInt(lastTransaction.invoice_no.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

module.exports = mongoose.model('Transaction', transactionSchema);