/**
 * @jest-environment jsdom
 */
import Order from '../public/js/modules/order.js';
import api from '../public/js/api.js';

jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {
      getSpecialOrders: jest.fn().mockResolvedValue({ data: [] }),
      getUsers: jest.fn().mockResolvedValue({ data: [] }),
    },
    showToast: jest.fn(),
    showError: jest.fn(),
    formatCurrency: actual.formatCurrency,
    escapeHTML: actual.escapeHTML,
    formatDateTime: actual.formatDateTime,
    setupCurrencyInput: jest.fn(),
    parseCurrencyValue: actual.parseCurrencyValue,
    setupPhoneRealtimeValidation: jest.fn(),
    confirmDialog: jest.fn().mockResolvedValue(true),
  };
});

function fakeOrder(overrides = {}) {
  return {
    _id: 'o1',
    order_number: 'ORD-2026-0001',
    customer: { name: 'Budi Santoso', phone: '08123456789', type: 'Umum' },
    item_name: 'RAM DDR4 8GB',
    item_description: 'Corsair 3200MHz',
    estimated_price: 500000,
    down_payment: 100000,
    payment_status: 'Belum Lunas',
    status: 'Pending',
    handled_by: { name: 'Kasir A' },
    notes: 'Cepat ya',
    ...overrides,
  };
}

describe('Order._getValidOrderStatuses', () => {
  it('transisi valid tiap status', () => {
    const ord = new Order();
    expect(ord._getValidOrderStatuses('Pending')).toEqual(['Searching', 'Picked_Up', 'Cancelled']);
    expect(ord._getValidOrderStatuses('Searching')).toEqual(['Ordered', 'Picked_Up', 'Cancelled']);
    expect(ord._getValidOrderStatuses('Ordered')).toEqual(['Arrived', 'Picked_Up', 'Cancelled']);
    expect(ord._getValidOrderStatuses('Arrived')).toEqual(['Picked_Up', 'Cancelled']);
    expect(ord._getValidOrderStatuses('Picked_Up')).toEqual(['Cancelled']);
    expect(ord._getValidOrderStatuses('Cancelled')).toEqual(['Pending']);
  });

  it('status tak dikenal -> []', () => {
    const ord = new Order();
    expect(ord._getValidOrderStatuses('Aneh')).toEqual([]);
    expect(ord._getValidOrderStatuses(undefined)).toEqual([]);
  });
});

describe('Order._getOrderMatchScore', () => {
  it('0 bila term kosong', () => {
    const ord = new Order();
    expect(ord._getOrderMatchScore(fakeOrder(), '')).toBe(0);
    expect(ord._getOrderMatchScore(fakeOrder(), null)).toBe(0);
  });

  it('menghitung jumlah field yang cocok (case-insensitive)', () => {
    const ord = new Order();
    const o = fakeOrder();
    // 'budi' cocok di customer.name
    expect(ord._getOrderMatchScore(o, 'budi')).toBeGreaterThanOrEqual(1);
    // 'ram' cocok di item_name
    expect(ord._getOrderMatchScore(o, 'ram')).toBeGreaterThanOrEqual(1);
    // 'ord-2026' cocok di order_number
    expect(ord._getOrderMatchScore(o, 'ord-2026')).toBeGreaterThanOrEqual(1);
  });

  it('0 bila tidak ada field yang cocok', () => {
    const ord = new Order();
    expect(ord._getOrderMatchScore(fakeOrder(), 'zzz-tidak-ada')).toBe(0);
  });

  it('aman bila handled_by null', () => {
    const ord = new Order();
    const o = fakeOrder({ handled_by: null });
    expect(() => ord._getOrderMatchScore(o, 'budi')).not.toThrow();
  });
});

describe('Order.loadOrders', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-content"><div id="orders-container"></div><select id="order-status-filter"><option value=""></option></select><input id="search-order" value=""></div>';
    jest.clearAllMocks();
    api.getSpecialOrders.mockResolvedValue({ data: [] });
  });

  it('menyimpan hasil fetch ke this.orders', async () => {
    const ord = new Order();
    const rows = [fakeOrder(), fakeOrder({ _id: 'o2', order_number: 'ORD-2026-0002' })];
    api.getSpecialOrders.mockResolvedValueOnce({ data: rows });
    await ord.loadOrders();
    expect(ord.orders.length).toBe(2);
    expect(ord.orders[0].order_number).toBe('ORD-2026-0001');
  });

  it('error fetch tidak throw (ditangani showToast)', async () => {
    const ord = new Order();
    api.getSpecialOrders.mockRejectedValueOnce(new Error('jaringan putus'));
    await expect(ord.loadOrders()).resolves.toBeUndefined();
    expect(ord.orders).toEqual([]);
  });
});
