// Duty schedule service v2 — #100: jadwal piket kebersihan.
// Migrasi dari v1 (Mongo dutyScheduleController.js). Konvensi v2: biz(), RBAC di handler,
// include relasi user via select (hormati privacy — jangan include password_hash).
import { prisma } from "../db";
import { wibDayIndex } from "../lib/wib";
import type { Day } from "@prisma/client";

function biz(msg: string): Error {
  return new Error(`[BIZ] ${msg}`);
}

const DAYS: Day[] = ["senin", "selasa", "rabu", "kamis", "jumat"];

export function parseDay(raw?: string): Day {
  if (!raw) throw biz("Hari wajib diisi");
  const d = raw.trim().toLowerCase() as Day;
  if (!DAYS.includes(d)) throw biz("Hari tidak valid. Gunakan: senin, selasa, rabu, kamis, jumat");
  return d;
}

export const DAY_LABELS: Record<Day, string> = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
};

/** Select user untuk jadwal — IRT: tanpa password_hash. */
const userSelect = {
  select: { id: true, name: true, username: true, phone: true, jabatan: true },
};

/** Seragamkan bentuk output: id, user {…}, day, day_label, createdAt. */
function shape(s: {
  id: number;
  day: Day;
  createdAt: Date;
  user: { id: number; name: string; username: string; phone: string; jabatan: string | null };
}) {
  return {
    id: s.id,
    day: s.day,
    day_label: DAY_LABELS[s.day],
    createdAt: s.createdAt.toISOString(),
    user: s.user,
  };
}

/** GET all (admin) — sort by day urut (senin..jumat). */
export async function listSchedules() {
  const list = await prisma.dutySchedule.findMany({
    include: { user: userSelect },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
  });
  return { success: true, data: list.map(shape) };
}

/** GET by day (admin). */
export async function listByDay(dayRaw: string) {
  const day = parseDay(dayRaw);
  const list = await prisma.dutySchedule.findMany({
    where: { day },
    include: { user: userSelect },
    orderBy: { createdAt: "asc" },
  });
  return { success: true, message: `Jadwal piket hari ${DAY_LABELS[day]}`, data: list.map(shape) };
}

/** GET my (all roles) — jadwal milik user login. */
export async function listMySchedule(userId: number) {
  const list = await prisma.dutySchedule.findMany({
    where: { userId },
    include: { user: userSelect },
    orderBy: { day: "asc" },
  });
  return {
    success: true,
    message: list.length > 0 ? "Jadwal piket Anda" : "Anda tidak memiliki jadwal piket",
    data: list.map(shape),
  };
}

/** GET today (all roles) — senin..jumat pakai WIB, Sabtu/Minggu kosong. */
export async function listTodaySchedule() {
  const dayIndex = wibDayIndex(); // #90 H11: hitung dari WIB eksplisit, bukan TZ proses
  const map: Record<number, Day> = { 1: "senin", 2: "selasa", 3: "rabu", 4: "kamis", 5: "jumat" };
  const today = map[dayIndex];
  if (!today) {
    return { success: true, message: "Hari ini tidak ada jadwal piket (Sabtu/Minggu)", data: [] };
  }
  const list = await prisma.dutySchedule.findMany({
    where: { day: today },
    include: { user: userSelect },
    orderBy: { createdAt: "asc" },
  });
  return { success: true, message: `Jadwal piket hari ${DAY_LABELS[today]}`, data: list.map(shape) };
}

/** POST (admin) — buat. Duplikat user+day di-trplak unique constraint (409 by [BIZ]). */
export async function createSchedule(userId: number, dayRaw: string) {
  if (!userId) throw biz("User wajib diisi");
  const day = parseDay(dayRaw);

  const existing = await prisma.dutySchedule.findUnique({ where: { userId_day: { userId, day } } });
  if (existing) throw biz("User ini sudah memiliki jadwal piket di hari tersebut");

  const s = await prisma.dutySchedule.create({
    data: { userId, day },
    include: { user: userSelect },
  });
  return { success: true, message: "Jadwal piket berhasil dibuat", data: shape(s) };
}

/** PUT (admin) — ganti hari. */
export async function updateSchedule(id: number, dayRaw?: string) {
  const existing = await prisma.dutySchedule.findUnique({ where: { id }, include: { user: userSelect } });
  if (!existing) throw biz("Jadwal piket tidak ditemukan");
  if (!dayRaw) return { success: true, message: "Tidak ada perubahan", data: shape(existing) };

  const day = parseDay(dayRaw);
  if (day !== existing.day) {
    const dup = await prisma.dutySchedule.findUnique({
      where: { userId_day: { userId: existing.userId, day } },
    });
    if (dup) throw biz("User ini sudah memiliki jadwal piket di hari tersebut");
  }

  const s = await prisma.dutySchedule.update({
    where: { id },
    data: { day },
    include: { user: userSelect },
  });
  return { success: true, message: "Jadwal piket berhasil diperbarui", data: shape(s) };
}

/** DELETE (admin). */
export async function deleteSchedule(id: number) {
  const existing = await prisma.dutySchedule.findUnique({ where: { id } });
  if (!existing) throw biz("Jadwal piket tidak ditemukan");
  await prisma.dutySchedule.delete({ where: { id } });
  return { success: true, message: "Jadwal piket berhasil dihapus" };
}