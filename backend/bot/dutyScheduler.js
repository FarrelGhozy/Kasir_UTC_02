// bot/dutyScheduler.js - Scheduler Cron untuk Reminder Piket Kebersihan
const cron = require('node-cron');
const { sendDutyReminder } = require('./dutyReminder');

let isStarted = false;

/**
 * Mulai scheduler cron untuk reminder piket
 * - Setiap hari jam 16:00 WIB → pre-reminder (Senin-Jumat)
 * - Setiap hari jam 21:30 WIB → on-duty reminder (Senin-Jumat)
 */
function startDutyReminderCron() {
  if (isStarted) {
    console.log('[DutyScheduler] Cron sudah berjalan, skip.');
    return;
  }

  // Pre-reminder: Setiap hari jam 16:00 WIB (Senin-Jumat)
  // Cron format: menit jam hari-bulan bulan hari-minggu
  cron.schedule('0 16 * * 1-5', async () => {
    console.log('[DutyScheduler] ⏰ Menjalankan pre-reminder piket (16:00 WIB)...');
    await sendDutyReminder('pre');
  }, {
    timezone: 'Asia/Jakarta'
  });

  // On-duty reminder: Setiap hari jam 21:30 WIB (Senin-Jumat)
  cron.schedule('30 21 * * 1-5', async () => {
    console.log('[DutyScheduler] 🧹 Menjalankan on-duty reminder piket (21:30 WIB)...');
    await sendDutyReminder('now');
  }, {
    timezone: 'Asia/Jakarta'
  });

  isStarted = true;
  console.log('[DutyScheduler] ✅ Cron reminder piket aktif (Senin-Jumat: 16:00 & 21:30 WIB)');
}

module.exports = { startDutyReminderCron };
