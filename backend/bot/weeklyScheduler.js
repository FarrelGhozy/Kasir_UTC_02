// bot/weeklyScheduler.js - Scheduler Cron untuk Reminder Weekend
const cron = require('node-cron');
const { sendWeekendReminder } = require('./weeklyReminder');

let isStarted = false;

/**
 * Mulai scheduler cron untuk reminder weekend
 * - Sabtu 15:00 WIB → pre-reminder kumpul wajib
 * - Sabtu 20:00 WIB → on-duty reminder kumpul wajib
 * - Minggu 15:00 WIB → pre-reminder bersih-bersih
 * - Minggu 20:00 WIB → on-duty reminder bersih-bersih
 */
function startWeekendReminderCron() {
  if (isStarted) {
    console.log('[WeeklyScheduler] Cron sudah berjalan, skip.');
    return;
  }

  // Sabtu 15:00 - Pre-reminder kumpul wajib
  cron.schedule('0 15 * * 6', async () => {
    console.log('[WeeklyScheduler] ⏰ Pre-reminder kumpul wajib Sabtu (15:00 WIB)...');
    await sendWeekendReminder('pre', 6);
  }, {
    timezone: 'Asia/Jakarta'
  });

  // Sabtu 20:00 - On-duty kumpul wajib
  cron.schedule('0 20 * * 6', async () => {
    console.log('[WeeklyScheduler] 📍 On-duty kumpul wajib Sabtu (20:00 WIB)...');
    await sendWeekendReminder('now', 6);
  }, {
    timezone: 'Asia/Jakarta'
  });

  // Minggu 15:00 - Pre-reminder bersih-bersih
  cron.schedule('0 15 * * 0', async () => {
    console.log('[WeeklyScheduler] ⏰ Pre-reminder bersih-bersih Minggu (15:00 WIB)...');
    await sendWeekendReminder('pre', 0);
  }, {
    timezone: 'Asia/Jakarta'
  });

  // Minggu 20:00 - On-duty bersih-bersih
  cron.schedule('0 20 * * 0', async () => {
    console.log('[WeeklyScheduler] 🧹 On-duty bersih-bersih Minggu (20:00 WIB)...');
    await sendWeekendReminder('now', 0);
  }, {
    timezone: 'Asia/Jakarta'
  });

  isStarted = true;
  console.log('[WeeklyScheduler] ✅ Cron reminder weekend aktif (Sabtu & Minggu: 15:00 & 20:00 WIB)');
}

module.exports = { startWeekendReminderCron };
