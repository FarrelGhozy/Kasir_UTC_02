jest.mock('axios');
jest.mock('../../models/SystemLog');

const axios = require('axios');
const SystemLog = require('../../models/SystemLog');
const whatsappService = require('../../services/whatsappService');

beforeAll(() => {
  process.env.WAHA_URL = 'http://localhost:8000';
  process.env.WAHA_SESSION = 'default';
  process.env.WAHA_API_KEY = 'test-api-key';
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(whatsappService, 'delay').mockResolvedValue();
  SystemLog.create.mockResolvedValue({});
});

describe('sendMessage', () => {
  test('success returns { success: true, data }', async () => {
    axios.post.mockResolvedValue({ data: { sent: true, id: 'wa_msg_001' } });
    const result = await whatsappService.sendMessage('08123456789', 'Halo test');
    expect(result.success).toBe(true);
    expect(result.data.sent).toBe(true);
    expect(result.data.id).toBe('wa_msg_001');
  });

  test('phone 08xx formatted to 628xx@c.us', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    await whatsappService.sendMessage('08123456789', 'test');
    const { chatId } = axios.post.mock.calls[0][1];
    expect(chatId).toBe('628123456789@c.us');
  });

  test('phone 628xx preserved as 628xx@c.us', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    await whatsappService.sendMessage('628987654321', 'test');
    const { chatId } = axios.post.mock.calls[0][1];
    expect(chatId).toBe('628987654321@c.us');
  });

  test('network error returns { success: false }', async () => {
    axios.post.mockRejectedValue(new Error('Network Error'));
    const result = await whatsappService.sendMessage('08123456789', 'test');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network Error');
    expect(SystemLog.create).toHaveBeenCalled();
  });

  test('API error with response status', async () => {
    axios.post.mockRejectedValue({
      response: { status: 400, data: { message: 'Invalid phone number' } }
    });
    const result = await whatsappService.sendMessage('08123456789', 'test');
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(SystemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ERROR', source: 'WhatsAppService' })
    );
  });

  test('timeout exceeded returns error message', async () => {
    axios.post.mockRejectedValue(new Error('timeout of 15000ms exceeded'));
    const result = await whatsappService.sendMessage('08123456789', 'test');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timeout/);
  });
});

describe('sendServiceWelcomeMessages', () => {
  const ticket = {
    customer: { name: 'Budi', phone: '08123456789' },
    device: { type: 'HP', brand: 'Samsung', model: 'A52' },
    ticket_number: 'SRV-2026-0001'
  };

  test('success sends 3 messages with delays', async () => {
    axios.get.mockResolvedValue({ data: { status: 'WORKING' } });
    axios.post.mockResolvedValue({ data: { sent: true } });

    await whatsappService.sendServiceWelcomeMessages(ticket);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(4);
    expect(whatsappService.delay).toHaveBeenCalledTimes(3);
  });

  test('no phone returns early', async () => {
    const t = { ...ticket, customer: { ...ticket.customer, phone: null } };
    await whatsappService.sendServiceWelcomeMessages(t);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('session not WORKING returns early', async () => {
    axios.get.mockResolvedValue({ data: { status: 'FAILED' } });
    await whatsappService.sendServiceWelcomeMessages(ticket);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('sendOrderWelcomeMessages', () => {
  const order = {
    customer: { name: 'Budi', phone: '08123456789' },
    item_name: 'Laptop Lenovo Thinkpad',
    order_number: 'ORD-2026-0001'
  };

  test('success sends 3 messages with delays', async () => {
    axios.get.mockResolvedValue({ data: { status: 'WORKING' } });
    axios.post.mockResolvedValue({ data: { sent: true } });

    await whatsappService.sendOrderWelcomeMessages(order);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(whatsappService.delay).toHaveBeenCalledTimes(3);
  });

  test('no phone returns early', async () => {
    const o = { ...order, customer: { ...order.customer, phone: null } };
    await whatsappService.sendOrderWelcomeMessages(o);
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('session not WORKING returns early', async () => {
    axios.get.mockResolvedValue({ data: { status: 'DISCONNECTED' } });
    await whatsappService.sendOrderWelcomeMessages(order);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('notifyServiceStatus', () => {
  const baseTicket = {
    customer: { name: 'Budi', phone: '08123456789' },
    device: { type: 'HP', brand: 'Samsung', model: 'A52' },
    ticket_number: 'SRV-2026-0001',
    service_fee: 50000,
    parts_used: []
  };

  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { sent: true } });
  });

  const statusLabels = {
    Queue: 'Dalam Antrian',
    Diagnosing: 'Sedang Tahap Diagnosa',
    Waiting_Part: 'Menunggu Suku Cadang',
    In_Progress: 'Sedang Dikerjakan oleh Teknisi',
    Completed: 'Selesai & Siap Diambil',
    Cancelled: 'Dibatalkan'
  };

  Object.entries(statusLabels).forEach(([status, label]) => {
    test(`${status} sends message containing "${label}"`, async () => {
      await whatsappService.notifyServiceStatus({ ...baseTicket, status });
      const text = axios.post.mock.calls[0][1].text;
      expect(text).toContain(label);
    });
  });

  test('Completed includes cost breakdown', async () => {
    const ticket = {
      ...baseTicket,
      status: 'Completed',
      service_fee: 50000,
      parts_used: [
        { name: 'Battery', qty: 1, subtotal: 100000 },
        { name: 'Charger', qty: 1, subtotal: 50000 }
      ]
    };
    await whatsappService.notifyServiceStatus(ticket);
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('RINCIAN BIAYA');
    expect(text).toContain('Jasa Servis');
    expect(text).toContain('Battery');
    expect(text).toContain('Charger');
    expect(text).toContain('TOTAL AKHIR');
  });

  test('Picked_Up includes warranty info', async () => {
    const ticket = {
      ...baseTicket,
      status: 'Picked_Up',
      warranty_expires_at: new Date('2026-06-14')
    };
    await whatsappService.notifyServiceStatus(ticket);
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('PENGINGAT GARANSI');
    expect(text).toContain('7 Hari');
  });
});

describe('notifyOrderStatus', () => {
  const baseOrder = {
    customer: { name: 'Budi', phone: '08123456789' },
    item_name: 'Laptop Lenovo',
    order_number: 'ORD-2026-0001',
    estimated_price: 5000000,
    down_payment: 1000000
  };

  beforeEach(() => {
    axios.post.mockResolvedValue({ data: { sent: true } });
  });

  const statusLabels = {
    Pending: 'Dalam Antrian Pesanan',
    Searching: 'Sedang Kami Carikan di Supplier',
    Ordered: 'Sudah Kami Pesan ke Supplier',
    Arrived: 'SUDAH SAMPAI di Toko',
    Cancelled: 'Dibatalkan'
  };

  Object.entries(statusLabels).forEach(([status, label]) => {
    test(`${status} sends message containing "${label}"`, async () => {
      await whatsappService.notifyOrderStatus({ ...baseOrder, status });
      const text = axios.post.mock.calls[0][1].text;
      expect(text).toContain(label);
    });
  });

  test('Arrived includes pickup message', async () => {
    await whatsappService.notifyOrderStatus({ ...baseOrder, status: 'Arrived' });
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('Barang pesanan Kakak sudah sampai');
  });

  test('Picked_Up sends message with thank you', async () => {
    await whatsappService.notifyOrderStatus({ ...baseOrder, status: 'Picked_Up' });
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('terima kasih sudah mengambil pesanannya');
    expect(text).toContain('Nota Digital Resmi');
  });
});

describe('notifyTechnicianAssignment', () => {
  test('with phone sends message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const tech = { name: 'Teknisi A', phone: '08111111111' };
    const ticket = {
      device: { type: 'HP', brand: 'Xiaomi', model: 'Redmi', symptoms: 'Matot' },
      customer: { name: 'Budi' },
      ticket_number: 'SRV-001'
    };
    const result = await whatsappService.notifyTechnicianAssignment(tech, ticket);
    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalled();
  });

  test('without phone returns null', async () => {
    const tech = { name: 'Teknisi A', phone: null };
    const result = await whatsappService.notifyTechnicianAssignment(tech, {});
    expect(result).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('notifyOrderAssignment', () => {
  test('with phone sends message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const staff = { name: 'Staff A', phone: '08111111111' };
    const order = {
      item_name: 'Laptop',
      customer: { name: 'Budi' },
      order_number: 'ORD-001'
    };
    const result = await whatsappService.notifyOrderAssignment(staff, order);
    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalled();
  });

  test('without phone returns null', async () => {
    const staff = { name: 'Staff A', phone: null };
    const result = await whatsappService.notifyOrderAssignment(staff, {});
    expect(result).toBeNull();
  });
});

describe('sendCustomerPickupReminder', () => {
  test('sends reminder message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const ticket = {
      customer: { name: 'Budi', phone: '08123456789' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52' },
      ticket_number: 'SRV-001'
    };
    const result = await whatsappService.sendCustomerPickupReminder(ticket);
    expect(result.success).toBe(true);
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('PENGINGAT');
    expect(text).toContain('Budi');
  });
});

describe('sendOrderPickupReminder', () => {
  test('sends reminder message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const order = {
      customer: { name: 'Budi', phone: '08123456789' },
      item_name: 'Laptop',
      order_number: 'ORD-001'
    };
    const result = await whatsappService.sendOrderPickupReminder(order);
    expect(result.success).toBe(true);
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('PENGINGAT PESANAN');
  });
});

describe('sendTechnicianTaskReminder', () => {
  test('sends reminder message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const techUser = { name: 'Teknisi A', phone: '08111111111' };
    const ticket = {
      device: { type: 'HP', brand: 'Xiaomi', model: 'Redmi', symptoms: 'Matot' },
      customer: { name: 'Budi' },
      ticket_number: 'SRV-001',
      status: 'Queue'
    };
    const result = await whatsappService.sendTechnicianTaskReminder(techUser, ticket);
    expect(result.success).toBe(true);
    const text = axios.post.mock.calls[0][1].text;
    expect(text).toContain('PENGINGAT TUGAS TEKNISI');
  });
});

describe('notifyTechnicianReminder', () => {
  test('with phone sends message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    const ticket = {
      technician: { name: 'Teknisi A', phone: '08111111111' },
      device: { type: 'HP', brand: 'Xiaomi', model: 'Redmi', symptoms: 'Matot' },
      customer: { name: 'Budi' },
      ticket_number: 'SRV-001'
    };
    const result = await whatsappService.notifyTechnicianReminder(ticket);
    expect(result.success).toBe(true);
  });

  test('without phone returns { success: false }', async () => {
    const ticket = { technician: { name: 'Teknisi A', phone: null } };
    const result = await whatsappService.notifyTechnicianReminder(ticket);
    expect(result.success).toBe(false);
    expect(result.error).toContain('tidak memiliki nomor HP');
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('checkExists', () => {
  test('valid number returns exists: true', async () => {
    axios.post.mockResolvedValue({ data: { exists: true } });
    const result = await whatsappService.checkExists('08123456789');
    expect(result.exists).toBe(true);
    const callData = axios.post.mock.calls[0][1];
    expect(callData.phone).toBe('628123456789');
  });

  test('invalid number returns exists: false', async () => {
    axios.post.mockResolvedValue({ data: { exists: false } });
    const result = await whatsappService.checkExists('08123456789');
    expect(result.exists).toBe(false);
  });

  test('API error returns exists: false with error', async () => {
    axios.post.mockRejectedValue(new Error('API Error'));
    const result = await whatsappService.checkExists('08123456789');
    expect(result.exists).toBe(false);
    expect(result.error).toBe('API Error');
  });
});

describe('checkSessionStatus', () => {
  test('returns WORKING', async () => {
    axios.get.mockResolvedValue({ data: { status: 'WORKING' } });
    const result = await whatsappService.checkSessionStatus();
    expect(result.status).toBe('WORKING');
  });

  test('returns UNREACHABLE on ECONNREFUSED', async () => {
    axios.get.mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
    const result = await whatsappService.checkSessionStatus();
    expect(result.status).toBe('UNREACHABLE');
  });

  test('returns UNREACHABLE on ENOTFOUND', async () => {
    axios.get.mockRejectedValue({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' });
    const result = await whatsappService.checkSessionStatus();
    expect(result.status).toBe('UNREACHABLE');
  });

  test('returns DISCONNECTED on generic error', async () => {
    axios.get.mockRejectedValue({ response: { status: 404, data: { error: 'Session not found' } } });
    const result = await whatsappService.checkSessionStatus();
    expect(result.status).toBe('DISCONNECTED');
  });

  test('returns FAILED from API response', async () => {
    axios.get.mockResolvedValue({ data: { status: 'FAILED', error: 'Something wrong' } });
    const result = await whatsappService.checkSessionStatus();
    expect(result.status).toBe('FAILED');
  });
});
