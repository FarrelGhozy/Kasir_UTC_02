// controllers/transactionController.js - POS Transaction without Atomic Sessions (Localhost Friendly)
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');

/**
 * @desc    Create retail transaction (FIXED: Removed Atomic Transactions for Local MongoDB)
 * @route   POST /api/transactions
 * @access  Private (Kasir, Admin)
 */
exports.createRetailTransaction = async (req, res, next) => {
  // HAPUS: Session & Transaction start (agar jalan di localhost biasa)
  
  try {
    const { items, payment_method, amount_paid, notes } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction must have at least one item'
      });
    }

    // Get cashier info
    const cashier = await User.findById(req.user.id);
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: 'Cashier not found'
      });
    }

    // Process each item
    const processedItems = [];
    let grandTotal = 0;

    for (const transactionItem of items) {
      const { item_id, qty } = transactionItem;

      // Find item
      const item = await Item.findById(item_id); // Hapus .session()
      if (!item) {
        return res.status(404).json({
          success: false,
          message: `Item with ID ${item_id} not found`
        });
      }

      // Check stock
      if (item.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Available: ${item.stock}, Requested: ${qty}`
        });
      }

      // Calculate subtotal
      const subtotal = item.selling_price * qty;
      grandTotal += subtotal;

      // Deduct stock (Direct Save)
      item.stock -= qty;
      await item.save(); // Hapus { session }

      // Add to processed items
      processedItems.push({
        item_id: item._id,
        name: item.name,
        qty: qty,
        price: item.selling_price,
        subtotal: subtotal
      });
    }

    // Generate invoice number
    const invoice_no = await Transaction.generateInvoiceNumber();

    // Create transaction
    const transaction = new Transaction({
      invoice_no,
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: processedItems,
      grand_total: grandTotal,
      payment_method,
      amount_paid: amount_paid || grandTotal,
      notes
    });

    await transaction.save(); // Hapus { session }

    res.status(201).json({
      success: true,
      message: 'Transaction completed successfully',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all transactions with filters
 * @route   GET /api/transactions
 * @access  Private
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { 
      cashier_id, 
      payment_method, 
      start_date, 
      end_date, 
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = {};
    if (cashier_id) filter.cashier_id = cashier_id;
    if (payment_method) filter.payment_method = payment_method;
    
    if (start_date || end_date) {
      filter.date = {};
      if (start_date) filter.date.$gte = new Date(start_date);
      if (end_date) filter.date.$lte = new Date(end_date);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(filter)
      .populate('cashier_id', 'name username role')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_records: total,
        records_per_page: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single transaction by ID
 * @route   GET /api/transactions/:id
 * @access  Private
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('cashier_id', 'name username role');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get transaction by invoice number
 * @route   GET /api/transactions/invoice/:invoice_no
 * @access  Private
 */
exports.getTransactionByInvoice = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ 
      invoice_no: req.params.invoice_no.toUpperCase() 
    }).populate('cashier_id', 'name username role');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get today's transactions summary
 * @route   GET /api/transactions/summary/today
 * @access  Private
 */
exports.getTodaySummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const summary = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          total_revenue: { $sum: '$grand_total' },
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
          total_transactions: 1,
          total_revenue: 1,
          cash: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payment_methods',
                    as: 'pm',
                    cond: { $eq: ['$$pm.method', 'Cash'] }
                  }
                },
                as: 'cash_pm',
                in: '$$cash_pm.amount'
              }
            }
          },
          transfer: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payment_methods',
                    as: 'pm',
                    cond: { $eq: ['$$pm.method', 'Transfer'] }
                  }
                },
                as: 'transfer_pm',
                in: '$$transfer_pm.amount'
              }
            }
          },
          qris: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payment_methods',
                    as: 'pm',
                    cond: { $eq: ['$$pm.method', 'QRIS'] }
                  }
                },
                as: 'qris_pm',
                in: '$$qris_pm.amount'
              }
            }
          },
          card: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payment_methods',
                    as: 'pm',
                    cond: { $eq: ['$$pm.method', 'Card'] }
                  }
                },
                as: 'card_pm',
                in: '$$card_pm.amount'
              }
            }
          }
        }
      }
    ]);

    const result = summary.length > 0 ? summary[0] : {
      total_transactions: 0,
      total_revenue: 0,
      cash: 0,
      transfer: 0,
      qris: 0,
      card: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete transaction (Admin only - use with caution)
 * @route   DELETE /api/transactions/:id
 * @access  Private (Admin)
 */
exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Transaction deleted (stock NOT restored)'
    });
  } catch (error) {
    next(error);
  }
};