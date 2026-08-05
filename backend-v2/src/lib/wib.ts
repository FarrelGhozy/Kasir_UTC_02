// Helpers timezone WIB (Asia/Jakarta, UTC+7) terpusat — #90 M4/M5.
// Tujuan: SEMUA perhitungan "hari ini"/skip libur konsisten WIB, satu sumber kebenaran.
// Tanpa dependency: offset manual UTC+7 (WIB tidak pernah DST).

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Key WIB "YYYY-MM-DD" dari Date (UTC) → pakai offset 7 jam. */
export function toWibKey(utc: Date): string {
  return new Date(utc.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Key WIB hari ini. */
export function todayWibKey(): string {
  return toWibKey(new Date());
}

/** Awal hari WIB utk filter prisma (startOf day WIB → Date UTC). */
export function wibDayStart(day?: Date | string): Date {
  const ref = day ? new Date(day) : new Date();
  const wib = new Date(ref.getTime() + WIB_OFFSET_MS);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - WIB_OFFSET_MS);
}

/** Akhir hari WIB (23:59:59.999). */
export function wibDayEnd(day?: Date | string): Date {
  const ref = day ? new Date(day) : new Date();
  const wib = new Date(ref.getTime() + WIB_OFFSET_MS);
  wib.setUTCHours(23, 59, 59, 999);
  return new Date(wib.getTime() - WIB_OFFSET_MS);
}

/** Pasangan [start, end] hari WIB. */
export function wibDayBounds(day?: Date | string): { start: Date; end: Date } {
  return { start: wibDayStart(day), end: wibDayEnd(day) };
}

/** Hari WIB saat ini (0=Min .. 6=Sab). */
export function wibDayIndex(day?: Date | string): number {
  const ref = day ? new Date(day) : new Date();
  const wib = new Date(ref.getTime() + WIB_OFFSET_MS);
  return wib.getUTCDay();
}

/** Apakah hari WIB = Jumat (libur toko)? */
export function isWibFriday(day?: Date | string): boolean {
  return wibDayIndex(day) === 5;
}