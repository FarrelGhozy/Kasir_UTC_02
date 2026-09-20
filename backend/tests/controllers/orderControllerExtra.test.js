// tests/controllers/orderControllerExtra.test.js — validasi tambahan di luar waSoftBlock
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
jest.mock('../../services/emailService', () => require('../helpers/mocks').mockEmailService);

const { getAllOrders, updateOrderStatus, updatePaymentStatus, deleteOrder } = require('../../controllers/orderController');
const { createSpecialOrder, createTeknisi } = require('../helpers/factory');
const { mockWhatsAppService, mockEmailService } = require('../helpers/mocks');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
  mockWhatsAppService.checkExists.mockResolvedValue({ exists: true, error: null });
  mockEmailService.sendInvoiceEmail.mockResolvedValue(undefined);
});

describe('orderController.getAllOrders validasi', () => {
  it('400 bila status tidak dikenal', async () => {
    const res = mockRes();
    await getAllOrders({ query: { status: 'Ngawur' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('clamp limit maksimal 100', async () => {
    const res = mockRes();
    await getAllOrders({ query: { limit: '9999' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('orderController.updateOrderStatus', () => {
  it('Picked_Up otomatis menandai Lunas', async () => {
    const o = await createSpecialOrder();
    const res = mockRes();
    await updateOrderStatus({ params: { id: o._id.toString() }, body: { status: 'Picked_Up' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.payment_status).toBe('Lunas');
  });

  it('404 bila order tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await updateOrderStatus({ params: { id: new Types.ObjectId().toString() }, body: { status: 'Arrived' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('orderController.updatePaymentStatus', () => {
  it('400 bila status bayar tidak valid', async () => {
    const res = mockRes();
    await updatePaymentStatus({ params: { id: 'x' }, body: { payment_status: 'Cicil' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('Lunas -> status ikut Picked_Up', async () => {
    const o = await createSpecialOrder();
    const res = mockRes();
    await updatePaymentStatus({ params: { id: o._id.toString() }, body: { payment_status: 'Lunas' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.status).toBe('Picked_Up');
  });
});

describe('orderController.deleteOrder', () => {
  it('admin hapus permanen', async () => {
    const o = await createSpecialOrder();
    const res = mockRes();
    await deleteOrder({ params: { id: o._id.toString() }, user: { role: 'admin' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('non-admin hanya cancel (data tetap ada)', async () => {
    const o = await createSpecialOrder();
    const res = mockRes();
    await deleteOrder({ params: { id: o._id.toString() }, user: { role: 'kasir' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const after = await require('../../models/SpecialOrder').findById(o._id).lean();
    expect(after.status).toBe('Cancelled');
  });
});
