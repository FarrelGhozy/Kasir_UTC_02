// tests/controllers/adminController.test.js
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
const admin = require('../../controllers/adminController');
const { createTeknisi } = require('../helpers/factory');
const { mockWhatsAppService } = require('../helpers/mocks');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED', error: 'down' });
});

describe('adminController teknisi', () => {
  it('createTechnician 201 (WA fail-open)', async () => {
    const res = mockRes();
    await admin.createTechnician(
      { body: { name: 'Tek Baru', username: `tek_${Date.now()}`, password: 'tek12345', phone: '08123456789' }, user: {} },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('createTechnician 400 bila username duplikat', async () => {
    const t = await createTeknisi();
    const res = mockRes();
    await admin.createTechnician({ body: { name: 'X', username: t.username, password: 'abc12345' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getAllTechnicians hanya role teknisi', async () => {
    await createTeknisi();
    const res = mockRes();
    await admin.getAllTechnicians({}, res, jest.fn());
    const data = res.json.mock.calls[0][0].data;
    expect(data.every(u => u.role === 'teknisi')).toBe(true);
  });

  it('updateTechnician 404 bila tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await admin.updateTechnician({ params: { id: new Types.ObjectId().toString() }, body: { name: 'X' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updateTechnician ganti nama + password', async () => {
    const t = await createTeknisi();
    const res = mockRes();
    await admin.updateTechnician(
      { params: { id: t._id.toString() }, body: { name: 'Nama Baru', password: 'baru12345' }, user: {} },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.name).toBe('Nama Baru');
  });

  it('deleteTechnician menolak non-teknisi + menghapus teknisi', async () => {
    const t = await createTeknisi();
    const res = mockRes();
    await admin.deleteTechnician({ params: { id: t._id.toString() }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);

    const res2 = mockRes();
    const { Types } = require('mongoose');
    await admin.deleteTechnician({ params: { id: new Types.ObjectId().toString() }, user: {} }, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(404);
  });
});
