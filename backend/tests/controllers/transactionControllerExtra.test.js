// tests/controllers/transactionControllerExtra.test.js — validasi + tanggal ketat
const {
  createRetailTransaction, getAllTransactions, getTodaySummary, deleteTransaction
} = require('../../controllers/transactionController');
const { createItem, createKasir } = require('../helpers/factory');
const Item = require('../../models/Item');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

async function cartFixture() {
  const kasir = await createKasir();
  const item = await createItem({ stock: 10, selling_price: 20000, purchase_price: 10000 });
  return { kasir, item };
}

describe('transactionController.createRetailTransaction validasi', () => {
  it('400 bila keranjang kosong', async () => {
    const { kasir } = await cartFixture();
    const res = mockRes();
    await createRetailTransaction({ body: { items: [], payment_method: 'Cash' }, user: { id: kasir._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila metode bayar tidak dikenal', async () => {
    const { kasir, item } = await cartFixture();
    const res = mockRes();
    await createRetailTransaction(
      { body: { items: [{ item_id: item._id.toString(), qty: 1 }], payment_method: 'Hutang' }, user: { id: kasir._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila cash kurang dari total', async () => {
    const { kasir, item } = await cartFixture();
    const res = mockRes();
    await createRetailTransaction(
      { body: { items: [{ item_id: item._id.toString(), qty: 1 }], payment_method: 'Cash', amount_paid: 1000 }, user: { id: kasir._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('201 + stok berkurang + kembalian dihitung model', async () => {
    const { kasir, item } = await cartFixture();
    const res = mockRes();
    await createRetailTransaction(
      { body: { items: [{ item_id: item._id.toString(), qty: 2 }], payment_method: 'Cash', amount_paid: 50000 }, user: { id: kasir._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const data = res.json.mock.calls[0][0].data;
    expect(data.grand_total).toBe(40000);
    expect(data.change).toBe(10000);
    const after = await Item.findById(item._id).lean();
    expect(after.stock).toBe(8);
  });

  it('400 bila stok tidak cukup', async () => {
    const { kasir, item } = await cartFixture();
    const res = mockRes();
    await createRetailTransaction(
      { body: { items: [{ item_id: item._id.toString(), qty: 99 }], payment_method: 'QRIS' }, user: { id: kasir._id.toString() } },
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('transactionController.getAllTransactions tanggal ketat', () => {
  it('400 bila start_date tak-kalendar (2026-13-45)', async () => {
    const res = mockRes();
    await getAllTransactions({ query: { start_date: '2026-13-45' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila end_date tak-kalendar (2025-02-30)', async () => {
    const res = mockRes();
    await getAllTransactions({ query: { end_date: '2025-02-30' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('transactionController.getTodaySummary + deleteTransaction', () => {
  it('summary selalu 200 dengan struktur angka', async () => {
    const res = mockRes();
    await getTodaySummary({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(typeof data.total_transactions).toBe('number');
    expect(typeof data.total_revenue).toBe('number');
  });

  it('hapus mengembalikan stok', async () => {
    const { kasir, item } = await cartFixture();
    const resCreate = mockRes();
    await createRetailTransaction(
      { body: { items: [{ item_id: item._id.toString(), qty: 3 }], payment_method: 'Cash', amount_paid: 60000 }, user: { id: kasir._id.toString() } },
      resCreate, jest.fn()
    );
    const trxId = resCreate.json.mock.calls[0][0].data._id.toString();
    const mid = await Item.findById(item._id).lean();
    expect(mid.stock).toBe(7);

    const res = mockRes();
    await deleteTransaction({ params: { id: trxId } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const after = await Item.findById(item._id).lean();
    expect(after.stock).toBe(10);
  });
});
