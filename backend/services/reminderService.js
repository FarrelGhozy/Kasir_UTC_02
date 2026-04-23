const cron = require('node-cron');
const ServiceTicket = require('../models/ServiceTicket');
const SpecialOrder = require('../models/SpecialOrder');
const User = require('../models/User');
const whatsappService = require('./whatsappService');

class ReminderService {
  constructor() {
    // Schedule: Setiap jam di menit ke-0, dari jam 08:00 sampai 15:00
    // Format cron: menit jam hari_bulan bulan hari_minggu
    // Jam 08-15 berarti 8, 9, 10, 11, 12, 13, 14, 15
    this.schedule = '0 8-15 * * *';
  }

  init() {
    console.log('[ReminderService] Menjalankan scheduler pengingat...');
    cron.schedule(this.schedule, async () => {
      await this.runReminders();
    });
    
    // Opsional: Jalankan sekali saat startup (untuk testing atau jika server baru nyala)
    // this.runReminders();
  }

  async runReminders() {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    
    // Jika hari Jumat (5), kantor libur, jangan kirim pengingat
    if (day === 5) {
      console.log('[ReminderService] Hari Jumat, libur. Melewati pengingat.');
      return;
    }

    console.log('[ReminderService] Memulai pengecekan pengingat...');
    
    try {
      await this.remindCustomersForService();
      await this.remindCustomersForOrders();
      await this.remindTechnicians();
      console.log('[ReminderService] Pengecekan pengingat selesai.');
    } catch (error) {
      console.error('[ReminderService] Error saat menjalankan pengingat:', error);
    }
  }

  async remindCustomersForService() {
    // Cari tiket status Completed, belum Picked_Up
    const tickets = await ServiceTicket.find({
      status: 'Completed',
      'timestamps.completed_at': { $exists: true }
    });

    for (const ticket of tickets) {
      const now = new Date();
      const completedAt = new Date(ticket.timestamps.completed_at);
      const lastReminder = ticket.timestamps.last_customer_reminder_at 
        ? new Date(ticket.timestamps.last_customer_reminder_at) 
        : null;

      // Cek apakah sudah 24 jam sejak selesai
      const hoursSinceCompleted = (now - completedAt) / (1000 * 60 * 60);
      
      // Jika sudah 24 jam sejak selesai DAN (belum pernah diingatkan ATAU sudah 24 jam sejak pengingat terakhir)
      if (hoursSinceCompleted >= 24) {
        const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;
        
        if (hoursSinceLastReminder >= 24) {
          console.log(`[ReminderService] Mengirim pengingat customer untuk tiket: ${ticket.ticket_number}`);
          await whatsappService.sendCustomerPickupReminder(ticket);
          
          ticket.timestamps.last_customer_reminder_at = now;
          await ticket.save();
        }
      }
    }
  }

  async remindCustomersForOrders() {
    // Cari order status Arrived, belum Picked_Up
    const orders = await SpecialOrder.find({
      status: 'Arrived',
      'timestamps.arrived_at': { $exists: true }
    });

    for (const order of orders) {
      const now = new Date();
      const arrivedAt = new Date(order.timestamps.arrived_at);
      const lastReminder = order.timestamps.last_customer_reminder_at 
        ? new Date(order.timestamps.last_customer_reminder_at) 
        : null;

      const hoursSinceArrived = (now - arrivedAt) / (1000 * 60 * 60);
      
      if (hoursSinceArrived >= 24) {
        const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;
        
        if (hoursSinceLastReminder >= 24) {
          console.log(`[ReminderService] Mengirim pengingat customer untuk order: ${order.order_number}`);
          await whatsappService.sendOrderPickupReminder(order);
          
          order.timestamps.last_customer_reminder_at = now;
          await order.save();
        }
      }
    }
  }

  async remindTechnicians() {
    // Cari tiket status Queue, Diagnosing, In_Progress
    const tickets = await ServiceTicket.find({
      status: { $in: ['Queue', 'Diagnosing', 'In_Progress'] }
    });

    for (const ticket of tickets) {
      const now = new Date();
      const createdAt = new Date(ticket.timestamps.created_at);
      const lastReminder = ticket.timestamps.last_technician_reminder_at 
        ? new Date(ticket.timestamps.last_technician_reminder_at) 
        : null;

      const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
      
      // Jika sudah 12 jam sejak dibuat DAN (belum pernah diingatkan ATAU sudah 12 jam sejak pengingat terakhir)
      if (hoursSinceCreated >= 12) {
        const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;
        
        if (hoursSinceLastReminder >= 12) {
          // Cari user teknisi untuk mendapatkan nomor HP
          const techUser = await User.findById(ticket.technician.id);
          if (techUser && techUser.phone) {
            console.log(`[ReminderService] Mengirim pengingat teknisi (${techUser.name}) untuk tiket: ${ticket.ticket_number}`);
            await whatsappService.sendTechnicianTaskReminder(techUser, ticket);
            
            ticket.timestamps.last_technician_reminder_at = now;
            await ticket.save();
          }
        }
      }
    }
  }
}

module.exports = new ReminderService();