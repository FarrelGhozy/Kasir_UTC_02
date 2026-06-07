const mongoose = require('mongoose');
const ServiceTicket = require('../../models/ServiceTicket');
const Item = require('../../models/Item');
const { createItem } = require('../helpers/factory');

describe('ServiceTicket - Ticket Number Generation', () => {
  it('should generate SRV-YEAR-XXXX format', async () => {
    const num = await ServiceTicket.generateTicketNumber();
    expect(num).toMatch(/^SRV-\d{4}-\d{4}$/);
  });

  it('should increment sequence number', async () => {
    const num1 = await ServiceTicket.generateTicketNumber();
    // Save a ticket to advance sequence
    await ServiceTicket.create({
      ticket_number: num1,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    const num2 = await ServiceTicket.generateTicketNumber();
    const seq1 = parseInt(num1.match(/(\d+)$/)[1]);
    const seq2 = parseInt(num2.match(/(\d+)$/)[1]);
    expect(seq2).toBeGreaterThan(seq1);
  });

  it('should use current year in prefix', async () => {
    const num = await ServiceTicket.generateTicketNumber();
    const year = new Date().getFullYear();
    expect(num).toContain(`SRV-${year}`);
  });
});

describe('ServiceTicket - Status Transitions', () => {
  const transitions = {
    'Queue':        ['Diagnosing', 'Cancelled', 'Completed', 'In_Progress', 'Waiting_Part'],
    'Diagnosing':   ['Waiting_Part', 'In_Progress', 'Cancelled', 'Queue', 'Completed'],
    'Waiting_Part': ['In_Progress', 'Cancelled', 'Queue', 'Diagnosing', 'Completed'],
    'In_Progress':  ['Completed', 'Waiting_Part', 'Cancelled', 'Queue', 'Diagnosing'],
    'Completed':    ['Picked_Up', 'In_Progress', 'Queue', 'Diagnosing', 'Waiting_Part'],
    'Cancelled':    ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress'],
    'Picked_Up':    []
  };

  const allStatuses = Object.keys(transitions);

  for (const [from, allowed] of Object.entries(transitions)) {
    for (const to of allowed) {
      it(`${from} → ${to} should succeed`, async () => {
        const ticket = await ServiceTicket.create({
          ticket_number: `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', symptoms: 'Mati' },
          technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
          status: from
        });
        await ticket.updateStatus(to);
        expect(ticket.status).toBe(to);
      });
    }

    const invalid = allStatuses.filter(s => !allowed.includes(s) && s !== from);
    for (const to of invalid.slice(0, 2)) {
      it(`${from} → ${to} should throw error`, async () => {
        const ticket = await ServiceTicket.create({
          ticket_number: `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', symptoms: 'Mati' },
          technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
          status: from
        });
        await expect(ticket.updateStatus(to)).rejects.toThrow();
      });
    }
  }
});

describe('ServiceTicket - Side Effects', () => {
  it('Diagnosing should set diagnosed_at', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    await ticket.updateStatus('Diagnosing');
    expect(ticket.history.diagnosed_at).toBeTruthy();
  });

  it('Completed should set completed_at', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
      status: 'Diagnosing'
    });
    await ticket.updateStatus('Completed');
    expect(ticket.history.completed_at).toBeTruthy();
  });

  it('Picked_Up should set picked_up_at and 7-day warranty', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
      status: 'Completed'
    });
    await ticket.updateStatus('Picked_Up', 'Cash');
    expect(ticket.history.picked_up_at).toBeTruthy();
    expect(ticket.warranty_expires_at).toBeTruthy();
    expect(ticket.payment_method).toBe('Cash');

    const diff = new Date(ticket.warranty_expires_at) - new Date();
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it('Picked_Up twice should not change warranty_expires_at', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
      status: 'Completed'
    });
    await ticket.updateStatus('Picked_Up');
    const firstWarranty = ticket.warranty_expires_at;
    // Directly set status to go back to Completed (Picked_Up has no valid transitions)
    ticket.status = 'Completed';
    await ticket.save();
    await ticket.updateStatus('Picked_Up');
    expect(ticket.warranty_expires_at).toEqual(firstWarranty);
  });
});

describe('ServiceTicket - total_cost Calculation', () => {
  it('should calculate total_cost as sum of parts + service_fee', async () => {
    const oid = new mongoose.Types.ObjectId();
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
      service_fee: 50000,
      parts_used: [
        { item_id: oid, name: 'Part A', qty: 1, price_at_time: 10000, subtotal: 10000 },
        { item_id: oid, name: 'Part B', qty: 2, price_at_time: 5000, subtotal: 10000 }
      ]
    });
    expect(ticket.total_cost).toBe(20000 + 50000);
  });

  it('should recalculate total_cost when parts change', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' },
      service_fee: 50000
    });
    expect(ticket.total_cost).toBe(50000);

    ticket.parts_used.push({ item_id: new mongoose.Types.ObjectId(), name: 'Part', qty: 1, price_at_time: 25000, subtotal: 25000 });
    await ticket.save();
    expect(ticket.total_cost).toBe(75000);
  });
});

describe('ServiceTicket - addPart With Stock Deduction', () => {
  it('should deduct stock atomically and add part', async () => {
    const item = await createItem({ stock: 10 });
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    await ticket.addPart(item._id, 3);
    expect(ticket.parts_used.length).toBe(1);
    expect(ticket.parts_used[0].qty).toBe(3);
    expect(ticket.parts_used[0].name).toBe(item.name);
    const updatedItem = await Item.findById(item._id);
    expect(updatedItem.stock).toBe(7);
  });

  it('should throw error if stock insufficient', async () => {
    const item = await createItem({ stock: 2 });
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    await expect(ticket.addPart(item._id, 5)).rejects.toThrow('Stok tidak cukup');
    const updatedItem = await Item.findById(item._id);
    expect(updatedItem.stock).toBe(2);
  });
});

describe('ServiceTicket - duration_days Virtual', () => {
  it('should return null if not completed', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    expect(ticket.duration_days).toBeNull();
  });

  it('should calculate duration in days', async () => {
    const ticket = await ServiceTicket.create({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    // Use created_at as baseline to avoid ms drift with Math.ceil
    const created = ticket.history.created_at;
    ticket.history.completed_at = new Date(created.getTime() + 3 * 24 * 60 * 60 * 1000);
    const days = ticket.duration_days;
    expect(days).toBe(3);
  });
});

describe('ServiceTicket - Customer Phone Validation', () => {
  it('should accept valid Indonesian phone numbers', async () => {
    const validPhones = ['08123456789', '628123456789', '+628123456789'];
    for (const phone of validPhones) {
      const ticket = new ServiceTicket({
        ticket_number: `SRV-${Date.now()}-${Math.random()}`,
        customer: { name: 'Test', phone, type: 'Umum' },
        device: { type: 'Laptop', symptoms: 'Mati' },
        technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
      });
      await expect(ticket.validate()).resolves.not.toThrow();
    }
  });

  it('should reject invalid phone numbers', async () => {
    const ticket = new ServiceTicket({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '123', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    await expect(ticket.validate()).rejects.toThrow();
  });

  it('should accept empty phone (optional)', async () => {
    const ticket = new ServiceTicket({
      ticket_number: `SRV-${Date.now()}`,
      customer: { name: 'Test', phone: '', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Tech' }
    });
    await expect(ticket.validate()).resolves.not.toThrow();
  });
});
