// WA Bot auto-reply v2 — #110 (paritas main: bot/botHandler.js + botConfig.js).
// Alur: webhook WAHA → handleIncomingMessage → cocokkan keyword → balas via waService.
// Semua keluar lewat waService (bukan hardcode URL/token); WAHA offline tidak crash (sendMessage return {success:false}).
import { prisma } from "../db";
import { sendMessage } from "../services/waService";
import { wibDayIndex, WIB_OFFSET } from "../lib/wib";

// ── Konfigurasi bot (paritas main botConfig.js) ─────────────────────────────
export const BOT_CONFIG = {
  BUSINESS_NAME: "Unida Technology Centre",
  SERVICES: [
    "Service Komputer & Laptop",
    "Service Handphone (HP)",
    "Service Printer",
    "Pengadaan Sparepart",
  ],
  OPERATIONAL_HOURS: { OPEN: 8, CLOSE: 15 }, // 08.00–15.00 WIB
  CLOSED_DAY: 5, // 5 = Jumat (0 = Minggu, 6 = Sabtu)
};

// Anti-spam: satu nomor hanya dibalas sekali per 15 menit
const WAIT_THROTTLE_MS = 15 * 60 * 1000;
const lastReplyAt = new Map<string, number>();

// Cache nomor teknisi (refresh 5 menit) — teknisi tidak dikirimi balasan otomatis
let techCache: Set<string> | null = null;
let techCacheAt = 0;
const TECH_CACHE_TTL = 5 * 60 * 1000;

async function getTechnicianPhones(): Promise<Set<string>> {
  const now = Date.now();
  if (techCache && now - techCacheAt < TECH_CACHE_TTL) return techCache;
  const teknisi = await prisma.user.findMany({ where: { role: "teknisi", isActive: true }, select: { phone: true } });
  techCache = new Set(teknisi.map((u) => u.phone).filter(Boolean));
  techCacheAt = now;
  return techCache;
}

/** Waktu operasional dalam WIB (UTC+7). */
export function isWorkingHours(now = new Date()): { open: boolean; reason: "event" | "friday" | "hours" | "open" } {
  const day = wibDayIndex(now);
  const hour = new Date(now.getTime() + WIB_OFFSET).getUTCHours(); // jam WIB (offset tetap)
  if (day === BOT_CONFIG.CLOSED_DAY) return { open: false, reason: "friday" };
  if (hour < BOT_CONFIG.OPERATIONAL_HOURS.OPEN || hour >= BOT_CONFIG.OPERATIONAL_HOURS.CLOSE) return { open: false, reason: "hours" };
  return { open: true, reason: "open" };
}

export function closedMessage(reason: "friday" | "hours"): string {
  if (reason === "friday") return "*PEMBERITAHUAN:* Hari ini adalah hari Jumat, jadwal kami *Libur Mingguan*. 🕌\n\nSilakan kembali menghubungi kami di hari kerja berikutnya. Terima kasih!";
  return "*PEMBERITAHUAN:* Kakak menghubungi kami di luar jam operasional. 🌙\n\nJam operasional kami: *08.00 – 15.00 WIB* (Senin–Kamis & Sabtu).\nKami akan segera membalas saat buka. Terima kasih!";
}

const GREETING_WORDS = ["halo", "hai", "hi", "hello", "assalamualaikum", "assalamu'alaikum", "selamat pagi", "selamat siang", "selamat sore", "selamat malam", "pagi", "siang", "sore", "malam", "permisi", "min", "kak"];
const INFO_WORDS = ["info", "layanan", "service", "harga", "tarif", "jasa", "sparepart", "pengadaan", "cara"];
const HOURS_WORDS = ["jam", "buka", "tutup", "operasional", "libur"];
const LOCATION_WORDS = ["lokasi", "alamat", "dimana", "di mana", "tempat", "kampus"];

export function matchReply(text: string): string | null {
  const t = text.toLowerCase();
  // jam operasional / lokasi dicek dulu (lebih spesifik)
  if (LOCATION_WORDS.some((w) => t.includes(w))) {
    return `📍 *Lokasi ${BOT_CONFIG.BUSINESS_NAME}*\n\nKami berada di area *Universitas Darussalam Gontor* (Unida Gontor).\nSilakan hubungi admin untuk detail titik lokasi. Terima kasih! 🙏`;
  }
  if (HOURS_WORDS.some((w) => t.includes(w))) {
    return `🕗 *Jam Operasional ${BOT_CONFIG.BUSINESS_NAME}*\n\n${String(BOT_CONFIG.OPERATIONAL_HOURS.OPEN).padStart(2, "0")}.00 – ${String(BOT_CONFIG.OPERATIONAL_HOURS.CLOSE).padStart(2, "0")}.00 WIB\nSenin–Kamis & Sabtu (Jumat libur).`;
  }
  if (INFO_WORDS.some((w) => t.includes(w))) {
    return `ℹ️ *Layanan ${BOT_CONFIG.BUSINESS_NAME}*\n\n${BOT_CONFIG.SERVICES.map((s) => `• ${s}`).join("\n")}\n\nUntuk info harga & estimasi, silakan chat admin atau datang langsung ke tempat kami. 😊`;
  }
  if (GREETING_WORDS.some((w) => t.includes(w))) {
    return `Halo Kak! 👋 Selamat datang di *${BOT_CONFIG.BUSINESS_NAME}*.\n\nKami melayani:\n${BOT_CONFIG.SERVICES.map((s) => `• ${s}`).join("\n")}\n\nAda yang bisa kami bantu? Ketik *"info"* untuk detail layanan, atau *"jam"* untuk jam operasional. 😊`;
  }
  return null;
}

/** Handler utama event message masuk dari WAHA. Aman dipanggil async; tidak pernah throw. */
export async function handleIncomingMessage(payload: any): Promise<void> {
  try {
    const { from, fromMe, isGroup, isStatus } = payload ?? {};
    if (!from || fromMe || isGroup || isStatus || String(from).includes("@g.us")) return;

    // Skip nomor teknisi (staf internal tidak dapat balasan otomatis)
    const senderPhone = String(from).replace("@c.us", "").replace("@s.whatsapp.net", "");
    const techPhones = await getTechnicianPhones();
    if (techPhones.has(senderPhone)) {
      console.log(`[WA-Bot] Teknisi ${senderPhone} — dilewati (staf internal)`);
      return;
    }

    // Throttle: jangan spam balasan ke nomor yang sama
    const last = lastReplyAt.get(from) ?? 0;
    if (Date.now() - last < WAIT_THROTTLE_MS) return;
    lastReplyAt.set(from, Date.now());

    const text = String(payload?.message?.text ?? payload?.body ?? "").trim();
    if (!text) return;

    // Di luar jam operasional → pemberitahuan tutup (kecuali keyword jam/lokasi)
    const hours = isWorkingHours();
    if (!hours.open && !LOCATION_WORDS.some((w) => text.toLowerCase().includes(w)) && !HOURS_WORDS.some((w) => text.toLowerCase().includes(w))) {
      const res = await sendMessage(from, closedMessage(hours.reason === "friday" ? "friday" : "hours"));
      console.log(`[WA-Bot] Tutup → ${from} (${res.success ? "terkirim" : "WAHA offline"})`);
      return;
    }

    const reply = matchReply(text);
    if (reply) {
      const res = await sendMessage(from, reply);
      console.log(`[WA-Bot] Balas ${from}: "${text.slice(0, 40)}" → ${res.success ? "OK" : res.error}`);
    }
  } catch (e: any) {
    // Bot tidak boleh crash meski ada error (mis. DB down)
    console.error("[WA-Bot] Error handler:", e?.message ?? e);
  }
}

/** Utility untuk test: reset throttle cache. */
export function _resetBotCache(): void {
  lastReplyAt.clear();
  techCache = null;
}
