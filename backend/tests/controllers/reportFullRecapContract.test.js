// tests/controllers/reportFullRecapContract.test.js
// Contract test: bentuk payload getFullRecap HARUS cocok dengan yang dibaca
// frontend/public/js/modules/reports.js (build*Rows, drawRecapSummary/Charts).
// Inilah test yang hilang sehingga bug PDF lolos walau test lama hijau.
const { getFullRecap } = require('../../controllers/reportController');
const { createItem, createKasir, createTeknisi } = require('../helpers/factory');
const Transaction = require('../../models/Transaction');
const ServiceTicket = require('../../models/ServiceTicket');

function mockRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { status, json };
}

function payloadOf(res) {
  return res.json.mock.calls[0][0];
}

describe('getFullRecap contract untuk PDF frontend', () => {
  it('payload memuat semua field yang dibaca row-builder frontend', async () => {
    const item = await createItem({ stock: 4, purchase_price: 5000, selling_price: 10000 });
    const kasir = await createKasir();
    await Transaction.create({
      cashier_id: kasir._id,
      cashier_name: kasir.name,
      items: [{ item_id: item._id, name: item.name, qty: 1, price: item.selling_price, subtotal: item.selling_price }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price,
      change: 0
    });

    const tech = await createTeknisi();
    await ServiceTicket.create({
      ticket_number: `SRV-TEST-${Date.now()}`,
      customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati total' },
      technician: { id: tech._id, name: tech.name },
      status: 'Picked_Up',
      service_fee: 50000,
      total_cost: 50000,
      payment_method: 'Cash',
      history: { picked_up_at: new Date() }
    });

    const res = mockRes();
    await getFullRecap({ query: { range: 'all' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const result = payloadOf(res);
    expect(result.success).toBe(true);

    // Kontrak summary (dibaca drawRecapSummary + drawRecapCharts)
    const { summary, trends, inventory, services, transactions } = result.data;
    const summaryKeys = [
      'inventory_items', 'total_inventory_value', 'total_service_tickets',
      'total_service_revenue', 'total_retail_transactions', 'total_retail_revenue',
      'grand_total_revenue'
    ];
    summaryKeys.forEach((k) => expect(summary[k]).toBeDefined());

    // Kontrak trends
    expect(Array.isArray(trends.services)).toBe(true);
    expect(Array.isArray(trends.retail)).toBe(true);

    // Kontrak inventaris (dibaca buildInventoryRows)
    expect(inventory.length).toBeGreaterThanOrEqual(1);
    ['sku', 'name', 'category', 'selling_price', 'stock', 'purchase_price']
      .forEach((k) => expect(inventory[0]).toHaveProperty(k));

    // Kontrak servis (dibaca buildServiceRows — nested wajib ada)
    expect(services.length).toBeGreaterThanOrEqual(1);
    expect(services[0]).toHaveProperty('ticket_number');
    expect(services[0].customer).toHaveProperty('name');
    expect(services[0].device).toHaveProperty('symptoms');
    expect(services[0].technician).toHaveProperty('name');

    // Kontrak transaksi (dibaca buildTransactionRows)
    expect(transactions.length).toBeGreaterThanOrEqual(1);
    expect(transactions[0]).toHaveProperty('invoice_no');
    expect(Array.isArray(transactions[0].items)).toBe(true);
    expect(transactions[0]).toHaveProperty('cashier_name');
  });

  it('summary tetap angka (bukan NaN) walau ada dokumen legacy berlubang', async () => {
    await Transaction.collection.insertOne({
      cashier_id: (await createKasir())._id,
      cashier_name: 'Legacy',
      items: [],
      payment_method: 'Cash',
      amount_paid: 0,
      date: new Date()
      // grand_total sengaja hilang (dok legacy)
    });

    const res = mockRes();
    await getFullRecap({ query: { range: 'all' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const { summary } = payloadOf(res).data;
    Object.values(summary).forEach((v) => expect(Number.isNaN(v)).toBe(false));
  });

  it('menolak range tak dikenal dengan 400', async () => {
    const res = mockRes();
    await getFullRecap({ query: { range: 'semua_data' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Parameter 'range' tidak valid (gunakan 'all' atau '30days')"
    });
  });

  it('range default (tanpa query) berperilaku sebagai all', async () => {
    const res = mockRes();
    await getFullRecap({ query: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(payloadOf(res).range).toBe('all');
  });

  it('tidak membocorkan kolom berat yang tak dipakai PDF', async () => {
    await createItem();
    const res = mockRes();
    await getFullRecap({ query: { range: 'all' } }, res, jest.fn());

    const { transactions, services } = payloadOf(res).data;
    // notes/history panjang tidak ikut projection
    transactions.forEach((t) => {
      expect(t).not.toHaveProperty('notes');
      (t.items || []).forEach((i) => {
        expect(i).not.toHaveProperty('price');
        expect(i).not.toHaveProperty('subtotal');
      });
    });
    services.forEach((s) => {
      expect(s).not.toHaveProperty('notes');
    });
  });
});
