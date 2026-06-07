const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const Item = require('../../models/Item');
const { createItem, createUser } = require('../helpers/factory');

describe('Transaction - Invoice Number Generation', () => {
  it('should generate INV-YYYYMM-XXXX format', async () => {
    const num = await Transaction.generateInvoiceNumber();
    expect(num).toMatch(/^INV-\d{6}-\d{4}$/);
  });

  it('should increment sequence number', async () => {
    const num1 = await Transaction.generateInvoiceNumber();
    await Transaction.create({
      invoice_no: num1,
      items: [{ item_id: new mongoose.Types.ObjectId(), name: 'Test', qty: 1, price: 10000, subtotal: 10000 }],
      payment_method: 'Cash',
      grand_total: 10000,
      amount_paid: 10000,
      change: 0,
      cashier_id: new mongoose.Types.ObjectId(),
      cashier_name: 'Kasir'
    });
    const num2 = await Transaction.generateInvoiceNumber();
    const seq1 = parseInt(num1.match(/(\d+)$/)[1]);
    const seq2 = parseInt(num2.match(/(\d+)$/)[1]);
    expect(seq2).toBeGreaterThan(seq1);
  });

  it('should use current year and month', async () => {
    const num = await Transaction.generateInvoiceNumber();
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(num).toContain(prefix);
  });
});

describe('Transaction - Change Calculation', () => {
  it('should calculate change when amount_paid > grand_total', async () => {
    const cashier = await createUser();
    const item = await createItem();
    const txn = await Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [{
        item_id: item._id, name: item.name,
        qty: 1, price: item.selling_price, subtotal: item.selling_price
      }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price + 5000
    });
    expect(txn.change).toBe(5000);
    expect(txn.change).toBe(txn.amount_paid - txn.grand_total);
  });

  it('should set change to 0 when amount_paid === grand_total', async () => {
    const cashier = await createUser();
    const item = await createItem();
    const txn = await Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [{
        item_id: item._id, name: item.name,
        qty: 1, price: item.selling_price, subtotal: item.selling_price
      }],
      grand_total: item.selling_price,
      payment_method: 'Cash',
      amount_paid: item.selling_price
    });
    expect(txn.change).toBe(0);
  });

  it('should keep change 0 when amount_paid < grand_total', async () => {
    const cashier = await createUser();
    const item = await createItem();
    const txn = await Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [{
        item_id: item._id, name: item.name,
        qty: 1, price: item.selling_price, subtotal: item.selling_price
      }],
      grand_total: item.selling_price,
      payment_method: 'Transfer',
      amount_paid: 1000
    });
    expect(txn.change).toBe(0);
  });
});

describe('Transaction - Items Validation', () => {
  it('should reject transaction with no items', async () => {
    const cashier = await createUser();
    await expect(Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [],
      grand_total: 0,
      payment_method: 'Cash',
      amount_paid: 0
    })).rejects.toThrow('setidaknya satu barang');
  });

  it('should reject transaction with undefined items', async () => {
    const cashier = await createUser();
    await expect(Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      grand_total: 0,
      payment_method: 'Cash',
      amount_paid: 0
    })).rejects.toThrow();
  });

  it('should accept transaction with valid items', async () => {
    const cashier = await createUser();
    const item = await createItem();
    const txn = await Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [{
        item_id: item._id, name: item.name,
        qty: 2, price: item.selling_price, subtotal: item.selling_price * 2
      }],
      grand_total: item.selling_price * 2,
      payment_method: 'QRIS',
      amount_paid: item.selling_price * 2
    });
    expect(txn.items.length).toBe(1);
  });
});

describe('Transaction - Payment Method Validation', () => {
  const validMethods = ['Cash', 'Transfer', 'QRIS', 'Card'];
  for (const method of validMethods) {
    it(`should accept ${method}`, async () => {
      const cashier = await createUser();
      const item = await createItem();
      const txn = await Transaction.create({
        cashier_id: cashier._id,
        cashier_name: cashier.name,
        items: [{
          item_id: item._id, name: item.name,
          qty: 1, price: item.selling_price, subtotal: item.selling_price
        }],
        grand_total: item.selling_price,
        payment_method: method,
        amount_paid: item.selling_price
      });
      expect(txn.payment_method).toBe(method);
    });
  }

  it('should reject invalid payment method', async () => {
    const cashier = await createUser();
    const item = await createItem();
    await expect(Transaction.create({
      cashier_id: cashier._id,
      cashier_name: cashier.name,
      items: [{
        item_id: item._id, name: item.name,
        qty: 1, price: item.selling_price, subtotal: item.selling_price
      }],
      grand_total: item.selling_price,
      payment_method: 'Bitcoin',
      amount_paid: item.selling_price
    })).rejects.toThrow('metode pembayaran');
  });
});

describe('Transaction - Stock Deduction and Rollback', () => {
  const controller = require('../../controllers/transactionController');

  it('should deduct stock on successful transaction', async () => {
    const cashier = await createUser();
    const item = await createItem({ stock: 10 });
    const req = {
      user: { id: cashier._id.toString(), role: 'kasir' },
      body: {
        items: [{ item_id: item._id.toString(), qty: 3 }],
        payment_method: 'Cash',
        amount_paid: 100000
      }
    };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await controller.createRetailTransaction(req, { status, json: jest.fn() }, jest.fn());
    const updatedItem = await Item.findById(item._id);
    expect(updatedItem.stock).toBe(7);
  });

  it('should rollback stock on failure', async () => {
    const cashier = await createUser();
    const item = await createItem({ stock: 2 });
    const req = {
      user: { id: cashier._id.toString(), role: 'kasir' },
      body: {
        items: [
          { item_id: item._id.toString(), qty: 1 },
          { item_id: item._id.toString(), qty: 2 }
        ],
        payment_method: 'Cash',
        amount_paid: 100000
      }
    };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await controller.createRetailTransaction(req, { status, json: jest.fn() }, jest.fn());
    const updatedItem = await Item.findById(item._id);
    expect(updatedItem.stock).toBe(2);
  });
});
