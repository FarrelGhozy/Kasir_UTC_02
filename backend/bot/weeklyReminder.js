// bot/weeklyReminder.js - Sistem Reminder Kegiatan Weekend via WhatsApp
const User = require('../models/User');
const { sendReply } = require('./wahaClient');

/**
 * Kirim reminder kegiatan weekend ke semua user aktif
 * @param {string} type - 'pre' (jam 15:00) atau 'now' (jam 20:00)
 * @param {number} dayOfWeek - 6 (Sabtu) atau 0 (Minggu)
 */
async function sendWeekendReminder(type, dayOfWeek) {
  try {
    const users = await User.find({ isActive: true, phone: { $ne: '' } }).lean();

    if (users.length === 0) {
      console.log('[WeekendReminder] Tidak ada user aktif dengan nomor WA.');
      return;
    }

    const dayName = dayOfWeek === 6 ? 'Sabtu' : 'Minggu';
    console.log(`[WeekendReminder] Mengirim reminder ${type} hari ${dayName} ke ${users.length} orang...`);

    for (const user of users) {
      if (!user.phone) continue;

      let message = '';

      if (dayOfWeek === 6) {
        if (type === 'pre') {
          message = `⏰ *PENGINGAT KUMPUL WAJIB & EVALUASI*\n\nHalo Kak ${user.name}! 👋\n\nHari ini malam ada kegiatan rutin:\n📅 Hari: Sabtu\n📍 Acara: Kumpul wajib & evaluasi mingguan\n🕕 Waktu: 20:00 WIB\n\nJangan lupa ya Kak, kita kumpul di bengkel! 💪`;
        } else {
          message = `📍 *WAKTUNYA KUMPUL WAJIB!*\n\nHalo Kak ${user.name}! 👋\n\nSekarang sudah waktunya kumpul wajib dan evaluasi mingguan.\n\nAyo segera ke bengkel! Kerja tim, hasil maksimal! 💪✨`;
        }
      } else if (dayOfWeek === 0) {
        if (type === 'pre') {
          message = `⏰ *PENGINGAT BERSIH-BERSIH BESAR*\n\nHalo Kak ${user.name}! 👋\n\nHari ini malam ada kegiatan rutin:\n📅 Hari: Minggu\n📍 Acara: Bersih-bersih besar besaran\n🕕 Waktu: 20:00 WIB\n\nJangan lupa ya Kak, kita bersih-bersih bengkel bersama! 💪🧹`;
        } else {
          message = `🧹 *WAKTUNYA BERSIH-BERSIH!*\n\nHalo Kak ${user.name}! 👋\n\nSekarang sudah waktunya bersih-bersih besar besaran.\n\nAyo segera dikerjakan! Kerja tim, hasil memuaskan! 💪✨`;
        }
      }

      if (message) {
        try {
          await sendReply(user.phone, message);
          console.log(`[WeekendReminder] ✅ ${type} terkirim ke ${user.name} (${user.phone})`);
        } catch (err) {
          console.error(`[WeekendReminder] ❌ Gagal kirim ke ${user.name}:`, err.message);
        }
      }
    }

    console.log(`[WeekendReminder] Selesai mengirim reminder ${type} untuk hari ${dayName}.`);
  } catch (error) {
    console.error(`[WeekendReminder] Error saat mengirim reminder ${type}:`, error);
  }
}

module.exports = { sendWeekendReminder };
