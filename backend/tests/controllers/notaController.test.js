// tests/controllers/notaController.test.js
const nota = require('../../controllers/notaController');
const { createServiceTicket, createSpecialOrder } = require('../helpers/factory');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('notaController.downloadServiceNota', () => {
  it('404 bila tiket tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await nota.downloadServiceNota({ params: { id: new Types.ObjectId().toString() }, query: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 bila type tidak valid', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await nota.downloadServiceNota({ params: { id: t._id.toString() }, query: { type: 'Entry' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('200 + PDF untuk type=entry dan type=payment', async () => {
    const t = await createServiceTicket();
    for (const type of ['entry', 'payment']) {
      const res = mockRes();
      await nota.downloadServiceNota({ params: { id: t._id.toString() }, query: { type } }, res, jest.fn());
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalled();
    }
  });
});

describe('notaController.downloadOrderNota', () => {
  it('404 bila order tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await nota.downloadOrderNota({ params: { id: new Types.ObjectId().toString() }, query: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 bila type typo', async () => {
    const o = await createSpecialOrder();
    const res = mockRes();
    await nota.downloadOrderNota({ params: { id: o._id.toString() }, query: { type: 'PAYMENT' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('notaController.listNotas', () => {
  it('200 + array (kosong bila folder belum ada)', async () => {
    const res = mockRes();
    await nota.listNotas({ protocol: 'http', get: () => 'localhost' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Array.isArray(res.json.mock.calls[0][0].data)).toBe(true);
  });
});
