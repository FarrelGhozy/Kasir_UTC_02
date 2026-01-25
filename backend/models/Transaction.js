// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema({
  item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: [true, 'ID Barang wajib diisi']
  },
  name: {
    type: String,
    required: [true, 'Nama barang wajib diisi']
  },
  qty: {
    type: Number,
    required: [true, 'Jumlah barang wajib diisi'],
    min: [1, 'Jumlah barang minimal 1']
  },
  price: {
    type: Number,
    required: [true, 'Harga barang wajib diisi'],
    min: [0, 'Harga tidak boleh negatif']
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal wajib diisi'],
    min: [0, 'Subtotal tidak boleh negatif']
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
    required: [true, 'ID Kasir wajib diisi']
  },
  cashier_name: {
    type: String,
    required: [true, 'Nama Kasir wajib diisi']
  },
  items: {
    type: [transactionItemSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Transaksi harus memiliki setidaknya satu barang'
    }
  },
  grand_total: {
    type: Number,
    required: [true, 'Total akhir wajib diisi'],
    min: [0, 'Total akhir tidak boleh negatif']
  },
  payment_method: {
    type: String,
    enum: {
      values: ['Cash', 'Transfer', 'QRIS', 'Card'],
      message: '{VALUE} bukan metode pembayaran yang valid'
    },
    required: [true, 'Metode pembayaran wajib dipilih']
  },
  amount_paid: {
    type: Number,
    required: [true, 'Jumlah bayar wajib diisi'],
    min: [0, 'Jumlah bayar tidak boleh negatif']
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

// ✅ PERBAIKAN UTAMA: Menghapus parameter 'next' (Async compatible)
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