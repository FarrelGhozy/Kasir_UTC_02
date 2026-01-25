// models/Item.js - Skema Inventaris/Gudang
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU wajib diisi'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [50, 'SKU tidak boleh lebih dari 50 karakter']
  },
  name: {
    type: String,
    required: [true, 'Nama barang wajib diisi'],
    trim: true,
    maxlength: [200, 'Nama barang tidak boleh lebih dari 200 karakter']
  },
  category: {
    type: String,
    required: [true, 'Kategori wajib dipilih'],
    enum: {
      values: ['Sparepart', 'Accessory', 'Software', 'Service', 'Other'],
      message: '{VALUE} bukan kategori yang valid'
    },
    default: 'Sparepart'
  },
  purchase_price: {
    type: Number,
    required: [true, 'Harga beli (HPP) wajib diisi'],
    min: [0, 'Harga beli tidak boleh negatif'],
    default: 0
  },
  selling_price: {
    type: Number,
    required: [true, 'Harga jual wajib diisi'],
    min: [0, 'Harga jual tidak boleh negatif'],
    validate: {
      validator: function(value) {
        return value >= this.purchase_price;
      },
      message: 'Harga jual harus lebih besar atau sama dengan harga beli'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Jumlah stok wajib diisi'],
    min: [0, 'Stok tidak boleh negatif'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Stok harus berupa bilangan bulat'
    }
  },
  min_stock_alert: {
    type: Number,
    required: [true, 'Batas peringatan stok minimum wajib diisi'],
    min: [0, 'Batas stok minimum tidak boleh negatif'],
    default: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Batas stok minimum harus berupa bilangan bulat'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Deskripsi tidak boleh lebih dari 500 karakter']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes untuk performa
itemSchema.index({ category: 1 });
itemSchema.index({ stock: 1 });
itemSchema.index({ name: 'text' });
// SKU sudah unique: true di definisi schema

// Virtual untuk margin keuntungan
itemSchema.virtual('profit_margin').get(function() {
  if (this.purchase_price === 0) return 0;
  return ((this.selling_price - this.purchase_price) / this.purchase_price * 100).toFixed(2);
});

// Virtual untuk cek apakah stok menipis
itemSchema.virtual('is_low_stock').get(function() {
  return this.stock <= this.min_stock_alert;
});

// Method instance untuk mengurangi stok (dengan validasi)
itemSchema.methods.deductStock = async function(quantity) {
  if (this.stock < quantity) {
    throw new Error(`Stok tidak cukup untuk ${this.name}. Tersedia: ${this.stock}, Diminta: ${quantity}`);
  }
  
  this.stock -= quantity;
  this.updated_at = new Date();
  await this.save();
  return this;
};

// Method instance untuk menambah stok
itemSchema.methods.addStock = async function(quantity) {
  this.stock += quantity;
  this.updated_at = new Date();
  await this.save();
  return this;
};

// Method static untuk mengambil item dengan stok menipis
itemSchema.statics.getLowStockItems = function() {
  return this.find({
    $expr: { $lte: ['$stock', '$min_stock_alert'] },
    isActive: true
  }).sort({ stock: 1 });
};

// Middleware pre-save untuk update timestamp
itemSchema.pre('save', function() {
  this.updated_at = new Date();
});

// Pastikan virtuals disertakan dalam JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);