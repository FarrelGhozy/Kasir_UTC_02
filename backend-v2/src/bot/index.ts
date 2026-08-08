// Scheduler WA bot v2 — #110: start semua cron reminder (guard global).
// Dipanggil sekali saat boot backend; tidak pernah throw (scheduler boleh gagal, server tetap jalan).
import { startDutyReminderCron } from "./dutyScheduler";
import { startWeekendReminderCron } from "./weeklyScheduler";
import { cleanupExpiredTokens } from "../services/authService";

let started = false;

export function startSchedulers(): boolean {
  if (started) {
    console.log("[Scheduler] Sudah berjalan, skip.");
    return false;
  }
  try {
    startDutyReminderCron();
    startWeekendReminderCron();
    // #startup-audit R13: refresh token kedaluwarsa dibersihkan berkala
    // (sebelumnya hanya dibuat & tidak pernah dihapus — tabel menumpuk).
    const cleanupTimer = setInterval(() => {
      cleanupExpiredTokens().catch((e: unknown) =>
        console.error("[Scheduler] cleanupExpiredTokens gagal:", e instanceof Error ? e.message : e)
      );
    }, 6 * 60 * 60 * 1000); // setiap 6 jam
    cleanupTimer.unref?.();
    started = true;
    return true;
  } catch (e: any) {
    console.error("[Scheduler] Gagal start:", e?.message ?? e);
    return false;
  }
}
