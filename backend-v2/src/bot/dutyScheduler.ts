// Duty reminder scheduler v2 — #110 (paritas main: bot/dutyScheduler.js + dutyReminder.js).
// Cron: Senin–Jumat 16:00 WIB (pre) & 21:30 WIB (on-duty), timezone Asia/Jakarta.
// Pengirim diambil dari tabel DutySchedule hari ini (WIB). Aman saat WAHA offline.
import cron from "node-cron";
import { prisma } from "../db";
import { sendMessage } from "../services/waService";
import { wibDayIndex } from "../lib/wib";

let isStarted = false;

const DAY_BY_INDEX: Record<number, "senin" | "selasa" | "rabu" | "kamis" | "jumat"> = {
  1: "senin",
  2: "selasa",
  3: "rabu",
  4: "kamis",
  5: "jumat",
};

/** Kirim reminder piket ke semua user berjadwal hari ini (WIB). type: 'pre' | 'now'. */
export async function sendDutyReminder(type: "pre" | "now"): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    const day = DAY_BY_INDEX[wibDayIndex()];
    if (!day) {
      console.log("[DutyReminder] Akhir pekan — tidak ada piket.");
      return { sent, skipped };
    }
    const schedules = await prisma.dutySchedule.findMany({
      where: { day },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (schedules.length === 0) {
      console.log(`[DutyReminder] Tidak ada jadwal piket untuk hari ${day}.`);
      return { sent, skipped };
    }

    for (const s of schedules) {
      const u = s.user;
      if (!u.phone) {
        console.log(`[DutyReminder] Skip: ${u.name} tanpa nomor telepon.`);
        skipped++;
        continue;
      }
      const message =
        type === "pre"
          ? `🔔 *Pengingat Piket Kebersihan*\n\nHalo Kak ${u.name},\n\nMohon diingat bahwa hari ini Anda memiliki jadwal piket kebersihan:\n📅 Hari: ${day}\n🕕 Waktu: 21:30 WIB\n\nKami mohon kerja samanya untuk melaksanakan piket tepat waktu. Terima kasih! 🙏`
          : `🧹 *Waktunya Piket Kebersihan*\n\nHalo Kak ${u.name},\n\nSaat ini sudah memasuki waktu piket kebersihan (21:30 WIB).\nMohon segera dilaksanakan piketnya.\n\nTerima kasih atas kerja sama dan kedisiplinannya! 🙏😊`;
      const res = await sendMessage(u.phone, message);
      if (res.success) {
        sent++;
        console.log(`[DutyReminder] ✅ ${type} terkirim ke ${u.name} (${u.phone})`);
      } else {
        skipped++;
        console.log(`[DutyReminder] ⚠️ Gagal kirim ke ${u.name}: ${res.error}`);
      }
    }
  } catch (e: any) {
    console.error("[DutyReminder] Error:", e?.message ?? e);
  }
  return { sent, skipped };
}

/** Start cron reminder piket (guard isStarted). */
export function startDutyReminderCron(): boolean {
  if (isStarted) {
    console.log("[DutyScheduler] Cron sudah berjalan, skip.");
    return false;
  }
  cron.schedule("0 16 * * 1-5", () => { void sendDutyReminder("pre"); }, { timezone: "Asia/Jakarta" });
  cron.schedule("30 21 * * 1-5", () => { void sendDutyReminder("now"); }, { timezone: "Asia/Jakarta" });
  isStarted = true;
  console.log("[DutyScheduler] ✅ Cron reminder piket aktif (Senin–Jumat 16:00 & 21:30 WIB)");
  return true;
}
