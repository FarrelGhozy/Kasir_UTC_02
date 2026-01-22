// models/Transaction.js - POS/Retail Transaction Schema
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
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    }
  },
  price: {
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

const transactionSchema = new mongoose.Schema({
  invoice_no: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
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
  items: {
    type: [transactionItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'Transaction must have at least one item'
    }
  },
  grand_total: {
    type: Number,
    required: true,
    min: [0, 'Grand total cannot be negative']
  },
  payment_method: {
    type: String,
    enum: ['Cash', 'Transfer', 'QRIS', 'Card'],
    required: true,
    default: 'Cash'
  },
  amount_paid: {
    type: Number,
    min: [0, 'Amount paid cannot be negative'],
    default: 0
  },
  change: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
// transactionSchema.index({ invoice_no: 1 }, { unique: true });
transactionSchema.index({ cashier_id: 1 });
transactionSchema.index({ date: -1 });
transactionSchema.index({ payment_method: 1 });

// Pre-save validation for amount paid and change
transactionSchema.pre('save', function(next) {
  if (this.payment_method === 'Cash' && this.amount_paid > 0) {
    this.change = this.amount_paid - this.grand_total;
  } else {
    this.change = 0;
  }
  next();
});

// Static method to generate invoice number
transactionSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}`;
  
  // Find the latest invoice for this month
  const lastTransaction = await this.findOne({
    invoice_no: new RegExp(`^${prefix}`)
  }).sort({ invoice_no: -1 });
  
  let nextNumber = 1;
  if (lastTransaction) {
    const lastNumber = parseInt(lastTransaction.invoice_no.slice(-4));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

// Static method for daily revenue report
transactionSchema.statics.getDailyRevenue = async function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await this.aggregate([
    {
      $match: {
        date: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: '$grand_total' },
        transaction_count: { $sum: 1 },
        payment_methods: {
          $push: {
            method: '$payment_method',
            amount: '$grand_total'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total_revenue: 1,
        transaction_count: 1,
        payment_breakdown: {
          $reduce: {
            input: '$payment_methods',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $cond: [
                    { $in: ['$$this.method', ['$$value']] },
                    '$$value',
                    { ['$$this.method']: { $sum: ['$$this.amount', 0] } }
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { total_revenue: 0, transaction_count: 0 };
};

// Static method for monthly revenue report
transactionSchema.statics.getMonthlyRevenue = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  const result = await this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        daily_revenue: { $sum: '$grand_total' },
        transaction_count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: '$daily_revenue' },
        total_transactions: { $sum: '$transaction_count' },
        daily_breakdown: {
          $push: {
            day: '$_id',
            revenue: '$daily_revenue',
            transactions: '$transaction_count'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total_revenue: 1,
        total_transactions: 1,
        daily_breakdown: 1
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { total_revenue: 0, total_transactions: 0, daily_breakdown: [] };
};

module.exports = mongoose.model('Transaction', transactionSchema);