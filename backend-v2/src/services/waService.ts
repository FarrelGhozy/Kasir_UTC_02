// WhatsApp (WAHA) service v2 — #102: migrasi dari whatsappService.js v1.
// Wrapper WAHA (instance URL + token dari env — JANGAN hardcode), status session,
// check nomor, kirim pesan, notify status servis.
import { config } from "../config/env";

function biz(msg: string, status = 400): Error {
  const e = new Error(`[BIZ] ${msg}`) as Error & { status: number };
  e.status = status;
  return e;
}

/** Normalisasi nomor HP → format WAHA: 08xx → 628xx@c.us */
export function normalizePhone(phone: string | number): string {
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  return p.includes("@") ? p : `${p}@c.us`;
}

function waHeaders() {
  if (!config.WAHA_API_KEY) throw biz("WAHA_API_KEY belum di-set di env", 503);
  return { "X-Api-Key": config.WAHA_API_KEY, "Content-Type": "application/json" };
}

async function waFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${config.WAHA_URL}${path}`;
  return fetch(url, { ...init, headers: { ...waHeaders(), ...(init?.headers ?? {}) } });
}

/** Status session WAHA (sama pola v1): WORKING/SCAN_QR/STARTING/FAILED/STOPPED/UNREACHABLE */
export async function checkSessionStatus() {
  const session = process.env.WAHA_SESSION || "default";
  try {
    const res = await waFetch(`/api/sessions/${session}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return { status: "DISCONNECTED", error: `WAHA HTTP ${res.status}` };
    }
    const data: any = await res.json();
    return data;
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND") {
      return { status: "UNREACHABLE", error: `WAHA tidak terjangkau (${e.code ?? "timeout"})` };
    }
    return { status: "DISCONNECTED", error: e?.message ?? "unknown" };
  }
}

/** Cek apakah nomor terdaftar di WhatsApp (pola v1 checkExists). */
export async function checkExists(phone: string | number) {
  const clean = normalizePhone(phone).replace(/@c\.us$/, "");
  try {
    const res = await waFetch("/api/contacts/check-exists", {
      method: "POST",
      body: JSON.stringify({ phone: clean, session: process.env.WAHA_SESSION || "default" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { exists: false, error: `WAHA HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { exists: false, error: e?.message ?? "unknown" };
  }
}

/** Kirim pesan teks via WAHA. */
export async function sendMessage(phone: string | number, text: string) {
  const chatId = normalizePhone(phone);
  try {
    const res = await waFetch("/api/sendText", {
      method: "POST",
      body: JSON.stringify({ chatId, text, session: process.env.WAHA_SESSION || "default" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      return { success: false, error: err?.message ?? `WAHA HTTP ${res.status}`, status: res.status };
    }
    return { success: true, data: await res.json() };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "unknown" };
  }
}

/** Kirim dokumen (PDF nota) via WAHA sendFile. */
export async function sendDocument(phone: string | number, fileUrl: string, caption?: string) {
  const chatId = normalizePhone(phone);
  try {
    const res = await waFetch("/api/sendFile", {
      method: "POST",
      body: JSON.stringify({
        chatId,
        file: { url: fileUrl },
        caption: caption ?? "",
        session: process.env.WAHA_SESSION || "default",
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      return { success: false, error: err?.message ?? `WAHA HTTP ${res.status}`, status: res.status };
    }
    return { success: true, data: await res.json() };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "unknown" };
  }
}

const STATUS_LABEL: Record<string, string> = {
  Queue: "Dalam Antrian",
  Diagnosing: "Sedang Tahap Diagnosa",
  Waiting_Part: "Menunggu Suku Cadang",
  In_Progress: "Sedang Dikerjakan oleh Teknisi",
  Completed: "Selesai & Siap Diambil",
  Cancelled: "Dibatalkan",
  Picked_Up: "Sudah Diambil",
};

/** Bangun pesan update status servis (pola v1 notifyServiceStatus). */
export function buildServiceStatusMessage(ticket: {
  customerName?: string | null;
  device?: any;
  ticketNumber: string;
  status: string;
  serviceFee?: number;
  parts?: { name: string; qty: number; subtotal: number }[];
}) {
  const label = STATUS_LABEL[ticket.status] ?? ticket.status;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
  const dev = ticket.device ?? {};
  const deviceStr = [dev.type, dev.brand, dev.model].filter(Boolean).join(" ") || "Perangkat";

  let msg = `*UNIDA TECHNOLOGY CENTRE - UPDATE SERVIS*\n\n`;
  msg += `Halo Kak *${ticket.customerName ?? "Pelanggan"}*, apa kabarnya? Semoga sehat selalu 😊\n\n`;
  msg += `Kami ingin menginformasikan update terbaru untuk perbaikan perangkat Anda:\n`;
  msg += `📦 *${deviceStr}*\n`;
  msg += `🎫 No. Tiket: #${ticket.ticketNumber}\n\n`;
  msg += `Status saat ini: ✅ *${label}*\n\n`;

  if (ticket.status === "Completed") {
    const partCost = (ticket.parts ?? []).reduce((s, p) => s + p.subtotal, 0);
    const totalCost = (ticket.serviceFee ?? 0) + partCost;
    msg += `*RINCIAN BIAYA:*\n`;
    msg += `• Jasa Servis: ${fmt(ticket.serviceFee ?? 0)}\n`;
    if (partCost > 0) {
      msg += `• Sparepart:\n`;
      ticket.parts!.forEach((p) => {
        msg += `  - ${p.name} (x${p.qty}): ${fmt(p.subtotal)}\n`;
      });
      msg += `• Total Sparepart: ${fmt(partCost)}\n`;
    }
    msg += `--------------------------\n`;
    msg += `*TOTAL AKHIR: ${fmt(totalCost)}*\n\n`;
    msg += `Silakan Kakak berkunjung kembali ke toko kami untuk pengambilan perangkat. Jangan lupa membawa nota ini ya!`;
  }
  return msg;
}

/** Kirim update status servis ke customer (notify/resend). */
export async function notifyServiceStatus(ticket: {
  id: number;
  customerName?: string | null;
  customerPhone?: string | null;
  device?: any;
  ticketNumber: string;
  status: string;
  serviceFee?: number;
  parts?: { name: string; qty: number; subtotal: number }[];
}) {
  if (!ticket.customerPhone) throw biz("Nomor HP pelanggan tidak tersedia");
  const text = buildServiceStatusMessage(ticket);
  return sendMessage(ticket.customerPhone, text);
}