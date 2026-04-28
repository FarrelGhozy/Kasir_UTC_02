const mongoose = require('mongoose');
const ServiceTicket = require('./models/ServiceTicket');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kasir_utc');
    console.log('Connected to DB');

    const ticket = new ServiceTicket({
      ticket_number: 'TEST-LOGIC-001',
      customer: { name: 'Test User', phone: '08123456789', type: 'Umum' },
      device: { type: 'Laptop', symptoms: 'Mati' },
      technician: { id: new mongoose.Types.ObjectId(), name: 'Test Tech' },
      status: 'Queue'
    });
    
    await ticket.save();
    console.log('1. Ticket Created');

    await ticket.updateStatus('Completed');
    ticket.timestamps.picked_up_at = new Date();
    await ticket.updateStatus('Picked_Up');
    console.log('2. Ticket Picked Up');

    await ticket.updateStatus('Warranty_Process');
    console.log('3. Warranty Process Initiated');

    await ticket.updateStatus('Warranty_Rejected');
    console.log('4. Warranty Rejected (Logic OK)');

    await ServiceTicket.deleteOne({ _id: ticket._id });
    console.log('5. Cleanup OK');
    
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err.message);
    process.exit(1);
  }
}

test();
