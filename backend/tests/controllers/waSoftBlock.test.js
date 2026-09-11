// tests/controllers/waSoftBlock.test.js - Soft-block WA: 422 tanpa simpan, override menyimpan
// Mock service WA + email SEBELUM require controller
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
jest.mock('../../services/emailService', () => require('../helpers/mocks').mockEmailService);

const { createTicket } = require('../../controllers/serviceController');
const { createOrder } = require('../../controllers/orderController');
const { createTechnician } = require('../../controllers/adminController');
const ServiceTicket = require('../../models/ServiceTicket');
const SpecialOrder = require('../../models/SpecialOrder');
const User = require('../../models/User');
const SystemLog = require('../../models/SystemLog');
const { mockWhatsAppService } = require('../helpers/mocks');
const { createTeknisi } = require('../helpers/factory');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  get: jest.fn().mockReturnValue('localhost:5000'),
  protocol: 'http',
  user: { id: 'kasir1', username: 'kasir1', role: 'kasir' },
  file: null,
  files: null,
  ...overrides
});

function mockWAInvalid() {
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
  mockWhatsAppService.checkExists.mockResolvedValue({ exists: false, error: null });
}

function mockWAValid() {
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
  mockWhatsAppService.checkExists.mockResolvedValue({ exists: true, error: null });
}

function mockWADown() {
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED', error: 'down' });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: WA valid agar test lama tidak terpengaruh bila dijalankan bersama
  mockWAValid();
  SystemLog.create = jest.fn().mockResolvedValue({});
});

describe('WA soft-block: createTicket', () => {
  test('nomor invalid tanpa override -> 422 + TIDAK simpan ke DB', async () => {
    mockWAInvalid();
    const teknisi = await createTeknisi();
    const before = await ServiceTicket.countDocuments();
    const req = mockReq({
      body: {
        customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
        device: { type: 'Laptop', symptoms: 'Mati' },
        technician_id: teknisi._id.toString()
      }
    });
    const res = mockRes();

    await createTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: 'WA_NUMBER_NOT_FOUND'
    }));
    expect(await ServiceTicket.countDocuments()).toBe(before);
    expect(mockWhatsAppService.sendServiceWelcomeMessages).not.toHaveBeenCalled();
  });

  test('nomor invalid + "Tetap simpan" -> 201 + log WARN override', async () => {
    mockWAInvalid();
    const teknisi = await createTeknisi();
    const req = mockReq({
      body: {
        customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
        device: { type: 'Laptop', symptoms: 'Mati' },
        technician_id: teknisi._id.toString(),
        wa_override_confirmed: true
      }
    });
    const res = mockRes();

    await createTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.customer.wa_status).toBe('invalid');
    expect(SystemLog.create).toHaveBeenCalledWith(expect.objectContaining({
      level: 'WARN',
      source: 'WAValidation'
    }));
  });

  test('WAHA tidak terkoneksi -> tetap simpan (fail-open) dengan wa_status unknown', async () => {
    mockWADown();
    const teknisi = await createTeknisi();
    const req = mockReq({
      body: {
        customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
        device: { type: 'Laptop', symptoms: 'Mati' },
        technician_id: teknisi._id.toString()
      }
    });
    const res = mockRes();

    await createTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.customer.wa_status).toBe('unknown');
  });
});

describe('WA soft-block: createOrder', () => {
  test('nomor invalid tanpa override -> 422 + TIDAK simpan', async () => {
    mockWAInvalid();
    const before = await SpecialOrder.countDocuments();
    const req = mockReq({
      body: {
        customer: { name: 'Siti', phone: '08123456789' },
        item_name: 'RAM 8GB',
        estimated_price: 500000,
        down_payment: 0
      }
    });
    const res = mockRes();

    await createOrder(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(await SpecialOrder.countDocuments()).toBe(before);
  });

  test('nomor invalid + override -> simpan', async () => {
    mockWAInvalid();
    const req = mockReq({
      body: {
        customer: { name: 'Siti', phone: '08123456789' },
        item_name: 'RAM 8GB',
        estimated_price: 500000,
        down_payment: 0,
        wa_override_confirmed: true
      }
    });
    const res = mockRes();

    await createOrder(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.customer.wa_status).toBe('invalid');
  });
});

describe('WA soft-block: createTechnician', () => {
  test('nomor invalid tanpa override -> 422 + TIDAK simpan user', async () => {
    mockWAInvalid();
    const before = await User.countDocuments();
    const req = mockReq({
      body: { name: 'Tek1', username: `tek_${Date.now()}`, password: 'password123', phone: '08123456789' }
    });
    const res = mockRes();

    await createTechnician(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(await User.countDocuments()).toBe(before);
  });
});
