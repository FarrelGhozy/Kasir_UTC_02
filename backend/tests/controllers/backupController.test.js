// tests/controllers/backupController.test.js
const backup = require('../../controllers/backupController');
const { createAdmin, createItem } = require('../helpers/factory');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('backupController.exportData', () => {
  it('200 + struktur koleksi lengkap', async () => {
    await createItem();
    const res = mockRes();
    await backup.exportData({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    for (const k of ['users', 'items', 'service_tickets', 'transactions', 'special_orders', 'system_logs']) {
      expect(Array.isArray(data[k])).toBe(true);
    }
  });
});

describe('backupController.importData (validasi-dulu)', () => {
  it('400 bila body tanpa data', async () => {
    const res = mockRes();
    await backup.importData({ body: {}, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila users/items hilang', async () => {
    const res = mockRes();
    await backup.importData({ body: { data: { foo: 1 } }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila ada dokumen rusak (null) — SEBELUM hapus data', async () => {
    const admin = await createAdmin();
    const before = await require('../../models/User').countDocuments();
    const res = mockRes();
    await backup.importData(
      { body: { data: { users: [null], items: [] } }, user: { id: admin._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    const after = await require('../../models/User').countDocuments();
    expect(after).toBe(before);
  });

  it('400 bila bagian koleksi bukan array', async () => {
    const admin = await createAdmin();
    const res = mockRes();
    await backup.importData(
      { body: { data: { users: [], items: 'rusak' } }, user: { id: admin._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('200 restore valid + admin yang login tetap bisa login', async () => {
    const admin = await createAdmin();
    const Item = require('../../models/Item');
    const item = await createItem();
    const { exportData } = backup;
    const expRes = mockRes();
    await exportData({}, expRes, jest.fn());
    const snapshot = JSON.parse(JSON.stringify(expRes.json.mock.calls[0][0].data));

    const res = mockRes();
    await backup.importData(
      { body: { data: snapshot }, user: { id: admin._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const stillThere = await Item.findOne({ sku: item.sku }).lean();
    expect(stillThere).toBeTruthy();
  });
});
