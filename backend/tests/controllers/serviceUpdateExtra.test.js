// tests/controllers/serviceUpdateExtra.test.js — JSON 400, override string, fee, tanggal
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
jest.mock('../../services/emailService', () => require('../helpers/mocks').mockEmailService);

const { updateTicketDetails, updateServiceFee } = require('../../controllers/serviceController');
const { createServiceTicket } = require('../helpers/factory');
const { mockWhatsAppService } = require('../helpers/mocks');

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
});

describe('serviceController.updateTicketDetails JSON', () => {
  it('400 bila customer JSON rusak', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await updateTicketDetails(
      { params: { id: t._id.toString() }, body: { customer: '{rusak' }, user: { role: 'kasir' } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila device JSON rusak', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await updateTicketDetails(
      { params: { id: t._id.toString() }, body: { device: '[rusak' }, user: { role: 'kasir' } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('update notes biasa tetap 200', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await updateTicketDetails(
      { params: { id: t._id.toString() }, body: { notes: 'catatan baru' }, user: { role: 'kasir' } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('override string "true" diterima saat ganti nomor (konsisten dengan create)', async () => {
    const t = await createServiceTicket();
    mockWhatsAppService.checkExists.mockResolvedValue({ exists: false, error: null });
    const res = mockRes();
    await updateTicketDetails(
      {
        params: { id: t._id.toString() },
        body: { customer: JSON.stringify({ phone: '08199999999' }), wa_override_confirmed: 'true' },
        user: { role: 'kasir', username: 'kasir1' }
      },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('teknisi ditolak ubah tanggal masuk (403)', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await updateTicketDetails(
      { params: { id: t._id.toString() }, body: { tanggal_masuk: '2026-01-10' }, user: { role: 'teknisi' } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('serviceController.updateServiceFee', () => {
  it('400 bila fee negatif/string-bukan-angka/kosong', async () => {
    const t = await createServiceTicket();
    for (const bad of [-100, 'abc', '', null, undefined]) {
      const res = mockRes();
      await updateServiceFee({ params: { id: t._id.toString() }, body: { service_fee: bad } }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('200 untuk fee valid + tersimpan sebagai number', async () => {
    const t = await createServiceTicket();
    const res = mockRes();
    await updateServiceFee({ params: { id: t._id.toString() }, body: { service_fee: '75000' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.service_fee).toBe(75000);
  });
});
