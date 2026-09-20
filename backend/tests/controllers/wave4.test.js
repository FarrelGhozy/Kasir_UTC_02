// tests/controllers/wave4.test.js — regression Wave 4 backend
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
jest.mock('../../services/emailService', () => require('../helpers/mocks').mockEmailService);

const { createOrder } = require('../../controllers/orderController');
const { createRetailTransaction } = require('../../controllers/transactionController');
const { createTicket, addPartToService, removePartFromService, updateStatus, claimWarranty } = require('../../controllers/serviceController');
const { register, updateUser, deleteUser, getMe } = require('../../controllers/authController');
const { createSchedule } = require('../../controllers/dutyScheduleController');
const { createAdmin, createKasir, createTeknisi, createItem, createServiceTicket, createSpecialOrder } = require('../helpers/factory');
const { mockWhatsAppService } = require('../helpers/mocks');
const ServiceTicket = require('../../models/ServiceTicket');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, get: () => 'localhost', protocol: 'http', user: { id: 'x', username: 'x', role: 'admin' }, ...o });

beforeEach(() => {
  jest.clearAllMocks();
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
  mockWhatsAppService.checkExists.mockResolvedValue({ exists: true, error: null });
});

describe('Wave4: transaksi cash NaN + array + isActive', () => {
  it('400 bila amount_paid NaN/string untuk Cash', async () => {
    const kasir = await createKasir();
    const item = await createItem({ stock: 5 });
    for (const bad of [undefined, 'abc', '']) {
      const res = mockRes();
      await createRetailTransaction(
        { body: { items: [{ item_id: item._id.toString(), qty: 1 }], payment_method: 'Cash', amount_paid: bad }, user: { id: kasir._id.toString() } },
        res, jest.fn()
      );
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('400 bila items bukan array', async () => {
    const kasir = await createKasir();
    const res = mockRes();
    await createRetailTransaction({ body: { items: 'bukan-array', payment_method: 'Cash' }, user: { id: kasir._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila item_id invalid', async () => {
    const kasir = await createKasir();
    const res = mockRes();
    await createRetailTransaction({ body: { items: [{ item_id: 'bukan-id', qty: 1 }], payment_method: 'QRIS' }, user: { id: kasir._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 bila barang nonaktif (tidak bisa dijual)', async () => {
    const kasir = await createKasir();
    const item = await createItem({ stock: 5, isActive: false });
    const res = mockRes();
    await createRetailTransaction({ body: { items: [{ item_id: item._id.toString(), qty: 1 }], payment_method: 'QRIS' }, user: { id: kasir._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Wave4: order DP > estimasi + status whitelist', () => {
  it('400 bila DP melebihi estimasi', async () => {
    const res = mockRes();
    await createOrder({
      body: { customer: { name: 'T', phone: '08123456789', type: 'Umum' }, item_name: 'X', estimated_price: 100000, down_payment: 200000 },
      user: { id: 'x', username: 'x' }
    }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila status order tidak dikenal', async () => {
    const o = await createSpecialOrder();
    const { updateOrderStatus } = require('../../controllers/orderController');
    const res = mockRes();
    await updateOrderStatus({ params: { id: o._id.toString() }, body: { status: 'Ngawur' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila transisi order tidak valid (Pending -> Arrived)', async () => {
    const o = await createSpecialOrder();
    const { updateOrderStatus } = require('../../controllers/orderController');
    const res = mockRes();
    await updateOrderStatus({ params: { id: o._id.toString() }, body: { status: 'Arrived' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('Wave4: part guard tiket final + updateStatus validasi', () => {
  it('400 tambah part ke Completed/Cancelled', async () => {
    const t = await createServiceTicket({ status: 'Completed' });
    const item = await createItem({ stock: 5 });
    const res = mockRes();
    await addPartToService({ params: { id: t._id.toString() }, body: { item_id: item._id.toString(), quantity: 1 } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 hapus part dari Completed', async () => {
    const item = await createItem({ stock: 10 });
    const t = await createServiceTicket({ status: 'Queue' });
    const resAdd = mockRes();
    await addPartToService({ params: { id: t._id.toString() }, body: { item_id: item._id.toString(), quantity: 1 } }, resAdd, jest.fn());
    const partId = resAdd.json.mock.calls[0][0].data.parts_used[0]._id.toString();
    await ServiceTicket.findByIdAndUpdate(t._id, { status: 'Completed' });
    const res = mockRes();
    await removePartFromService({ params: { id: t._id.toString(), part_id: partId } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila status update kosong/typo', async () => {
    const t = await createServiceTicket();
    for (const bad of [undefined, '', 'Ngawur']) {
      const res = mockRes();
      await updateStatus({ params: { id: t._id.toString() }, body: { status: bad } }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('400 klaim garansi dari tiket Queue (bukan Picked_Up)', async () => {
    const t = await createServiceTicket({ status: 'Queue', warranty_expires_at: new Date(Date.now() + 86400000) });
    const res = mockRes();
    await claimWarranty({ params: { id: t._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('Wave4: self-admin guard + getMe null + register 11000', () => {
  it('400 admin ubah role sendiri', async () => {
    const a = await createAdmin();
    const res = mockRes();
    await updateUser({ params: { id: a._id.toString() }, body: { role: 'kasir' }, user: { id: a._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 nonaktifkan diri sendiri', async () => {
    const a = await createAdmin();
    const res = mockRes();
    await deleteUser({ params: { id: a._id.toString() }, user: { id: a._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 getMe bila user terhapus', async () => {
    const { Types } = require('mongoose');
    const res = mockRes();
    await getMe({ user: { id: new Types.ObjectId().toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('409 register race duplikat (simulasi 11000)', async () => {
    const User = require('../../models/User');
    const spy = jest.spyOn(User, 'create').mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    const res = mockRes();
    await register({ body: { name: 'R', username: `race_${Date.now()}`, password: 'abc12345', role: 'kasir' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    spy.mockRestore();
  });
});

describe('Wave4: duty user fiktif + sanitize proto', () => {
  it('400 jadwal untuk user tidak ada', async () => {
    const { Types } = require('mongoose');
    const res = mockRes();
    await createSchedule({ body: { user: new Types.ObjectId().toString(), day: 'senin' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sanitize membuang __proto__/constructor', async () => {
    const sanitize = require('../../middleware/sanitize');
    const req = { body: JSON.parse('{"a": 1, "__proto__": {"x": 1}, "constructor": {"y": 2}}'), query: {}, params: {} };
    sanitize(req, {}, jest.fn());
    expect(req.body.a).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(req.body, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(req.body, 'constructor')).toBe(false);
  });

  it('deductStockAtomic menolak qty negatif (tidak menambah stok)', async () => {
    const Item = require('../../models/Item');
    const item = await createItem({ stock: 10 });
    await expect(Item.deductStockAtomic(item._id, -5)).rejects.toThrow();
    const after = await Item.findById(item._id).lean();
    expect(after.stock).toBe(10);
  });
});
