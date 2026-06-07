const mongoose = require('mongoose');
const Item = require('../../models/Item');
const { createItem, createUser } = require('../helpers/factory');

describe('Item - Stock Operations', () => {
  describe('deductStockAtomic', () => {
    it('should deduct stock when sufficient', async () => {
      const item = await createItem({ stock: 10 });
      const result = await Item.deductStockAtomic(item._id, 3);
      expect(result.stock).toBe(7);
    });

    it('should throw when stock insufficient', async () => {
      const item = await createItem({ stock: 2 });
      await expect(Item.deductStockAtomic(item._id, 5)).rejects.toThrow('Stok tidak cukup');
      const unchanged = await Item.findById(item._id);
      expect(unchanged.stock).toBe(2);
    });

    it('should throw when stock exactly at boundary (0)', async () => {
      const item = await createItem({ stock: 0 });
      await expect(Item.deductStockAtomic(item._id, 1)).rejects.toThrow();
    });

    it('should throw when item not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(Item.deductStockAtomic(fakeId, 1)).rejects.toThrow('Barang tidak ditemukan');
    });

    it('should handle concurrent deductions atomically', async () => {
      const item = await createItem({ stock: 5 });
      const results = await Promise.allSettled([
        Item.deductStockAtomic(item._id, 3),
        Item.deductStockAtomic(item._id, 3),
        Item.deductStockAtomic(item._id, 3)
      ]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(2);
    });
  });

  describe('addStockAtomic', () => {
    it('should add stock', async () => {
      const item = await createItem({ stock: 5 });
      await Item.addStockAtomic(item._id, 10);
      const updated = await Item.findById(item._id);
      expect(updated.stock).toBe(15);
    });
  });
});

describe('Item - Low Stock Detection', () => {
  it('should set isLowStock to true when stock is low', async () => {
    const item = new Item({
      sku: 'LOW-01', name: 'Low Stock Item',
      purchase_price: 1000, selling_price: 2000,
      stock: 2, min_stock_alert: 5
    });
    await item.save();
    expect(item.isLowStock).toBe(true);
  });

  it('should set isLowStock to false when stock is sufficient', async () => {
    const item = new Item({
      sku: 'OK-01', name: 'OK Stock Item',
      purchase_price: 1000, selling_price: 2000,
      stock: 10, min_stock_alert: 5
    });
    await item.save();
    expect(item.isLowStock).toBe(false);
  });

  it('getLowStockItems should return only low stock items', async () => {
    await createItem({ stock: 2, min_stock_alert: 5, sku: 'LOW-A' + Date.now() });
    await createItem({ stock: 20, min_stock_alert: 5, sku: 'OK-B' + Date.now() });
    const lowItems = await Item.getLowStockItems();
    expect(lowItems.length).toBeGreaterThanOrEqual(1);
    lowItems.forEach(item => {
      expect(item.isLowStock).toBe(true);
    });
  });
});

describe('Item - Price Validation', () => {
  it('should reject selling_price < purchase_price', async () => {
    await expect(Item.create({
      sku: 'PRICE-ERR', name: 'Price Error',
      purchase_price: 10000, selling_price: 5000,
      stock: 10
    })).rejects.toThrow('Harga jual');
  });

  it('should accept selling_price === purchase_price', async () => {
    const item = await Item.create({
      sku: 'PRICE-EQ' + Date.now(), name: 'Price Equal',
      purchase_price: 10000, selling_price: 10000,
      stock: 10
    });
    expect(item.selling_price).toBe(item.purchase_price);
  });

  it('should accept selling_price > purchase_price', async () => {
    const item = await Item.create({
      sku: 'PRICE-OK' + Date.now(), name: 'Price OK',
      purchase_price: 10000, selling_price: 15000,
      stock: 10
    });
    expect(item.selling_price).toBe(15000);
  });
});

describe('Item - profit_margin Virtual', () => {
  it('should calculate profit margin percentage', async () => {
    const item = new Item({
      sku: 'MARGIN', name: 'Margin Test',
      purchase_price: 10000, selling_price: 15000,
      stock: 10
    });
    expect(item.profit_margin).toBe('50.00');
  });

  it('should return 0 when purchase_price is 0', async () => {
    const item = new Item({
      sku: 'MARGIN-ZERO', name: 'Margin Zero',
      purchase_price: 0, selling_price: 15000,
      stock: 10
    });
    expect(Number(item.profit_margin)).toBe(0);
  });
});

describe('Item - Integer Validation', () => {
  it('should reject float stock', async () => {
    await expect(Item.create({
      sku: 'FLOAT', name: 'Float Stock',
      purchase_price: 1000, selling_price: 2000,
      stock: 5.5
    })).rejects.toThrow('bilangan bulat');
  });

  it('should reject float min_stock_alert', async () => {
    await expect(Item.create({
      sku: 'FLOAT2', name: 'Float Alert',
      purchase_price: 1000, selling_price: 2000,
      stock: 10, min_stock_alert: 2.5
    })).rejects.toThrow('bilangan bulat');
  });
});

describe('Item - CRUD Operations', () => {
  it('should soft delete item', async () => {
    const item = await createItem();
    item.isActive = false;
    await item.save();
    const deleted = await Item.findById(item._id);
    expect(deleted.isActive).toBe(false);
  });

  it('should reject duplicate SKU', async () => {
    const sku = 'DUP-SKU-' + Date.now();
    await Item.create({
      sku, name: 'First', purchase_price: 1000, selling_price: 2000, stock: 10
    });
    await expect(Item.create({
      sku, name: 'Second', purchase_price: 1000, selling_price: 2000, stock: 10
    })).rejects.toThrow();
  });
});
