// tests/controllers/waController.test.js
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
const wa = require('../../controllers/waController');
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

describe('waController.checkWANumber', () => {
  it('400 bila phone kosong', async () => {
    const res = mockRes();
    await wa.checkWANumber({ query: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('format salah -> bukan 200 sukses-penuh (WA_NUMBER_FORMAT)', async () => {
    const res = mockRes();
    await wa.checkWANumber({ query: { phone: '12345' } }, res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('WA_NUMBER_FORMAT');
    expect(body.isValid).toBe(false);
  });

  it('nomor valid -> waStatus valid', async () => {
    const res = mockRes();
    await wa.checkWANumber({ query: { phone: '08123456789' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].waStatus).toBe('valid');
  });

  it('WAHA mati -> fail-open waStatus unknown', async () => {
    mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED', error: 'down' });
    const res = mockRes();
    await wa.checkWANumber({ query: { phone: '08123456789' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].waStatus).toBe('unknown');
  });
});

describe('waController.getWAHAStatus', () => {
  it('WORKING -> CONNECTED', async () => {
    const res = mockRes();
    await wa.getWAHAStatus({}, res, jest.fn());
    expect(res.json.mock.calls[0][0].status).toBe('CONNECTED');
  });

  it('DISCONNECTED tetap 200 dengan status DISCONNECTED', async () => {
    mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED' });
    const res = mockRes();
    await wa.getWAHAStatus({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].status).toBe('DISCONNECTED');
  });
});
