const mongoose = require('mongoose');
const User = require('../../models/User');
const Item = require('../../models/Item');
const ServiceTicket = require('../../models/ServiceTicket');
const SpecialOrder = require('../../models/SpecialOrder');
const Transaction = require('../../models/Transaction');

const counter = { val: 1 };

async function createUser(overrides = {}) {
  const c = counter.val++;
  return User.create({
    name: `Test User ${c}`,
    username: `testuser_${c}_${Date.now()}`,
    password: 'password123',
    role: 'kasir',
    ...overrides
  });
}

async function createAdmin() {
  return createUser({ role: 'admin', username: `admin_${Date.now()}` });
}

async function createKasir() {
  return createUser({ role: 'kasir', username: `kasir_${Date.now()}` });
}

async function createTeknisi() {
  return createUser({ role: 'teknisi', username: `teknisi_${Date.now()}`, phone: '08123456789' });
}

async function createItem(overrides = {}) {
  const c = counter.val++;
  return Item.create({
    sku: `SKU-${c}-${Date.now()}`,
    name: `Barang ${c}`,
    category: 'Sparepart',
    purchase_price: 10000,
    selling_price: 15000,
    stock: 10,
    min_stock_alert: 5,
    ...overrides
  });
}

async function createServiceTicket(overrides = {}) {
  const tech = await createTeknisi();
  const ticketNumber = `SRV-${new Date().getFullYear()}-${String(counter.val++).padStart(4, '0')}`;
  return ServiceTicket.create({
    ticket_number: ticketNumber,
    customer: { name: 'Pelanggan Test', phone: '08123456789', type: 'Umum' },
    device: { type: 'Laptop', symptoms: 'Mati total' },
    technician: { id: tech._id, name: tech.name },
    status: 'Queue',
    ...overrides
  });
}

async function createSpecialOrder(overrides = {}) {
  const c = counter.val++;
  return SpecialOrder.create({
    order_number: `ORD-${new Date().getFullYear()}-${String(c).padStart(4, '0')}`,
    customer: { name: 'Pelanggan Order', phone: '08123456789', type: 'Umum' },
    item_name: `Barang Pesanan ${c}`,
    estimated_price: 500000,
    down_payment: 100000,
    ...overrides
  });
}

async function createTransaction(overrides = {}) {
  const cashier = await createKasir();
  const item = await createItem();
  const qty = 2;
  const subtotal = item.selling_price * qty;
  return Transaction.create({
    cashier_id: cashier._id,
    cashier_name: cashier.name,
    items: [{
      item_id: item._id,
      name: item.name,
      qty,
      price: item.selling_price,
      subtotal
    }],
    grand_total: subtotal,
    payment_method: 'Cash',
    amount_paid: subtotal + 5000,
    change: 5000,
    ...overrides
  });
}

module.exports = {
  createUser, createAdmin, createKasir, createTeknisi,
  createItem, createServiceTicket, createSpecialOrder, createTransaction
};
