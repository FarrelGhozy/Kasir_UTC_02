// models/Item.js - Inventory/Gudang Schema
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [50, 'SKU cannot exceed 50 characters']
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [200, 'Item name cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Sparepart', 'Accessory', 'Software', 'Service', 'Other'],
      message: '{VALUE} is not a valid category'
    },
    default: 'Sparepart'
  },
  purchase_price: {
    type: Number,
    required: [true, 'Purchase price (HPP) is required'],
    min: [0, 'Purchase price cannot be negative'],
    default: 0
  },
  selling_price: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price cannot be negative'],
    validate: {
      validator: function(value) {
        return value >= this.purchase_price;
      },
      message: 'Selling price must be greater than or equal to purchase price'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Stock must be an integer'
    }
  },
  min_stock_alert: {
    type: Number,
    required: [true, 'Minimum stock alert threshold is required'],
    min: [0, 'Minimum stock alert cannot be negative'],
    default: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Minimum stock alert must be an integer'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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

// Indexes for performance
// itemSchema.index({ sku: 1 }, { unique: true });
// itemSchema.index({ category: 1 });
// itemSchema.index({ stock: 1 });
// itemSchema.index({ name: 'text' }); // Text search index
// ✅ BENAR - Tambahkan hanya yang belum ada
itemSchema.index({ category: 1 });
itemSchema.index({ stock: 1 });
itemSchema.index({ name: 'text' });
// SKU sudah unique: true di schema definition

// Virtual for profit margin
itemSchema.virtual('profit_margin').get(function() {
  if (this.purchase_price === 0) return 0;
  return ((this.selling_price - this.purchase_price) / this.purchase_price * 100).toFixed(2);
});

// Virtual to check if stock is low
itemSchema.virtual('is_low_stock').get(function() {
  return this.stock <= this.min_stock_alert;
});

// Instance method to deduct stock (with validation)
itemSchema.methods.deductStock = async function(quantity) {
  if (this.stock < quantity) {
    throw new Error(`Insufficient stock for ${this.name}. Available: ${this.stock}, Requested: ${quantity}`);
  }
  
  this.stock -= quantity;
  this.updated_at = new Date();
  await this.save();
  return this;
};

// Instance method to add stock
itemSchema.methods.addStock = async function(quantity) {
  this.stock += quantity;
  this.updated_at = new Date();
  await this.save();
  return this;
};

// Static method to get low stock items
itemSchema.statics.getLowStockItems = function() {
  return this.find({
    $expr: { $lte: ['$stock', '$min_stock_alert'] },
    isActive: true
  }).sort({ stock: 1 });
};

// Pre-save middleware to update timestamp
itemSchema.pre('save', function() {
  this.updated_at = new Date();
});

// Ensure virtuals are included in JSON
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Item', itemSchema);