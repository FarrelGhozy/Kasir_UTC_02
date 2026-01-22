// controllers/inventoryController.js - Inventory/Item CRUD Operations
const Item = require('../models/Item');

/**
 * @desc    Create new item
 * @route   POST /api/inventory
 * @access  Private (Admin)
 */
exports.createItem = async (req, res, next) => {
  try {
    const item = await Item.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }
    next(error);
  }
};

/**
 * @desc    Get all items with filters and search
 * @route   GET /api/inventory
 * @access  Private
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
    
    if (category) {
      filter.category = category;
    }
    
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
 * @desc    Get single item by ID
 * @route   GET /api/inventory/:id
 * @access  Private
 */
exports.getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update item
 * @route   PUT /api/inventory/:id
 * @access  Private (Admin)
 */
exports.updateItem = async (req, res, next) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete item (soft delete)
 * @route   DELETE /api/inventory/:id
 * @access  Private (Admin)
 */
exports.deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Soft delete
    item.isActive = false;
    await item.save();

    res.status(200).json({
      success: true,
      message: 'Item deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low stock items (stock <= min_stock_alert)
 * @route   GET /api/inventory/alerts/low-stock
 * @access  Private
 */
exports.getLowStockItems = async (req, res, next) => {
  try {
    const items = await Item.getLowStockItems();

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manually adjust stock (restock/correction)
 * @route   PATCH /api/inventory/:id/stock
 * @access  Private (Admin)
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, type } = req.body; // type: 'add' or 'deduct'

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number'
      });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (type === 'add') {
      await item.addStock(quantity);
    } else if (type === 'deduct') {
      await item.deductStock(quantity);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "add" or "deduct"'
      });
    }

    res.status(200).json({
      success: true,
      message: `Stock ${type === 'add' ? 'added' : 'deducted'} successfully`,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory value summary
 * @route   GET /api/inventory/summary/value
 * @access  Private (Admin)
 */
exports.getInventoryValue = async (req, res, next) => {
  try {
    const summary = await Item.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          total_items: { $sum: 1 },
          total_stock_qty: { $sum: '$stock' },
          total_purchase_value: { 
            $sum: { $multiply: ['$stock', '$purchase_price'] } 
          },
          total_selling_value: { 
            $sum: { $multiply: ['$stock', '$selling_price'] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          total_items: 1,
          total_stock_qty: 1,
          total_purchase_value: 1,
          total_selling_value: 1,
          potential_profit: {
            $subtract: ['$total_selling_value', '$total_purchase_value']
          }
        }
      }
    ]);

    const result = summary.length > 0 ? summary[0] : {
      total_items: 0,
      total_stock_qty: 0,
      total_purchase_value: 0,
      total_selling_value: 0,
      potential_profit: 0
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
 * @desc    Get items by category with stock summary
 * @route   GET /api/inventory/summary/by-category
 * @access  Private
 */
exports.getItemsByCategory = async (req, res, next) => {
  try {
    const summary = await Item.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total_stock: { $sum: '$stock' },
          total_value: { $sum: { $multiply: ['$stock', '$selling_price'] } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};