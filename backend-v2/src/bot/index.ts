// Scheduler WA bot v2 — #110: start semua cron reminder (guard global).
// Dipanggil sekali saat boot backend; tidak pernah throw (scheduler boleh gagal, server tetap jalan).
import { startDutyReminderCron } from "./dutyScheduler";
import { startWeekendReminderCron } from "./weeklyScheduler";

let started = false;

export function startSchedulers(): boolean {
  if (started) {
    console.log("[Scheduler] Sudah berjalan, skip.");
    return false;
  }
  try {
    startDutyReminderCron();
    startWeekendReminderCron();
    started = true;
    return true;
  } catch (e: any) {
    console.error("[Scheduler] Gagal start:", e?.message ?? e);
    return false;
  }
}
