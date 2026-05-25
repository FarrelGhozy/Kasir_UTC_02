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
  isLowStock: {
    type: Boolean,
    default: false
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
itemSchema.index({ isActive: 1, category: 1 });
itemSchema.index({ isActive: 1, stock: 1 });
itemSchema.index({ isLowStock: 1, isActive: 1 });
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

// Method instance untuk mengurangi stok
itemSchema.methods.deductStock = async function(quantity) {
  const Item = mongoose.model('Item');
  const result = await Item.findOneAndUpdate(
    { _id: this._id, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );
  if (!result) {
    throw new Error(`Stok tidak cukup untuk ${this.name}. Tersedia: ${this.stock}, Diminta: ${quantity}`);
  }
  return result;
};

// Method instance untuk menambah stok
itemSchema.methods.addStock = async function(quantity) {
  const Item = mongoose.model('Item');
  return Item.findByIdAndUpdate(this._id, { $inc: { stock: quantity } }, { new: true });
};

// Static method atomic untuk deduct stok
itemSchema.statics.deductStockAtomic = async function(id, quantity) {
  const result = await this.findOneAndUpdate(
    { _id: id, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );
  if (!result) {
    const item = await this.findById(id);
    throw new Error(item ? `Stok tidak cukup untuk ${item.name}` : 'Barang tidak ditemukan');
  }
  return result;
};

// Static method atomic untuk add stok
itemSchema.statics.addStockAtomic = async function(id, quantity) {
  return this.findByIdAndUpdate(id, { $inc: { stock: quantity } }, { new: true });
};

// Method static untuk mengambil item dengan stok menipis
itemSchema.statics.getLowStockItems = function() {
  return this.find({ isLowStock: true, isActive: true }).sort({ stock: 1 });
};

// Middleware pre-save untuk update timestamp dan isLowStock
itemSchema.pre('save', function() {
  this.updated_at = new Date();
  this.isLowStock = this.stock <= this.min_stock_alert;
});

// Pastikan virtuals disertakan dalam JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);