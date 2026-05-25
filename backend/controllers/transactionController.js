// controllers/transactionController.js - Transaksi POS (Optimized & Secure)
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');

/**
 * @desc    Buat transaksi ritel (Atomic Stock Deduction)
 * @route   POST /api/transactions
 * @access  Private (Kasir, Admin)
 */
exports.createRetailTransaction = async (req, res, next) => {
  try {
    const { items, payment_method, amount_paid, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Keranjang belanja tidak boleh kosong'
      });
    }

    const cashier = await User.findById(req.user.id);
    if (!cashier) {
      return res.status(404).json({ success: false, message: 'Kasir tidak ditemukan' });
    }

    // --- FASE 1: VALIDASI ---
    // Validasi semua input tanpa mengubah database
    
    // Batch lookup semua item sekali
    const itemIds = items.map(i => i.item_id);
    const itemMap = {};
    (await Item.find({ _id: { $in: itemIds } })).forEach(item => {
      itemMap[item._id.toString()] = item;
    });

    const transactionItems = [];
    let grandTotal = 0;

    for (const cartItem of items) {
      const qty = Number(cartItem.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Jumlah barang harus bilangan bulat positif'
        });
      }

      const itemDB = itemMap[cartItem.item_id];

      if (!itemDB) {
        return res.status(404).json({
          success: false,
          message: `Barang dengan ID ${cartItem.item_id} tidak ditemukan`
        });
      }

      if (itemDB.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup: ${itemDB.name} (Sisa: ${itemDB.stock}, Diminta: ${qty})`
        });
      }

      const subtotal = itemDB.selling_price * qty;
      grandTotal += subtotal;

      transactionItems.push({
        item_id: itemDB._id,
        name: itemDB.name,
        qty,
        price: itemDB.selling_price,
        subtotal
      });
    }

    const pm = String(payment_method || '');
    const validMethods = ['Cash', 'QRIS', 'Transfer', 'Card'];
    if (!validMethods.includes(pm)) {
      return res.status(400).json({
        success: false,
        message: `Metode pembayaran harus salah satu: ${validMethods.join(', ')}`
      });
    }

    if (pm === 'Cash' && Number(amount_paid) < grandTotal) {
      return res.status(400).json({
        success: false,
        message: `Uang pembayaran kurang! Total: ${grandTotal}, Dibayar: ${amount_paid}`
      });
    }

    // --- FASE 2: EKSEKUSI ATOMIC ---
    // Potong stok satu per satu secara atomic, rollback jika gagal
    const deductedItemIds = [];

    try {
      for (const ti of transactionItems) {
        const updated = await Item.deductStockAtomic(ti.item_id, ti.qty);
        deductedItemIds.push(ti.item_id);
        ti.price = updated.selling_price;
        ti.subtotal = updated.selling_price * ti.qty;
      }
    } catch (stockError) {
      // Rollback: kembalikan stok yang sudah dipotong
      for (const id of deductedItemIds) {
        await Item.addStockAtomic(id, transactionItems.find(t => t.item_id.equals ? t.item_id.equals(id) : t.item_id === id)?.qty || 0).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: stockError.message
      });
    }

    // Generate No Faktur
    const invoice_no = await Transaction.generateInvoiceNumber();

    const finalAmountPaid = amount_paid !== undefined && amount_paid !== null ? Number(amount_paid) : grandTotal;

    const transaction = new Transaction({
      invoice_no,
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: transactionItems,
      grand_total: grandTotal,
      payment_method: pm,
      amount_paid: finalAmountPaid,
      notes,
      date: new Date()
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil!',
      data: transaction
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil semua transaksi dengan filter
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { 
      cashier_id, payment_method, start_date, end_date, 
      page = 1, limit = 20 
    } = req.query;

    const filter = {};
    if (cashier_id) filter.cashier_id = cashier_id;
    if (payment_method) filter.payment_method = payment_method;
    
    if (start_date || end_date) {
      filter.date = {};
      if (start_date) filter.date.$gte = new Date(start_date);
      if (end_date) {
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
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
 * @desc    Ambil satu transaksi berdasarkan ID
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('cashier_id', 'name username role');

    if (!transaction) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil transaksi berdasarkan Invoice
 */
exports.getTransactionByInvoice = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ 
      invoice_no: req.params.invoice_no.toUpperCase() 
    }).populate('cashier_id', 'name username role');

    if (!transaction) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ringkasan hari ini
 */
exports.getTodaySummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const summary = await Transaction.aggregate([
      { $match: { date: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          total_revenue: { $sum: '$grand_total' },
          payment_methods: { $push: { method: '$payment_method', amount: '$grand_total' } }
        }
      },
      {
        $project: {
          _id: 0,
          total_transactions: 1,
          total_revenue: 1,
          cash: { $sum: { $map: { input: { $filter: { input: '$payment_methods', as: 'pm', cond: { $eq: ['$$pm.method', 'Cash'] } } }, as: 'val', in: '$$val.amount' } } },
          transfer: { $sum: { $map: { input: { $filter: { input: '$payment_methods', as: 'pm', cond: { $eq: ['$$pm.method', 'Transfer'] } } }, as: 'val', in: '$$val.amount' } } },
          qris: { $sum: { $map: { input: { $filter: { input: '$payment_methods', as: 'pm', cond: { $eq: ['$$pm.method', 'QRIS'] } } }, as: 'val', in: '$$val.amount' } } },
          card: { $sum: { $map: { input: { $filter: { input: '$payment_methods', as: 'pm', cond: { $eq: ['$$pm.method', 'Card'] } } }, as: 'val', in: '$$val.amount' } } }
        }
      }
    ]);

    const result = summary.length > 0 ? summary[0] : { total_transactions: 0, total_revenue: 0, cash: 0, transfer: 0, qris: 0, card: 0 };
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus transaksi & KEMBALIKAN STOK
 * @route   DELETE /api/transactions/:id
 * @access  Private (Admin)
 */
exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan'
      });
    }

    // --- KEMBALIKAN STOK ATOMIC ---
    for (const itemSold of transaction.items) {
      await Item.addStockAtomic(itemSold.item_id, itemSold.qty).catch(err => {
        console.error(`[RESTORE] Gagal mengembalikan stok ${itemSold.item_id}:`, err.message);
      });
    }

    // Hapus data transaksi permanen
    await Transaction.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Transaksi dihapus dan stok barang telah DIKEMBALIKAN ke gudang'
    });
  } catch (error) {
    next(error);
  }
};