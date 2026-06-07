const mongoose = require('mongoose');
const {
  getFullRecap,
  getDailyRevenue,
  getMonthlyRevenue,
  getRevenueByRange,
  getTopSellingItems,
  getCashierPerformance,
  getTechnicianPerformance
} = require('../../controllers/reportController');
const {
  createItem,
  createTeknisi,
  createKasir
} = require('../helpers/factory');
const Transaction = require('../../models/Transaction');
const ServiceTicket = require('../../models/ServiceTicket');

function mockRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { status, json };
}

function generateTicketNumber() {
  return `SRV-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Helper: buat tiket servis dengan status Picked_Up dan history.picked_up_at terkontrol
 */
async function createPickedUpTicket({ picked_up_at = new Date(), service_fee = 75000, parts_used = [], technician } = {}) {
  if (!technician) {
    const tech = await createTeknisi();
    technician = { id: tech._id, name: tech.name };
  }
  const partsTotal = parts_used.reduce((s, p) => s + (p.subtotal || 0), 0);
  return ServiceTicket.create({
    ticket_number: generateTicketNumber(),
    customer: { name: 'Pelanggan Test', phone: '08123456789', type: 'Umum' },
    device: { type: 'Laptop', brand: 'Dell', symptoms: 'Mati total' },
    technician,
    status: 'Picked_Up',
    service_fee,
    total_cost: service_fee + partsTotal,
    payment_method: 'Cash',
    history: { picked_up_at }
  });
}

// ---------------------------------------------------------------------------
// getFullRecap
// ---------------------------------------------------------------------------
describe('getFullRecap', () => {
  it('harus mengembalikan rekap lengkap dengan inventory, transaksi, dan servis', async () => {
    const item1 = await createItem({ stock: 10, purchase_price: 5000, selling_price: 10000 });
    const item2 = await createItem({ stock: 5, purchase_price: 8000, selling_price: 15000 });

    const kasir = await createKasir();
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item1._id, name: item1.name, qty: 2, price: item1.selling_price, subtotal: item1.selling_price * 2 }],
      grand_total: item1.selling_price * 2,
      payment_method: 'Cash',
      amount_paid: item1.selling_price * 2 + 5000,
      change: 5000
    });

    await createPickedUpTicket({ service_fee: 100000 });

    const req = { query: { range: 'all' } };
    const res = mockRes();
    await getFullRecap(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.range).toBe('all');
    expect(result.data.summary.inventory_items).toBe(2);
    expect(result.data.summary.total_inventory_value).toBe(10 * 5000 + 5 * 8000);
    expect(result.data.summary.total_retail_transactions).toBe(1);
    expect(result.data.summary.total_retail_revenue).toBe(item1.selling_price * 2);
    expect(result.data.summary.total_service_tickets).toBe(1);
    expect(result.data.summary.total_service_revenue).toBe(100000);
    expect(result.data.summary.grand_total_revenue).toBe(item1.selling_price * 2 + 100000);
    expect(result.data.inventory).toHaveLength(2);
    expect(result.data.transactions).toHaveLength(1);
    expect(result.data.services).toHaveLength(1);
    expect(result.data.trends.retail).toBeDefined();
    expect(result.data.trends.services).toBeDefined();
  });

  it('harus mengembalikan nilai nol saat tidak ada data', async () => {
    const req = { query: { range: 'all' } };
    const res = mockRes();
    await getFullRecap(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.summary.inventory_items).toBe(0);
    expect(result.data.summary.total_inventory_value).toBe(0);
    expect(result.data.summary.total_retail_transactions).toBe(0);
    expect(result.data.summary.total_retail_revenue).toBe(0);
    expect(result.data.summary.total_service_tickets).toBe(0);
    expect(result.data.summary.total_service_revenue).toBe(0);
    expect(result.data.summary.grand_total_revenue).toBe(0);
  });

  it('harus memfilter transaksi dan servis dalam 30 hari terakhir', async () => {
    const kasir = await createKasir();
    const item = await createItem();

    // Transaksi lama — 60 hari yang lalu
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0,
      date: oldDate
    });

    // Transaksi baru
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0
    });

    const req = { query: { range: '30days' } };
    const res = mockRes();
    await getFullRecap(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.range).toBe('30days');
    expect(result.data.summary.total_retail_transactions).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getDailyRevenue
// ---------------------------------------------------------------------------
describe('getDailyRevenue', () => {
  it('harus mengembalikan pendapatan harian untuk hari ini', async () => {
    const kasir = await createKasir();
    const item = await createItem();

    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 2, price: item.selling_price, subtotal: item.selling_price * 2 }],
      grand_total: item.selling_price * 2,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 2,
      change: 0
    });

    await createPickedUpTicket({ service_fee: 50000 });

    const req = { query: {} };
    const res = mockRes();
    await getDailyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.retail_sales.revenue).toBe(item.selling_price * 2);
    expect(result.data.retail_sales.transactions).toBe(1);
    expect(result.data.service_revenue.revenue).toBe(50000);
    expect(result.data.service_revenue.tickets).toBe(1);
    expect(result.data.total_revenue).toBe(item.selling_price * 2 + 50000);
    expect(result.data.total_transactions).toBe(2);
  });

  it('harus mengembalikan nol saat tidak ada pendapatan hari ini', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getDailyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data.retail_sales.revenue).toBe(0);
    expect(result.data.retail_sales.transactions).toBe(0);
    expect(result.data.service_revenue.revenue).toBe(0);
    expect(result.data.service_revenue.tickets).toBe(0);
    expect(result.data.total_revenue).toBe(0);
  });

  it('harus mengembalikan pendapatan untuk tanggal tertentu', async () => {
    const targetDate = new Date(Date.UTC(2026, 5, 15, 10, 0, 0));
    const kasir = await createKasir();
    const item = await createItem();

    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0,
      date: targetDate
    });

    await createPickedUpTicket({ picked_up_at: targetDate, service_fee: 30000 });

    const req = { query: { date: '2026-06-15' } };
    const res = mockRes();
    await getDailyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.date).toBe('2026-06-15');
    expect(result.data.retail_sales.revenue).toBe(item.selling_price);
    expect(result.data.service_revenue.revenue).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// getMonthlyRevenue
// ---------------------------------------------------------------------------
describe('getMonthlyRevenue', () => {
  it('harus mengembalikan pendapatan bulanan untuk Juni 2026', async () => {
    const targetDate = new Date(Date.UTC(2026, 5, 15, 10, 0, 0));
    const kasir = await createKasir();
    const item = await createItem();

    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 3, price: item.selling_price, subtotal: item.selling_price * 3 }],
      grand_total: item.selling_price * 3,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 3,
      change: 0,
      date: targetDate
    });

    await createPickedUpTicket({ picked_up_at: targetDate, service_fee: 80000 });

    const req = { query: { year: '2026', month: '6' } };
    const res = mockRes();
    await getMonthlyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.period.year).toBe(2026);
    expect(result.period.month).toBe(6);
    expect(result.data.total_revenue).toBe(item.selling_price * 3 + 80000);
    expect(result.data.retail_revenue).toBe(item.selling_price * 3);
    expect(result.data.service_revenue).toBe(80000);
    expect(result.data.daily_breakdown.length).toBeGreaterThanOrEqual(1);
    const day15 = result.data.daily_breakdown.find(d => d.day === 15);
    expect(day15).toBeDefined();
    expect(day15.retail_revenue).toBe(item.selling_price * 3);
    expect(day15.service_revenue).toBe(80000);
    expect(day15.total_revenue).toBe(item.selling_price * 3 + 80000);
  });

  it('harus mengembalikan 400 untuk tahun tidak valid (< 2000)', async () => {
    const req = { query: { year: '1999' } };
    const res = mockRes();
    await getMonthlyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Parameter tahun tidak valid' });
  });

  it('harus mengembalikan 400 untuk tahun tidak valid (> 2100)', async () => {
    const req = { query: { year: '2200' } };
    const res = mockRes();
    await getMonthlyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Parameter tahun tidak valid' });
  });

  it('harus mengembalikan 400 untuk bulan tidak valid (> 12)', async () => {
    const req = { query: { month: '13' } };
    const res = mockRes();
    await getMonthlyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Parameter bulan tidak valid (1-12)' });
  });

  it('harus mengembalikan 400 untuk bulan tidak valid (< 1)', async () => {
    const req = { query: { month: '0' } };
    const res = mockRes();
    await getMonthlyRevenue(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Parameter bulan tidak valid (1-12)' });
  });
});

// ---------------------------------------------------------------------------
// getRevenueByRange
// ---------------------------------------------------------------------------
describe('getRevenueByRange', () => {
  it('harus mengembalikan pendapatan dalam rentang tanggal', async () => {
    const dalamRentang = new Date(Date.UTC(2026, 5, 15, 10, 0, 0));
    const kasir = await createKasir();
    const item = await createItem();

    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 2, price: item.selling_price, subtotal: item.selling_price * 2 }],
      grand_total: item.selling_price * 2,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 2,
      change: 0,
      date: dalamRentang
    });

    await createPickedUpTicket({ picked_up_at: dalamRentang, service_fee: 60000 });

    // Transaksi di luar rentang
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0,
      date: new Date(Date.UTC(2026, 3, 1, 10, 0, 0))
    });

    const req = { query: { start_date: '2026-06-01', end_date: '2026-06-30' } };
    const res = mockRes();
    await getRevenueByRange(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.period.start).toBe('2026-06-01');
    expect(result.period.end).toBe('2026-06-30');
    expect(result.data.retail_revenue).toBe(item.selling_price * 2);
    expect(result.data.retail_transactions).toBe(1);
    expect(result.data.service_revenue).toBe(60000);
    expect(result.data.service_tickets).toBe(1);
    expect(result.data.total_revenue).toBe(item.selling_price * 2 + 60000);
    expect(result.data.total_count).toBe(2);
  });

  it('harus mengembalikan 400 ketika start_date tidak diberikan', async () => {
    const req = { query: { end_date: '2026-06-30' } };
    const res = mockRes();
    await getRevenueByRange(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Tanggal mulai dan tanggal akhir wajib diisi'
    });
  });

  it('harus mengembalikan 400 ketika end_date tidak diberikan', async () => {
    const req = { query: { start_date: '2026-06-01' } };
    const res = mockRes();
    await getRevenueByRange(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Tanggal mulai dan tanggal akhir wajib diisi'
    });
  });

  it('harus mengembalikan 400 ketika tidak ada parameter tanggal', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getRevenueByRange(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Tanggal mulai dan tanggal akhir wajib diisi'
    });
  });
});

// ---------------------------------------------------------------------------
// getTopSellingItems
// ---------------------------------------------------------------------------
describe('getTopSellingItems', () => {
  it('harus mengembalikan item terlaris diurutkan berdasarkan jumlah terjual', async () => {
    const kasir = await createKasir();
    const itemA = await createItem({ name: 'Item A', selling_price: 10000 });
    const itemB = await createItem({ name: 'Item B', selling_price: 20000 });

    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: itemA._id, name: itemA.name, qty: 3, price: itemA.selling_price, subtotal: 30000 }],
      grand_total: 30000,
      payment_method: 'Cash',
      amount_paid: 30000,
      change: 0
    });
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: itemB._id, name: itemB.name, qty: 1, price: itemB.selling_price, subtotal: 20000 }],
      grand_total: 20000,
      payment_method: 'Cash',
      amount_paid: 20000,
      change: 0
    });

    const req = { query: {} };
    const res = mockRes();
    await getTopSellingItems(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].total_qty_sold).toBe(3);
    expect(result.data[0].item_name).toBe(itemA.name);
    expect(result.data[0].total_revenue).toBe(30000);
    expect(result.data[0].times_purchased).toBe(1);
    expect(result.data[1].total_qty_sold).toBe(1);
    expect(result.data[1].item_name).toBe(itemB.name);
  });

  it('harus memfilter item terlaris berdasarkan rentang tanggal', async () => {
    const kasir = await createKasir();
    const item = await createItem({ name: 'Filtered Item' });

    // Transaksi dalam rentang
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 2, price: item.selling_price, subtotal: item.selling_price * 2 }],
      grand_total: item.selling_price * 2,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 2,
      change: 0,
      date: new Date(Date.UTC(2026, 5, 15, 10, 0, 0))
    });

    // Transaksi di luar rentang
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 5, price: item.selling_price, subtotal: item.selling_price * 5 }],
      grand_total: item.selling_price * 5,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 5,
      change: 0,
      date: new Date(Date.UTC(2026, 3, 1, 10, 0, 0))
    });

    const req = { query: { start_date: '2026-06-01', end_date: '2026-06-30' } };
    const res = mockRes();
    await getTopSellingItems(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toHaveLength(1);
    expect(result.data[0].total_qty_sold).toBe(2);
  });

  it('harus membatasi jumlah hasil sesuai parameter limit', async () => {
    const kasir = await createKasir();
    const items = await Promise.all([
      createItem({ name: 'Item 1' }),
      createItem({ name: 'Item 2' }),
      createItem({ name: 'Item 3' })
    ]);

    for (const item of items) {
      await Transaction.create({
        cashier_id: kasir._id,
        cashier_name: kasir.name,
        items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
        grand_total: item.selling_price,
        payment_method: 'Cash',
        amount_paid: item.selling_price,
        change: 0
      });
    }

    const req = { query: { limit: '2' } };
    const res = mockRes();
    await getTopSellingItems(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toHaveLength(2);
  });

  it('harus mengembalikan array kosong saat tidak ada transaksi', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getTopSellingItems(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCashierPerformance
// ---------------------------------------------------------------------------
describe('getCashierPerformance', () => {
  it('harus mengembalikan performa kasir', async () => {
    const kasir1 = await createKasir();
    const kasir2 = await createKasir();
    const item = await createItem();

    // Kasir 1 — 2 transaksi
    await Transaction.create({
      cashier_id: kasir1._id,
      cashier_name: kasir1.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0
    });
    await Transaction.create({
      cashier_id: kasir1._id,
      cashier_name: kasir1.name,
      items: [{ item_id: item._id, name: item.name, qty: 2, price: item.selling_price, subtotal: item.selling_price * 2 }],
      grand_total: item.selling_price * 2,
      payment_method: 'Transfer',
      amount_paid: item.selling_price * 2,
      change: 0
    });

    // Kasir 2 — 1 transaksi
    await Transaction.create({
      cashier_id: kasir2._id,
      cashier_name: kasir2.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'QRIS',
      amount_paid: item.selling_price,
      change: 0
    });

    const req = { query: {} };
    const res = mockRes();
    await getCashierPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);

    const perfKasir1 = result.data.find(p => p.cashier_name === kasir1.name);
    const perfKasir2 = result.data.find(p => p.cashier_name === kasir2.name);
    expect(perfKasir1).toBeDefined();
    expect(perfKasir1.total_transactions).toBe(2);
    expect(perfKasir1.total_revenue).toBe(item.selling_price + item.selling_price * 2);
    expect(perfKasir1.avg_transaction_value).toBeCloseTo((item.selling_price + item.selling_price * 2) / 2, 0);

    expect(perfKasir2).toBeDefined();
    expect(perfKasir2.total_transactions).toBe(1);
    expect(perfKasir2.total_revenue).toBe(item.selling_price);
  });

  it('harus memfilter performa kasir berdasarkan rentang tanggal', async () => {
    const kasir = await createKasir();
    const item = await createItem();

    // Dalam rentang
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0,
      date: new Date(Date.UTC(2026, 5, 15, 10, 0, 0))
    });

    // Di luar rentang
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 3, price: item.selling_price, subtotal: item.selling_price * 3 }],
      grand_total: item.selling_price * 3,
      payment_method: 'Cash',
      amount_paid: item.selling_price * 3,
      change: 0,
      date: new Date(Date.UTC(2026, 3, 1, 10, 0, 0))
    });

    const req = { query: { start_date: '2026-06-01', end_date: '2026-06-30' } };
    const res = mockRes();
    await getCashierPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toHaveLength(1);
    expect(result.data[0].total_transactions).toBe(1);
    expect(result.data[0].total_revenue).toBe(item.selling_price);
  });

  it('harus mengembalikan array kosong saat tidak ada transaksi', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getCashierPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTechnicianPerformance
// ---------------------------------------------------------------------------
describe('getTechnicianPerformance', () => {
  it('harus mengembalikan performa teknisi dari tiket Picked_Up', async () => {
    const tech1 = await createTeknisi();
    const tech2 = await createTeknisi();

    await createPickedUpTicket({
      technician: { id: tech1._id, name: tech1.name },
      service_fee: 100000
    });
    await createPickedUpTicket({
      technician: { id: tech1._id, name: tech1.name },
      service_fee: 50000
    });
    await createPickedUpTicket({
      technician: { id: tech2._id, name: tech2.name },
      service_fee: 75000
    });

    const req = { query: {} };
    const res = mockRes();
    await getTechnicianPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);

    const perfTech1 = result.data.find(p => p.technician_name === tech1.name);
    const perfTech2 = result.data.find(p => p.technician_name === tech2.name);
    expect(perfTech1).toBeDefined();
    expect(perfTech1.total_tickets).toBe(2);
    expect(perfTech1.total_revenue).toBe(150000);
    expect(perfTech1.avg_ticket_value).toBe(75000);

    expect(perfTech2).toBeDefined();
    expect(perfTech2.total_tickets).toBe(1);
    expect(perfTech2.total_revenue).toBe(75000);
  });

  it('harus memfilter performa teknisi berdasarkan rentang tanggal', async () => {
    const tech = await createTeknisi();

    // Dalam rentang
    await createPickedUpTicket({
      technician: { id: tech._id, name: tech.name },
      picked_up_at: new Date(Date.UTC(2026, 5, 15, 10, 0, 0)),
      service_fee: 100000
    });

    // Di luar rentang
    await createPickedUpTicket({
      technician: { id: tech._id, name: tech.name },
      picked_up_at: new Date(Date.UTC(2026, 3, 1, 10, 0, 0)),
      service_fee: 200000
    });

    const req = { query: { start_date: '2026-06-01', end_date: '2026-06-30' } };
    const res = mockRes();
    await getTechnicianPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toHaveLength(1);
    expect(result.data[0].total_tickets).toBe(1);
    expect(result.data[0].total_revenue).toBe(100000);
  });

  it('harus mengembalikan array kosong saat tidak ada tiket Picked_Up', async () => {
    const tech = await createTeknisi();
    // Tiket dengan status Queue — tidak dihitung
    await ServiceTicket.create({
      ticket_number: generateTicketNumber(),
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: tech._id, name: tech.name },
      status: 'Queue'
    });

    const req = { query: {} };
    const res = mockRes();
    await getTechnicianPerformance(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.json.mock.calls[0][0];
    expect(result.data).toEqual([]);
  });
});
