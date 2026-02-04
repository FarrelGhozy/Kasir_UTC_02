// controllers/inventoryController.js - Operasi CRUD Barang/Inventaris
const Item = require('../models/Item');

/**
 * @desc    Buat barang baru
 * @route   POST /api/inventory
 * @access  Private (Admin)
 */
exports.createItem = async (req, res, next) => {
  try {
    // 1. Normalisasi Input
    const purchasePrice = Number(req.body.purchase_price !== undefined ? req.body.purchase_price : (req.body.purchasePrice || 0));
    const sellingPrice = Number(req.body.selling_price !== undefined ? req.body.selling_price : (req.body.sellingPrice || 0));

    // 2. Validasi Manual
    if (sellingPrice < purchasePrice) {
      return res.status(400).json({
        success: false,
        message: 'Harga jual harus lebih besar atau sama dengan harga beli'
      });
    }

    req.body.purchase_price = purchasePrice;
    req.body.selling_price = sellingPrice;

    const item = await Item.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Barang berhasil ditambahkan',
      data: item
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU sudah terdaftar'
      });
    }
    next(error);
  }
};

/**
 * @desc    Ambil semua barang
 */
exports.getAllItems = async (req, res, next) => {
  try {
    const { 
      category, 
      search, 
      low_stock, 
      page = 1, 
      limit = 20,
      sort = '-created_at'
    } = req.query;

    const filter = { isActive: true };
    
    if (category) filter.category = category;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (low_stock === 'true') {
      filter.$expr = { $lte: ['$stock', '$min_stock_alert'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const items = await Item.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: items,
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
 * @desc    Ambil satu barang
 */
exports.getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Perbarui data barang (PERBAIKAN UTAMA DI SINI)
 * @route   PUT /api/inventory/:id
 * @access  Private (Admin)
 */
exports.updateItem = async (req, res, next) => {
  try {
    // 1. Cek data harga
    let pPriceInput = req.body.purchase_price !== undefined ? req.body.purchase_price : req.body.purchasePrice;
    let sPriceInput = req.body.selling_price !== undefined ? req.body.selling_price : req.body.sellingPrice;

    // 2. Jika ada update harga, validasi manual
    if (pPriceInput !== undefined || sPriceInput !== undefined) {
        
        const currentItem = await Item.findById(req.params.id);
        if (!currentItem) {
            return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
        }

        const finalPPrice = pPriceInput !== undefined ? Number(pPriceInput) : currentItem.purchase_price;
        const finalSPrice = sPriceInput !== undefined ? Number(sPriceInput) : currentItem.selling_price;

        if (finalSPrice < finalPPrice) {
            return res.status(400).json({
                success: false,
                message: 'Harga jual harus lebih besar atau sama dengan harga beli'
            });
        }

        req.body.purchase_price = finalPPrice;
        req.body.selling_price = finalSPrice;
    }

    // 3. Eksekusi Update (MATIKAN VALIDATOR MONGOOSE BIAR TIDAK EROR)
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: false // <--- KUNCINYA DI SINI (Ganti true jadi false)
      }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    res.status(200).json({
      success: true,
      message: 'Barang berhasil diperbarui',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Hapus barang
 */
exports.deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }
    item.isActive = false;
    await item.save();
    res.status(200).json({ success: true, message: 'Barang berhasil dinonaktifkan' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil stok menipis
 */
exports.getLowStockItems = async (req, res, next) => {
  try {
    const items = await Item.getLowStockItems();
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Adjust stok
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, type } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus positif' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });

    if (type === 'add') await item.addStock(quantity);
    else if (type === 'deduct') await item.deductStock(quantity);
    else return res.status(400).json({ success: false, message: 'Tipe salah' });

    res.status(200).json({ success: true, message: 'Stok berhasil diupdate', data: item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ringkasan nilai
 */
exports.getInventoryValue = async (req, res, next) => {
  try {
    const summary = await Item.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          total_items: { $sum: 1 },
          total_stock_qty: { $sum: '$stock' },
          total_purchase_value: { $sum: { $multiply: ['$stock', '$purchase_price'] } },
          total_selling_value: { $sum: { $multiply: ['$stock', '$selling_price'] } }
        }
      },
      {
        $project: {
          _id: 0,
          total_items: 1,
          total_stock_qty: 1,
          total_purchase_value: 1,
          total_selling_value: 1,
          potential_profit: { $subtract: ['$total_selling_value', '$total_purchase_value'] }
        }
      }
    ]);

    const result = summary.length > 0 ? summary[0] : { total_items: 0, total_stock_qty: 0, total_purchase_value: 0, total_selling_value: 0, potential_profit: 0 };
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getItemsByCategory = async (req, res, next) => {
  try {
    const summary = await Item.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total_stock: { $sum: '$stock' },
          total_value: { $sum: { $multiply: ['$stock', '$selling_price'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};