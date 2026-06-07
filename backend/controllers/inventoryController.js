// controllers/inventoryController.js - Operasi CRUD Barang/Inventaris
const Item = require('../models/Item');

const allowedItemFields = ['name', 'sku', 'category', 'purchase_price', 'selling_price', 'stock', 'min_stock_alert', 'description', 'unit'];

function sanitizeItemBody(body) {
  const sanitized = {};
  for (const field of allowedItemFields) {
    if (body[field] !== undefined) {
      sanitized[field] = body[field];
    }
  }
  return sanitized;
}

/**
 * @desc    Buat barang baru
 * @route   POST /api/inventory
 * @access  Private (Admin)
 */
exports.createItem = async (req, res, next) => {
  try {
    const purchasePrice = Number(req.body.purchase_price !== undefined ? req.body.purchase_price : (req.body.purchasePrice || 0));
    const sellingPrice = Number(req.body.selling_price !== undefined ? req.body.selling_price : (req.body.sellingPrice || 0));

    if (sellingPrice < purchasePrice) {
      return res.status(400).json({
        success: false,
        message: 'Harga jual harus lebih besar atau sama dengan harga beli'
      });
    }

    const itemData = sanitizeItemBody(req.body);
    itemData.purchase_price = purchasePrice;
    itemData.selling_price = sellingPrice;

    const item = await Item.create(itemData);

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
      sort: rawSort = '-created_at'
    } = req.query;

    const allowedSortFields = ['name', 'sku', 'stock', 'category', 'selling_price', 'purchase_price', 'created_at', 'updated_at'];
    const sortDirection = rawSort.startsWith('-') ? '-' : '';
    const sortField = rawSort.replace(/^-/, '');
    const sort = allowedSortFields.includes(sortField) ? (sortDirection + sortField) : '-created_at';

    const filter = { isActive: true };
    
    if (category) filter.category = category;
    
    if (search && typeof search === 'string') {
      filter.$or = [
        { $text: { $search: search } },
        { sku: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ];
    }
    
    if (low_stock === 'true') {
      filter.isLowStock = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const items = await Item.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

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
    const item = await Item.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Perbarui data barang
 * @route   PUT /api/inventory/:id
 * @access  Private (Admin, Kasir)
 */
exports.updateItem = async (req, res, next) => {
  try {
    const currentItem = await Item.findById(req.params.id);
    if (!currentItem) {
      return res.status(404).json({ success: false, message: 'Barang tidak ditemukan' });
    }

    const pPriceInput = req.body.purchase_price;
    const sPriceInput = req.body.selling_price;

    const finalPPrice = pPriceInput !== undefined ? Number(pPriceInput) : currentItem.purchase_price;
    const finalSPrice = sPriceInput !== undefined ? Number(sPriceInput) : currentItem.selling_price;

    if (finalSPrice < finalPPrice) {
      return res.status(400).json({
        success: false,
        message: 'Harga jual harus lebih besar atau sama dengan harga beli'
      });
    }

    const updateData = sanitizeItemBody(req.body);
    updateData.purchase_price = finalPPrice;
    updateData.selling_price = finalSPrice;

    Object.assign(currentItem, updateData);
    await currentItem.save();

    res.status(200).json({
      success: true,
      message: 'Barang berhasil diperbarui',
      data: currentItem
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
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus bilangan bulat positif' });
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

/**
 * @desc    Import barang dari data JSON (hasil parsing CSV di frontend)
 * @route   POST /api/inventory/import
 * @access  Private (Admin)
 */
exports.importItems = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Data barang tidak valid' });
    }

    // Build bulkWrite operations — 1 round-trip ke MongoDB
    const operations = items
      .filter(item => item.sku && item.name)
      .map(item => ({
        updateOne: {
          filter: { sku: item.sku },
          update: {
            $set: {
              name: item.name,
              category: item.category || 'Other',
              purchase_price: Number(item.purchase_price) || 0,
              selling_price: Number(item.selling_price) || 0,
              stock: item.stock !== undefined && item.stock !== '' && !isNaN(Number(item.stock)) ? Number(item.stock) : 0,
              min_stock_alert: Number(item.min_stock_alert) || 5,
              isActive: true
            }
          },
          upsert: true
        }
      }));

    const failedCount = items.length - operations.length;

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data valid untuk diimport'
      });
    }

    const result = await Item.bulkWrite(operations);

    res.status(200).json({
      success: true,
      message: 'Proses import selesai',
      summary: {
        added: result.upsertedCount || 0,
        updated: result.matchedCount || 0,
        failed: failedCount
      }
    });
  } catch (error) {
    next(error);
  }
};