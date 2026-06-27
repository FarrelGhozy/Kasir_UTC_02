const cron = require('node-cron');
const ServiceTicket = require('../models/ServiceTicket');
const SpecialOrder = require('../models/SpecialOrder');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const SystemLog = require('../models/SystemLog');

class ReminderService {
  constructor() {
    this.server_started_at = new Date();
  }

  init() {
    // Cron untuk pengingat pelanggan (setiap jam 08:00-15:00 WIB, skip Jumat)
    cron.schedule('0 8-15 * * *', async () => {
      const day = new Date().getDay();
      if (day === 5) return;

      console.log('[ReminderService] Cron pelanggan: memulai pengecekan...');
      try {
        await this.remindCustomersForService();
        await this.remindCustomersForOrders();
        console.log('[ReminderService] Cron pelanggan selesai.');
      } catch (error) {
        console.error('[ReminderService] Error cron pelanggan:', error);
      }
    }, { timezone: 'Asia/Jakarta' });

    // Cron untuk pengingat teknisi (jam 08:00 & 13:00 WIB, skip Jumat)
    cron.schedule('0 8,13 * * *', async () => {
      const day = new Date().getDay();
      if (day === 5) return;

      console.log('[ReminderService] Cron teknisi (WIB): memulai pengecekan...');
      try {
        await this.remindTechnicians();
        console.log('[ReminderService] Cron teknisi selesai.');
      } catch (error) {
        console.error('[ReminderService] Error cron teknisi:', error);
      }
    }, { timezone: 'Asia/Jakarta' });
  }

  async remindCustomersForService() {
    const BATCH_SIZE = 50;
    let lastId = null;
    let hasMore = true;

    while (hasMore) {
      const query = {
        status: 'Completed',
        'history.completed_at': { $exists: true }
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const tickets = await ServiceTicket.find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (tickets.length === 0) {
        hasMore = false;
        break;
      }

      for (const ticket of tickets) {
        const now = new Date();
        const completedAt = new Date(ticket.history.completed_at);

        // Skip tiket yang selesai sebelum server start (hindari spam restart)
        if (completedAt < this.server_started_at) continue;

        const lastReminder = ticket.history.last_customer_reminder_at
          ? new Date(ticket.history.last_customer_reminder_at)
          : null;

        const hoursSinceCompleted = (now - completedAt) / (1000 * 60 * 60);

        if (hoursSinceCompleted >= 24) {
          const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;

          if (hoursSinceLastReminder >= 24) {
            console.log(`[ReminderService] Mengirim pengingat customer untuk tiket: ${ticket.ticket_number}`);
            const result = await whatsappService.sendCustomerPickupReminder(ticket);

            if (result && result.success) {
              await ServiceTicket.updateOne(
                { _id: ticket._id },
                { $set: { 'history.last_customer_reminder_at': now } }
              );
            } else {
              console.warn(`[ReminderService] Gagal mengirim pengingat customer untuk tiket ${ticket.ticket_number}`);
              await SystemLog.create({
                level: 'WARN',
                source: 'ReminderService',
                message: `Gagal kirim pengingat customer untuk tiket ${ticket.ticket_number}`,
                details: { ticket_number: ticket.ticket_number, error: result?.error || 'Unknown error' }
              });
            }
          }
        }
      }

      lastId = tickets[tickets.length - 1]._id;
    }
  }

  async remindCustomersForOrders() {
    const BATCH_SIZE = 50;
    let lastId = null;
    let hasMore = true;

    while (hasMore) {
      const query = {
        status: 'Arrived',
        'history.arrived_at': { $exists: true }
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const orders = await SpecialOrder.find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      for (const order of orders) {
        const now = new Date();
        const arrivedAt = new Date(order.history.arrived_at);

        // Skip order yang arrived sebelum server start (hindari spam restart)
        if (arrivedAt < this.server_started_at) continue;

        const lastReminder = order.history.last_customer_reminder_at
          ? new Date(order.history.last_customer_reminder_at)
          : null;

        const hoursSinceArrived = (now - arrivedAt) / (1000 * 60 * 60);

        if (hoursSinceArrived >= 24) {
          const hoursSinceLastReminder = lastReminder ? (now - lastReminder) / (1000 * 60 * 60) : 999;

          if (hoursSinceLastReminder >= 24) {
            console.log(`[ReminderService] Mengirim pengingat customer untuk order: ${order.order_number}`);
            const result = await whatsappService.sendOrderPickupReminder(order);

            if (result && result.success) {
              await SpecialOrder.updateOne(
                { _id: order._id },
                { $set: { 'history.last_customer_reminder_at': now } }
              );
            } else {
              console.warn(`[ReminderService] Gagal mengirim pengingat customer untuk order ${order.order_number}`);
              await SystemLog.create({
                level: 'WARN',
                source: 'ReminderService',
                message: `Gagal kirim pengingat customer untuk order ${order.order_number}`,
                details: { order_number: order.order_number, error: result?.error || 'Unknown error' }
              });
            }
          }
        }
      }

      lastId = orders[orders.length - 1]._id;
    }
  }

  async remindTechnicians() {
    const BATCH_SIZE = 50;
    let lastId = null;
    let hasMore = true;

    while (hasMore) {
      const query = {
        status: { $in: ['Queue', 'Diagnosing', 'In_Progress'] }
      };
      if (lastId) {
        query._id = { $gt: lastId };
      }

      const tickets = await ServiceTicket.find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (tickets.length === 0) {
        hasMore = false;
        break;
      }

      for (const ticket of tickets) {
        const now = new Date();
        const createdAt = ticket.history?.created_at ? new Date(ticket.history.created_at) : now;

        // Skip tiket yang dibuat sebelum server start (hindari spam restart)
        if (createdAt < this.server_started_at) continue;

        // Skip jika pengingat sudah dikirim < 12 jam yang lalu
        const lastTechReminder = ticket.history?.last_technician_reminder_at
          ? new Date(ticket.history.last_technician_reminder_at)
          : null;
        if (lastTechReminder) {
          const hoursSinceLastReminder = (now - lastTechReminder) / (1000 * 60 * 60);
          if (hoursSinceLastReminder < 12) continue;
        }

        const technicianId = ticket.technician.id || ticket.technician._id;
        const techUser = await User.findById(technicianId).lean();

        if (techUser && techUser.phone) {
          console.log(`[ReminderService] Mengirim pengingat teknisi (${techUser.name}) untuk tiket: ${ticket.ticket_number}`);
          const result = await whatsappService.sendTechnicianTaskReminder(techUser, ticket);

          if (result && result.success) {
            await ServiceTicket.updateOne(
              { _id: ticket._id },
              { $set: { 'history.last_technician_reminder_at': now } }
            );
          } else {
            console.warn(`[ReminderService] Gagal mengirim pengingat teknisi untuk tiket ${ticket.ticket_number}`);
            await SystemLog.create({
              level: 'WARN',
              source: 'ReminderService',
              message: `Gagal kirim pengingat teknisi untuk tiket ${ticket.ticket_number}`,
              details: { ticket_number: ticket.ticket_number, technician: techUser.name, error: result?.error || 'Unknown error' }
            });
          }
        } else {
          console.warn(`[ReminderService] Tidak bisa mengirim pengingat: Teknisi ${ticket.technician.name} tidak ditemukan atau tidak punya nomor HP. ID: ${technicianId}`);
        }
      }

      lastId = tickets[tickets.length - 1]._id;
    }
  }
}

module.exports = new ReminderService();
