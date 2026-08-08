// Test #110 — WA Bot auto-reply & scheduler reminder.
// 1) matchReply: salam/info/jam/lokasi → balasan sesuai; teks tak dikenal → null.
// 2) isWorkingHours: Senin 10:00 WIB buka; Jumat tutup; malam tutup.
// 3) handleIncomingMessage: WAHA offline → tidak throw; skip fromMe/isGroup/teknisi.
// 4) sendDutyReminder: tanpa jadwal / akhir pekan → sent 0, tidak crash.
import { describe, expect, test } from "bun:test";
import { matchReply, closedMessage, isWorkingHours, handleIncomingMessage, _resetBotCache } from "../src/bot/botService";
import { sendDutyReminder } from "../src/bot/dutyScheduler";
import { sendWeekendReminder } from "../src/bot/weeklyScheduler";

function wibDate(day: number, hour: number): Date {
  // 2026-08-03 = Senin. WIB = UTC+7 → UTC hour = WIB hour - 7.
  const offset = (day - 1 + 7) % 7;
  return new Date(Date.UTC(2026, 7, 3 + offset, hour - 7));
}

describe("WA Bot auto-reply #110", () => {
  test("matchReply: salam → balasan sambutan", () => {
    const r = matchReply("Halo kak, saya mau tanya");
    expect(r).not.toBeNull();
    expect(r).toContain("Unida Technology Centre");
  });

  test("matchReply: info layanan → daftar layanan", () => {
    const r = matchReply("info layanan service apa saja?");
    expect(r).not.toBeNull();
    expect(r).toContain("Service Komputer & Laptop");
    expect(r).toContain("Service Printer");
  });

  test("matchReply: jam operasional", () => {
    const r = matchReply("jam buka sampai jam berapa?");
    expect(r).not.toBeNull();
    expect(r).toContain("08.00");
    expect(r).toContain("15.00");
  });

  test("matchReply: lokasi", () => {
    const r = matchReply("lokasinya di mana kak?");
    expect(r).not.toBeNull();
    expect(r).toContain("Universitas Darussalam Gontor");
  });

  test("matchReply: teks tak dikenal → null", () => {
    expect(matchReply("xzkjqowie")).toBeNull();
  });

  test("isWorkingHours: Senin 10:00 WIB → buka", () => {
    expect(isWorkingHours(wibDate(1, 10)).open).toBe(true);
  });

  test("isWorkingHours: Jumat → tutup (libur mingguan)", () => {
    const s = isWorkingHours(wibDate(5, 10));
    expect(s.open).toBe(false);
    expect(s.reason).toBe("friday");
  });

  test("isWorkingHours: malam (20:00) → tutup", () => {
    const s = isWorkingHours(wibDate(2, 20));
    expect(s.open).toBe(false);
    expect(s.reason).toBe("hours");
  });

  test("closedMessage: alasan berbeda → pesan berbeda", () => {
    expect(closedMessage("friday")).toContain("Jumat");
    expect(closedMessage("hours")).toContain("jam operasional");
  });

  test("handleIncomingMessage: WAHA offline → tidak throw", async () => {
    _resetBotCache();
    await expect(
      handleIncomingMessage({ from: "628123456789@c.us", fromMe: false, isGroup: false, isStatus: false, message: { text: "halo kak" } })
    ).resolves.toBeUndefined();
  });

  test("handleIncomingMessage: skip pesan sendiri & grup", async () => {
    _resetBotCache();
    await expect(handleIncomingMessage({ from: "628123456789@c.us", fromMe: true, isGroup: false, isStatus: false, message: { text: "halo" } })).resolves.toBeUndefined();
    await expect(handleIncomingMessage({ from: "628123456789@g.us", fromMe: false, isGroup: true, isStatus: false, message: { text: "halo" } })).resolves.toBeUndefined();
  });
});

describe("Scheduler reminder #110", () => {
  test("sendDutyReminder: tanpa jadwal → sent 0, tidak crash", async () => {
    const res = await sendDutyReminder("pre");
    expect(res.sent).toBe(0);
  });

  test("sendWeekendReminder: tanpa user aktif ber-phone → sent 0, tidak crash", async () => {
    const res = await sendWeekendReminder("pre", 6);
    expect(res.sent).toBe(0);
  });
});
