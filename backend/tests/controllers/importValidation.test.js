// tests/controllers/importValidation.test.js — import CSV ketat
const { importItems } = require('../../controllers/inventoryController');
const Item = require('../../models/Item');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('inventoryController.importItems validasi ketat', () => {
  it('400 bila > 1000 baris', async () => {
    const res = mockRes();
    const rows = Array.from({ length: 1001 }, (_, i) => ({ sku: `S${i}`, name: `B${i}` }));
    await importItems({ body: { items: rows } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('SKU lowercase dinormalisasi ke uppercase (tidak duplikat case)', async () => {
    const res = mockRes();
    await importItems(
      { body: { items: [{ sku: 'norm-case-1', name: 'Barang', category: 'Sparepart', purchase_price: 1000, selling_price: 2000, stock: 5 }] } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const found = await Item.findOne({ sku: 'NORM-CASE-1' }).lean();
    expect(found).toBeTruthy();
  });

  it('baris harga-negatif ditolak dan dihitung gagal', async () => {
    const res = mockRes();
    await importItems(
      { body: { items: [{ sku: 'BADPRICE1', name: 'X', category: 'Sparepart', purchase_price: -5, selling_price: 10 }] } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('Tidak ada data valid untuk diimport');
  });

  it('barang nonaktif TIDAK reaktif diam-diam oleh import', async () => {
    const sku = `DISC-${Date.now()}`;
    await Item.create({ sku, name: 'Lama', category: 'Sparepart', purchase_price: 1000, selling_price: 2000, stock: 1, isActive: false });
    const res = mockRes();
    await importItems(
      { body: { items: [{ sku: sku.toLowerCase(), name: 'Baru', category: 'Sparepart', purchase_price: 1000, selling_price: 2000, stock: 9 }] } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const after = await Item.findOne({ sku }).lean();
    expect(after.isActive).toBe(false);
    expect(after.stock).toBe(9);
  });
});
