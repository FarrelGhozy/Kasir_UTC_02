jest.mock('../../services/whatsappService', () => ({
  sendCustomerPickupReminder: jest.fn(),
  sendOrderPickupReminder: jest.fn(),
  sendTechnicianTaskReminder: jest.fn()
}));

jest.mock('../../models/SystemLog');

const mongoose = require('mongoose');
const whatsappService = require('../../services/whatsappService');
const SystemLog = require('../../models/SystemLog');
const ServiceTicket = require('../../models/ServiceTicket');
const SpecialOrder = require('../../models/SpecialOrder');
const User = require('../../models/User');
const reminderService = require('../../services/reminderService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('remindCustomersForService', () => {
  test('sends reminder when completed > 24 hours ago and no last reminder', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0001',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot total' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
      status: 'Completed',
      service_fee: 50000,
      history: { created_at: twoDaysAgo, completed_at: twoDaysAgo }
    });
    whatsappService.sendCustomerPickupReminder.mockResolvedValue({ success: true });

    await reminderService.remindCustomersForService();

    expect(whatsappService.sendCustomerPickupReminder).toHaveBeenCalledTimes(1);
  });

  test('skips when completed < 24 hours ago', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0002',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
      status: 'Completed',
      service_fee: 50000,
      history: { created_at: twoHoursAgo, completed_at: twoHoursAgo }
    });

    await reminderService.remindCustomersForService();

    expect(whatsappService.sendCustomerPickupReminder).not.toHaveBeenCalled();
  });

  test('skips if last reminder was < 24 hours ago', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0003',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
      status: 'Completed',
      service_fee: 50000,
      history: {
        created_at: twoDaysAgo,
        completed_at: twoDaysAgo,
        last_customer_reminder_at: twoHoursAgo
      }
    });

    await reminderService.remindCustomersForService();

    expect(whatsappService.sendCustomerPickupReminder).not.toHaveBeenCalled();
  });

  test('updates last_customer_reminder_at on success', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const ticket = await ServiceTicket.create({
      ticket_number: 'SRV-2026-0004',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
      status: 'Completed',
      service_fee: 50000,
      history: { created_at: twoDaysAgo, completed_at: twoDaysAgo }
    });
    whatsappService.sendCustomerPickupReminder.mockResolvedValue({ success: true });

    await reminderService.remindCustomersForService();

    const updated = await ServiceTicket.findById(ticket._id).lean();
    expect(updated.history.last_customer_reminder_at).toBeDefined();
    expect(new Date(updated.history.last_customer_reminder_at).getTime()).toBeCloseTo(
      Date.now(), -3
    );
  });

  test('logs warning on WA failure', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0005',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
      status: 'Completed',
      service_fee: 50000,
      history: { created_at: twoDaysAgo, completed_at: twoDaysAgo }
    });
    whatsappService.sendCustomerPickupReminder.mockResolvedValue({ success: false, error: 'WA Error' });

    await reminderService.remindCustomersForService();

    expect(SystemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'WARN', source: 'ReminderService' })
    );
  });
});

describe('remindCustomersForOrders', () => {
  test('sends reminder when arrived > 24 hours ago', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await SpecialOrder.create({
      order_number: 'ORD-2026-0001',
      customer: { name: 'Budi', phone: '08123456789' },
      item_name: 'Laptop Lenovo Thinkpad',
      status: 'Arrived',
      history: { created_at: twoDaysAgo, arrived_at: twoDaysAgo }
    });
    whatsappService.sendOrderPickupReminder.mockResolvedValue({ success: true });

    await reminderService.remindCustomersForOrders();

    expect(whatsappService.sendOrderPickupReminder).toHaveBeenCalledTimes(1);
  });
});

describe('remindTechnicians', () => {
  test('sends reminder when created > 12 hours ago and no reminder', async () => {
    const techUser = await User.create({
      name: 'Teknisi A',
      username: 'teknisi_a',
      password: 'password123',
      role: 'teknisi',
      phone: '08111111111'
    });
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0010',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: techUser._id, name: techUser.name },
      status: 'Queue',
      service_fee: 50000,
      history: { created_at: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    whatsappService.sendTechnicianTaskReminder.mockResolvedValue({ success: true });

    await reminderService.remindTechnicians();

    expect(whatsappService.sendTechnicianTaskReminder).toHaveBeenCalledTimes(1);
    expect(whatsappService.sendTechnicianTaskReminder.mock.calls[0][0].name).toBe('Teknisi A');
  });

  test('skips if last reminder < 12 hours ago', async () => {
    const techUser = await User.create({
      name: 'Teknisi B',
      username: 'teknisi_b',
      password: 'password123',
      role: 'teknisi',
      phone: '08222222222'
    });
    await ServiceTicket.create({
      ticket_number: 'SRV-2026-0011',
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
      technician: { id: techUser._id, name: techUser.name },
      status: 'Diagnosing',
      service_fee: 50000,
      history: {
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
        last_technician_reminder_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
      }
    });

    await reminderService.remindTechnicians();

    expect(whatsappService.sendTechnicianTaskReminder).not.toHaveBeenCalled();
  });
});

describe('runReminders', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('skips on Friday (day 5)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-05T10:00:00'));

    const spy1 = jest.spyOn(reminderService, 'remindCustomersForService').mockResolvedValue();
    const spy2 = jest.spyOn(reminderService, 'remindCustomersForOrders').mockResolvedValue();
    const spy3 = jest.spyOn(reminderService, 'remindTechnicians').mockResolvedValue();

    await reminderService.runReminders();

    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).not.toHaveBeenCalled();
    expect(spy3).not.toHaveBeenCalled();

    spy1.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('runs all 3 reminder methods on non-Friday', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-08T10:00:00'));

    const spy1 = jest.spyOn(reminderService, 'remindCustomersForService').mockResolvedValue();
    const spy2 = jest.spyOn(reminderService, 'remindCustomersForOrders').mockResolvedValue();
    const spy3 = jest.spyOn(reminderService, 'remindTechnicians').mockResolvedValue();

    await reminderService.runReminders();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(spy3).toHaveBeenCalledTimes(1);

    spy1.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });
});

describe('batch processing', () => {
  test('processes multiple qualifying tickets', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      await ServiceTicket.create({
        ticket_number: `SRV-2026-${String(i + 1).padStart(4, '0')}`,
        customer: { name: `Budi ${i}`, phone: `0812345678${i}`, type: 'Umum' },
        device: { type: 'HP', brand: 'Samsung', model: 'A52', symptoms: 'Matot' },
        technician: { id: new mongoose.Types.ObjectId(), name: 'Teknisi A' },
        status: 'Completed',
        service_fee: 50000,
        history: { created_at: twoDaysAgo, completed_at: twoDaysAgo }
      });
    }
    whatsappService.sendCustomerPickupReminder.mockResolvedValue({ success: true });

    await reminderService.remindCustomersForService();

    expect(whatsappService.sendCustomerPickupReminder).toHaveBeenCalledTimes(3);
  });
});
