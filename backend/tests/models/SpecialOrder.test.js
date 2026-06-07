const mongoose = require('mongoose');
const SpecialOrder = require('../../models/SpecialOrder');

describe('SpecialOrder - Status Transitions', () => {
  const validTransitions = {
    'Pending': ['Searching', 'Cancelled'],
    'Searching': ['Ordered', 'Cancelled'],
    'Ordered': ['Arrived', 'Cancelled'],
    'Arrived': ['Picked_Up', 'Cancelled'],
    'Picked_Up': ['Cancelled'],
    'Cancelled': ['Pending']
  };

  const allStatuses = Object.keys(validTransitions);

  for (const [from, allowed] of Object.entries(validTransitions)) {
    for (const to of allowed) {
      it(`${from} → ${to} should succeed`, async () => {
        const order = await SpecialOrder.create({
          order_number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
          item_name: 'Barang Test',
          status: from
        });
        order.status = to;
        if (to === 'Ordered') order.history.ordered_at = new Date();
        if (to === 'Arrived') order.history.arrived_at = new Date();
        if (to === 'Picked_Up') order.history.picked_up_at = new Date();
        await order.save();
        expect(order.status).toBe(to);
      });
    }

    const invalid = allStatuses.filter(s => !allowed.includes(s) && s !== from);
    for (const to of invalid.slice(0, 2)) {
      it(`${from} → ${to} should throw error`, async () => {
        const order = await SpecialOrder.create({
          order_number: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
          item_name: 'Barang Test',
          status: from
        });
        order.status = to;
        await expect(order.save()).rejects.toThrow();
      });
    }
  }
});

describe('SpecialOrder - Order Number Generation', () => {
  it('should generate ORD-YEAR-XXXX format', async () => {
    const num = await SpecialOrder.generateOrderNumber();
    expect(num).toMatch(/^ORD-\d{4}-\d{4}$/);
  });

  it('should increment sequence number', async () => {
    const num1 = await SpecialOrder.generateOrderNumber();
    await SpecialOrder.create({
      order_number: num1,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      item_name: 'Test'
    });
    const num2 = await SpecialOrder.generateOrderNumber();
    const seq1 = parseInt(num1.match(/(\d+)$/)[1]);
    const seq2 = parseInt(num2.match(/(\d+)$/)[1]);
    expect(seq2).toBeGreaterThan(seq1);
  });
});

describe('SpecialOrder - remaining_payment Virtual', () => {
  it('should calculate remaining payment', async () => {
    const order = new SpecialOrder({
      order_number: 'ORD-TEST-001',
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      item_name: 'Test',
      estimated_price: 500000,
      down_payment: 100000
    });
    expect(order.remaining_payment).toBe(400000);
  });

  it('should return 0 if DP exceeds estimated price', async () => {
    const order = new SpecialOrder({
      order_number: 'ORD-TEST-002',
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      item_name: 'Test',
      estimated_price: 100000,
      down_payment: 200000
    });
    expect(order.remaining_payment).toBe(0);
  });

  it('should return 0 if estimated_price is 0', async () => {
    const order = new SpecialOrder({
      order_number: 'ORD-TEST-003',
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      item_name: 'Test',
      estimated_price: 0,
      down_payment: 0
    });
    expect(order.remaining_payment).toBe(0);
  });
});

describe('SpecialOrder - Phone Validation', () => {
  it('should accept valid phone formats', async () => {
    const phones = ['08123456789', '+628123456789', '62812345678'];
    for (const phone of phones) {
      const order = new SpecialOrder({
        order_number: `ORD-${Date.now()}-${Math.random()}`,
        customer: { name: 'Test', phone, type: 'Umum' },
        item_name: 'Test'
      });
      await expect(order.validate()).resolves.not.toThrow();
    }
  });

  it('should reject invalid phone', async () => {
    const order = new SpecialOrder({
      order_number: `ORD-${Date.now()}`,
      customer: { name: 'Test', phone: '12345', type: 'Umum' },
      item_name: 'Test'
    });
    await expect(order.validate()).rejects.toThrow();
  });
});
