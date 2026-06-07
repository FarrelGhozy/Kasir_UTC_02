const mongoose = require('mongoose');
const Item = require('../../models/Item');
const { createItem } = require('../helpers/factory');
const {
  createItem: createItemController,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  getLowStockItems,
  adjustStock,
  getInventoryValue,
  getItemsByCategory,
  importItems
} = require('../../controllers/inventoryController');

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Inventory Controller', () => {
  describe('createItem', () => {
    it('should create an item successfully', async () => {
      const req = mockReq({
        body: {
          sku: 'NEW-SKU-001',
          name: 'Barang Baru',
          category: 'Sparepart',
          purchase_price: 10000,
          selling_price: 15000,
          stock: 10,
          min_stock_alert: 5
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createItemController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Barang berhasil ditambahkan',
          data: expect.objectContaining({ name: 'Barang Baru' })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when selling_price < purchase_price', async () => {
      const req = mockReq({
        body: {
          sku: 'PRICE-ERR',
          name: 'Price Error',
          purchase_price: 20000,
          selling_price: 10000,
          stock: 5
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createItemController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Harga jual harus lebih besar atau sama dengan harga beli'
        })
      );
    });

    it('should return 400 on duplicate SKU', async () => {
      const sku = 'DUP-SKU-' + Date.now();
      await Item.create({
        sku, name: 'Existing', category: 'Sparepart',
        purchase_price: 5000, selling_price: 10000, stock: 5
      });

      const req = mockReq({
        body: {
          sku,
          name: 'Duplicate',
          category: 'Sparepart',
          purchase_price: 5000,
          selling_price: 10000,
          stock: 5
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createItemController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'SKU sudah terdaftar'
        })
      );
    });

    it('should return 400 on validation error', async () => {
      const req = mockReq({
        body: {
          sku: 'NO-NAME',
          category: 'Sparepart',
          purchase_price: 5000,
          selling_price: 10000,
          stock: 5
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createItemController(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('getAllItems', () => {
    it('should return all active items', async () => {
      await createItem({ sku: 'ALL-1-' + Date.now() });
      await createItem({ sku: 'ALL-2-' + Date.now() });

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.length).toBe(2);
      expect(responseData.pagination.total_records).toBe(2);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 5; i++) {
        await createItem({ sku: `PAG-${i}-${Date.now()}` });
      }

      const req = mockReq({ query: { page: '1', limit: '2' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBe(2);
      expect(responseData.pagination.current_page).toBe(1);
      expect(responseData.pagination.total_pages).toBe(3);
      expect(responseData.pagination.total_records).toBe(5);
    });

    it('should filter by category', async () => {
      await createItem({ sku: 'CAT-A-' + Date.now(), category: 'Sparepart' });
      await createItem({ sku: 'CAT-B-' + Date.now(), category: 'Accessory' });

      const req = mockReq({ query: { category: 'Accessory' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBe(1);
      expect(responseData.data[0].category).toBe('Accessory');
    });

    it('should search by name or sku', async () => {
      await createItem({ sku: 'SCH-NAME-' + Date.now(), name: 'Keyboard Mekanik' });

      const req = mockReq({ query: { search: 'Keyboard' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBeGreaterThanOrEqual(1);
      expect(responseData.data.every(i => i.isActive)).toBe(true);
    });

    it('should filter low stock items', async () => {
      await createItem({ sku: 'LOW-FLTR-A-' + Date.now(), stock: 2, min_stock_alert: 5 });
      await createItem({ sku: 'LOW-FLTR-B-' + Date.now(), stock: 20, min_stock_alert: 5 });

      const req = mockReq({ query: { low_stock: 'true' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBe(1);
      expect(responseData.data[0].isLowStock).toBe(true);
    });

    it('should sort by different fields', async () => {
      await createItem({ sku: 'SORT-B-' + Date.now(), name: 'B Item', purchase_price: 3000, selling_price: 5000 });
      await createItem({ sku: 'SORT-A-' + Date.now(), name: 'A Item', purchase_price: 5000, selling_price: 10000 });

      const req = mockReq({ query: { sort: 'name' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data[0].name).toBe('A Item');
      expect(responseData.data[1].name).toBe('B Item');
    });

    it('should exclude inactive items', async () => {
      const item = await createItem({ sku: 'INACTIVE-' + Date.now() });
      item.isActive = false;
      await item.save();

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      await getAllItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBe(0);
    });
  });

  describe('getItemById', () => {
    it('should return item by id', async () => {
      const item = await createItem();

      const req = mockReq({ params: { id: item._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getItemById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ _id: expect.any(Object) })
        })
      );
    });

    it('should return 404 when item not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockReq({ params: { id: fakeId.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getItemById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Barang tidak ditemukan'
        })
      );
    });
  });

  describe('updateItem', () => {
    it('should update an item successfully', async () => {
      const item = await createItem();

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { name: 'Updated Name', selling_price: 25000 }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Barang berhasil diperbarui',
          data: expect.objectContaining({ name: 'Updated Name' })
        })
      );

      const updated = await Item.findById(item._id);
      expect(updated.name).toBe('Updated Name');
    });

    it('should return 400 when selling < purchase', async () => {
      const item = await createItem({ purchase_price: 10000, selling_price: 15000 });

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { selling_price: 5000 }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Harga jual harus lebih besar atau sama dengan harga beli'
        })
      );
    });

    it('should return 404 when item not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockReq({
        params: { id: fakeId.toString() },
        body: { name: 'Ghost' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Barang tidak ditemukan'
        })
      );
    });

    it('should return 400 on duplicate SKU', async () => {
      const skuA = 'UPD-DUP-A-' + Date.now();
      const skuB = 'UPD-DUP-B-' + Date.now();
      const itemA = await createItem({ sku: skuA });
      await createItem({ sku: skuB });

      const req = mockReq({
        params: { id: itemA._id.toString() },
        body: { sku: skuB }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'SKU sudah terdaftar'
        })
      );
    });
  });

  describe('deleteItem', () => {
    it('should soft delete an item', async () => {
      const item = await createItem();

      const req = mockReq({ params: { id: item._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await deleteItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Barang berhasil dinonaktifkan'
        })
      );

      const deleted = await Item.findById(item._id);
      expect(deleted.isActive).toBe(false);
    });

    it('should return 404 when item not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockReq({ params: { id: fakeId.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await deleteItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Barang tidak ditemukan'
        })
      );
    });
  });

  describe('getLowStockItems', () => {
    it('should return low stock items', async () => {
      await createItem({ sku: 'LOW-A-' + Date.now(), stock: 2, min_stock_alert: 5 });
      await createItem({ sku: 'LOW-B-' + Date.now(), stock: 1, min_stock_alert: 3 });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getLowStockItems(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.count).toBeGreaterThanOrEqual(2);
      responseData.data.forEach(item => {
        expect(item.isLowStock).toBe(true);
      });
    });

    it('should return empty when no low stock items', async () => {
      await createItem({ sku: 'HIGH-A-' + Date.now(), stock: 50, min_stock_alert: 5 });
      await createItem({ sku: 'HIGH-B-' + Date.now(), stock: 30, min_stock_alert: 5 });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getLowStockItems(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.length).toBe(0);
      expect(responseData.count).toBe(0);
    });
  });

  describe('adjustStock', () => {
    it('should add stock successfully', async () => {
      const item = await createItem({ stock: 10 });

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { quantity: 5, type: 'add' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Stok berhasil diupdate'
        })
      );

      const updated = await Item.findById(item._id);
      expect(updated.stock).toBe(15);
    });

    it('should deduct stock successfully', async () => {
      const item = await createItem({ stock: 10 });

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { quantity: 3, type: 'deduct' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      const updated = await Item.findById(item._id);
      expect(updated.stock).toBe(7);
    });

    it('should return 404 when item not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const req = mockReq({
        params: { id: fakeId.toString() },
        body: { quantity: 5, type: 'add' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Barang tidak ditemukan'
        })
      );
    });

    it('should return 400 on invalid quantity (non-positive)', async () => {
      const item = await createItem();

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { quantity: -5, type: 'add' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Jumlah harus bilangan bulat positif'
        })
      );
    });

    it('should return 400 on invalid quantity (non-integer)', async () => {
      const item = await createItem();

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { quantity: 2.5, type: 'add' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 on invalid type', async () => {
      const item = await createItem();

      const req = mockReq({
        params: { id: item._id.toString() },
        body: { quantity: 5, type: 'invalid' }
      });
      const res = mockRes();
      const next = jest.fn();

      await adjustStock(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Tipe salah'
        })
      );
    });
  });

  describe('getInventoryValue', () => {
    it('should return inventory value summary', async () => {
      await createItem({
        sku: 'VAL-A-' + Date.now(), stock: 10,
        purchase_price: 5000, selling_price: 10000
      });
      await createItem({
        sku: 'VAL-B-' + Date.now(), stock: 5,
        purchase_price: 20000, selling_price: 30000
      });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getInventoryValue(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.total_items).toBe(2);
      expect(responseData.data.total_stock_qty).toBe(15);
      expect(responseData.data.total_purchase_value).toBe(150000);
      expect(responseData.data.total_selling_value).toBe(250000);
      expect(responseData.data.potential_profit).toBe(100000);
    });

    it('should return zero values when no items', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getInventoryValue(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data).toEqual({
        total_items: 0,
        total_stock_qty: 0,
        total_purchase_value: 0,
        total_selling_value: 0,
        potential_profit: 0
      });
    });
  });

  describe('getItemsByCategory', () => {
    it('should return items grouped by category', async () => {
      await createItem({
        sku: 'GRP-A1-' + Date.now(), category: 'Sparepart',
        stock: 5, selling_price: 10000
      });
      await createItem({
        sku: 'GRP-A2-' + Date.now(), category: 'Sparepart',
        stock: 10, selling_price: 20000
      });
      await createItem({
        sku: 'GRP-B-' + Date.now(), category: 'Accessory',
        stock: 3, selling_price: 50000
      });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getItemsByCategory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.length).toBe(2);

      const sparepart = responseData.data.find(g => g._id === 'Sparepart');
      const accessory = responseData.data.find(g => g._id === 'Accessory');
      expect(sparepart).toBeDefined();
      expect(sparepart.count).toBe(2);
      expect(sparepart.total_stock).toBe(15);
      expect(accessory).toBeDefined();
      expect(accessory.count).toBe(1);
    });
  });

  describe('importItems', () => {
    it('should import items with upsert', async () => {
      const existingSku = 'IMPORT-EXIST-' + Date.now();
      await createItem({ sku: existingSku, stock: 5, name: 'Old Name' });

      const req = mockReq({
        body: {
          items: [
            {
              sku: existingSku, name: 'Updated Name',
              category: 'Sparepart', purchase_price: 10000,
              selling_price: 20000, stock: 10
            },
            {
              sku: 'IMPORT-NEW-' + Date.now(), name: 'New Item',
              category: 'Accessory', purchase_price: 5000,
              selling_price: 15000, stock: 3
            }
          ]
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await importItems(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Proses import selesai');
      expect(responseData.summary.added + responseData.summary.updated).toBe(2);

      const existing = await Item.findOne({ sku: existingSku });
      expect(existing.name).toBe('Updated Name');
      expect(existing.stock).toBe(10);
    });

    it('should return 400 on invalid data', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = jest.fn();

      await importItems(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Data barang tidak valid'
        })
      );
    });

    it('should return 400 when no valid items', async () => {
      const req = mockReq({
        body: {
          items: [
            { sku: '', name: '' },
            { sku: null, name: '' }
          ]
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await importItems(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Tidak ada data valid untuk diimport'
        })
      );
    });
  });
});
