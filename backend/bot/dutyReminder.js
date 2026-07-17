// bot/dutyReminder.js - Sistem Reminder Piket Kebersihan via WhatsApp
const DutySchedule = require('../models/DutySchedule');
const { sendReply } = require('./wahaClient');

const DAY_LABELS = {
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat'
};

function getDayName(dayIndex) {
  const dayMap = {
    1: 'senin',
    2: 'selasa',
    3: 'rabu',
    4: 'kamis',
    5: 'jumat'
  };
  return dayMap[dayIndex] || null;
}

/**
 * Kirim reminder piket ke semua user yang memiliki jadwal hari ini
 * @param {string} type - 'pre' (jam 16:00) atau 'now' (jam 21:30)
 */
async function sendDutyReminder(type) {
  try {
    const now = new Date();
    const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const dayIndex = wibTime.getDay();

    if (dayIndex < 1 || dayIndex > 5) {
      console.log(`[DutyReminder] Hari ini akhir pekan, tidak ada piket.`);
      return;
    }

    const todayDay = getDayName(dayIndex);
    if (!todayDay) return;

    const schedules = await DutySchedule.find({ day: todayDay })
      .populate('user', 'name username phone')
      .lean();

    if (schedules.length === 0) {
      console.log(`[DutyReminder] Tidak ada jadwal piket untuk hari ${DAY_LABELS[todayDay]}.`);
      return;
    }

    console.log(`[DutyReminder] Mengirim reminder ${type} untuk ${schedules.length} orang di hari ${DAY_LABELS[todayDay]}...`);

    const dayLabel = DAY_LABELS[todayDay];

    for (const schedule of schedules) {
      const user = schedule.user;
      if (!user || !user.phone) {
        console.log(`[DutyReminder] Skip: user ${user?.name || 'unknown'} tidak punya nomor telepon.`);
        continue;
      }

      let message = '';

      if (type === 'pre') {
        message = `🔔 *Pengingat Piket Kebersihan*\n\nHalo Kak ${user.name},\n\nMohon diingat bahwa hari ini Anda memiliki jadwal piket kebersihan:\n📅 Hari: ${dayLabel}\n🕕 Waktu: 21:30 WIB\n\nKami mohon kerja samanya untuk melaksanakan piket tepat waktu. Terima kasih! 🙏`;
      } else if (type === 'now') {
        message = `🧹 *Waktunya Piket Kebersihan*\n\nHalo Kak ${user.name},\n\nSaat ini sudah memasuki waktu piket kebersihan (21:30 WIB).\nMohon segera dilaksanakan piketnya.\n\nTerima kasih atas kerja sama dan kedisiplinannya! 🙏😊`;
      }

      if (message) {
        try {
          await sendReply(user.phone, message);
          console.log(`[DutyReminder] ✅ Reminder ${type} terkirim ke ${user.name} (${user.phone})`);
        } catch (err) {
          console.error(`[DutyReminder] ❌ Gagal kirim reminder ke ${user.name}:`, err.message);
        }
      }
    }

    console.log(`[DutyReminder] Selesai mengirim reminder ${type} untuk hari ${DAY_LABELS[todayDay]}.`);
  } catch (error) {
    console.error(`[DutyReminder] Error saat mengirim reminder ${type}:`, error);
  }
}

module.exports = { sendDutyReminder };
