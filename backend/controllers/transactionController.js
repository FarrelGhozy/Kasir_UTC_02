// controllers/transactionController.js - Transaksi POS (Optimized & Secure)
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');

/**
 * @desc    Buat transaksi ritel (Dengan Validasi Stok 2 Tahap)
 * @route   POST /api/transactions
 * @access  Private (Kasir, Admin)
 */
exports.createRetailTransaction = async (req, res, next) => {
  try {
    const { items, payment_method, amount_paid, notes } = req.body;

    // 1. Validasi Input Dasar
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

    // --- FASE 1: VALIDASI & PERSIAPAN (Tanpa Mengubah Database) ---
    // Kita cek stok SEMUA barang dulu. Kalau ada 1 yang kurang, batalkan semua.
    
    const itemsToProcess = [];
    let grandTotal = 0;

    for (const cartItem of items) {
      const itemDB = await Item.findById(cartItem.item_id);
      
      // Cek eksistensi barang
      if (!itemDB) {
        return res.status(404).json({
          success: false,
          message: `Barang dengan ID ${cartItem.item_id} tidak ditemukan di database`
        });
      }

      // Cek stok cukup atau tidak
      if (itemDB.stock < cartItem.qty) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup: ${itemDB.name} (Sisa: ${itemDB.stock}, Diminta: ${cartItem.qty})`
        });
      }

      // Hitung subtotal & simpan data sementara di memori
      const subtotal = itemDB.selling_price * cartItem.qty;
      grandTotal += subtotal;

      itemsToProcess.push({
        dbItem: itemDB,     // Object Mongoose asli (untuk di-save nanti)
        name: itemDB.name,
        qty: cartItem.qty,
        price: itemDB.selling_price,
        subtotal: subtotal
      });
    }

    // Validasi Pembayaran (Khusus Tunai)
    if (payment_method === 'Cash' && amount_paid < grandTotal) {
      return res.status(400).json({
        success: false,
        message: `Uang pembayaran kurang! Total: ${grandTotal}, Dibayar: ${amount_paid}`
      });
    }

    // --- FASE 2: EKSEKUSI (Potong Stok & Simpan Transaksi) ---
    // Karena Fase 1 lolos, berarti semua stok AMAN. Sekarang kita eksekusi.

    const finalTransactionItems = [];

    for (const proc of itemsToProcess) {
      // A. POTONG STOK OTOMATIS
      proc.dbItem.stock -= proc.qty;
      await proc.dbItem.save(); // Simpan perubahan stok ke DB

      // B. Siapkan data untuk struk
      finalTransactionItems.push({
        item_id: proc.dbItem._id,
        name: proc.name,
        qty: proc.qty,
        price: proc.price,
        subtotal: proc.subtotal
      });
    }

    // Generate No Faktur
    const invoice_no = await Transaction.generateInvoiceNumber();

    // Simpan Transaksi Utama
    const transaction = new Transaction({
      invoice_no,
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: finalTransactionItems,
      grand_total: grandTotal,
      payment_method,
      amount_paid: amount_paid || grandTotal, // Jika non-tunai, anggap pas
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

    // --- KEMBALIKAN STOK (RESTORE STOCK) ---
    // Loop setiap barang yang dulu dibeli, kembalikan jumlahnya ke gudang
    for (const itemSold of transaction.items) {
      const itemInDb = await Item.findById(itemSold.item_id);
      
      if (itemInDb) {
        // Kembalikan stok
        itemInDb.stock += itemSold.qty;
        await itemInDb.save();
        console.log(`[RESTORE] Mengembalikan ${itemSold.qty} stok untuk ${itemInDb.name}`);
      }
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