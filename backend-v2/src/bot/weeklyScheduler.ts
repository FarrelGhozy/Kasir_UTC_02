// Weekly/weekend reminder scheduler v2 — #110 (paritas main: weeklyScheduler.js + weeklyReminder.js).
// Cron: Sabtu 15:00 & 20:00 WIB (kumpul wajib), Minggu 15:00 & 20:00 WIB (bersih-bersih).
// Dikirim ke semua user aktif yang punya nomor WA. Aman saat WAHA offline.
import cron from "node-cron";
import { prisma } from "../db";
import { sendMessage } from "../services/waService";

let isStarted = false;

/** Kirim reminder weekend ke semua user aktif. type: 'pre' | 'now'; dayOfWeek: 6 (Sabtu) | 0 (Minggu). */
export async function sendWeekendReminder(type: "pre" | "now", dayOfWeek: 6 | 0): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    const users = await prisma.user.findMany({ where: { isActive: true, phone: { not: "" } }, select: { name: true, phone: true } });
    if (users.length === 0) {
      console.log("[WeekendReminder] Tidak ada user aktif dengan nomor WA.");
      return { sent, skipped };
    }
    const dayName = dayOfWeek === 6 ? "Sabtu" : "Minggu";

    for (const u of users) {
      let message = "";
      if (dayOfWeek === 6) {
        message =
          type === "pre"
            ? `⏰ *PENGINGAT KUMPUL WAJIB & EVALUASI*\n\nHalo Kak ${u.name}! 👋\n\nHari ini malam ada kegiatan rutin:\n📅 Hari: Sabtu\n📍 Acara: Kumpul wajib & evaluasi mingguan\n🕕 Waktu: 20:00 WIB\n\nJangan lupa ya Kak, kita kumpul di bengkel! 💪`
            : `🔥 *KUMPUL WAJIB SEKARANG!*\n\nHalo Kak ${u.name}! 👋\n\nSudah waktunya *Kumpul wajib & evaluasi mingguan* (20:00 WIB).\nMohon segera berkumpul di bengkel. Terima kasih! 🙏`;
      } else {
        message =
          type === "pre"
            ? `🧹 *PENGINGAT BERSIH-BERSIH MINGGUAN*\n\nHalo Kak ${u.name}! 👋\n\nHari ini ada kegiatan rutin:\n📅 Hari: Minggu\n📍 Acara: Bersih-bersih bengkel & area kerja\n🕕 Waktu: 20:00 WIB\n\nMohon partisipasinya ya Kak! 💪`
            : `🧹 *BERSIH-BERSIH SEKARANG!*\n\nHalo Kak ${u.name}! 👋\n\nSudah waktunya *bersih-bersih mingguan* (20:00 WIB).\nMohon segera berkumpul. Terima kasih! 🙏`;
      }
      const res = await sendMessage(u.phone, message);
      if (res.success) {
        sent++;
        console.log(`[WeekendReminder] ✅ ${type} ${dayName} terkirim ke ${u.name}`);
      } else {
        skipped++;
        console.log(`[WeekendReminder] ⚠️ Gagal kirim ke ${u.name}: ${res.error}`);
      }
    }
  } catch (e: any) {
    console.error("[WeekendReminder] Error:", e?.message ?? e);
  }
  return { sent, skipped };
}

/** Start cron reminder weekend (guard isStarted). */
export function startWeekendReminderCron(): boolean {
  if (isStarted) {
    console.log("[WeeklyScheduler] Cron sudah berjalan, skip.");
    return false;
  }
  cron.schedule("0 15 * * 6", () => { void sendWeekendReminder("pre", 6); }, { timezone: "Asia/Jakarta" });
  cron.schedule("0 20 * * 6", () => { void sendWeekendReminder("now", 6); }, { timezone: "Asia/Jakarta" });
  cron.schedule("0 15 * * 0", () => { void sendWeekendReminder("pre", 0); }, { timezone: "Asia/Jakarta" });
  cron.schedule("0 20 * * 0", () => { void sendWeekendReminder("now", 0); }, { timezone: "Asia/Jakarta" });
  isStarted = true;
  console.log("[WeeklyScheduler] ✅ Cron reminder weekend aktif (Sabtu & Minggu 15:00/20:00 WIB)");
  return true;
}
