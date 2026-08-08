// Email service v2 — #103: migrasi emailService.js v1 (Nodemailer) ke Bun/TS.
// Kirim nota servis via email saat status Completed. Gagal kirim TIDAK boleh
// menggagalkan transaksi utama — selalu catch & log ke SystemLog.
import nodemailer from "nodemailer";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config/env";

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function rupiah(n: number | string | bigint | null | undefined): string {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

/** Cek apakah SMTP dikonfigurasi. Email di-skip (dengan log) bila belum. */
export function isEmailConfigured(): boolean {
  return Boolean(config.EMAIL_USER && config.EMAIL_PASS);
}

async function logEmail(level: "WARN" | "ERROR", message: string, details: Record<string, unknown>) {
  try {
    await prisma.systemLog.create({
      data: { level, source: "EmailService", message, details: details as Prisma.InputJsonValue },
    });
  } catch {
    // jangan pernah throw dari logger
  }
}

async function sendMailWithRetry(mailOptions: nodemailer.SendMailOptions, maxRetries = 3): Promise<boolean> {
  if (!isEmailConfigured()) {
    await logEmail("WARN", "Email tidak dikirim: EMAIL_USER/EMAIL_PASS belum di-set", {});
    return false;
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS },
  });
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delayMs = 2 ** (attempt - 1) * 1000;
      console.warn(`[Email] Gagal kirim (percobaan ${attempt}/${maxRetries}), retry dalam ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

export interface TicketForEmail {
  ticketNumber: string;
  device?: { brand?: string; model?: string; type?: string } | null;
  serviceFee: number | string | bigint;
  totalCost: number | string | bigint;
  status?: string;
  customer?: { name?: string; email?: string | null } | null;
  parts?: Array<{ name?: string | null; qty: number; subtotal?: number | string | bigint }>;
}

/** Kirim nota servis via email (fire-and-forget, tidak pernah throw). */
export async function sendServiceNotaEmail(ticket: TicketForEmail): Promise<boolean> {
  const email = ticket.customer?.email;
  if (!email) {
    await logEmail("WARN", "Email tidak dikirim: pelanggan tidak punya alamat email", {
      ticket_id: ticket.ticketNumber,
      customer: ticket.customer?.name ?? "-",
    });
    return false;
  }
  try {
    const parts = (ticket.parts ?? []).map(
      (p) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(p.name)} (x${p.qty})</td>
          <td style="text-align:right;padding:8px;border-bottom:1px solid #eee;">${rupiah(p.subtotal)}</td>
        </tr>`
    ).join("");
    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;">
        <h2 style="text-align:center;color:#0d6efd;">Nota Servis Bengkel UTC</h2>
        <hr>
        <p>Halo <strong>${escapeHtml(ticket.customer?.name)}</strong>,</p>
        <p>Perbaikan perangkat Anda telah selesai. Berikut ringkasan servis Anda:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:5px 0;"><strong>No. Tiket:</strong></td><td>#${escapeHtml(ticket.ticketNumber)}</td></tr>
          <tr><td style="padding:5px 0;"><strong>Perangkat:</strong></td><td>${escapeHtml(ticket.device?.brand ?? "")} ${escapeHtml(ticket.device?.model ?? "")}</td></tr>
          <tr><td style="padding:5px 0;"><strong>Status:</strong></td><td>Selesai (Completed)</td></tr>
        </table>
        <h3 style="margin-top:20px;">Rincian Biaya:</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f8f9fa;">
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Deskripsi</th>
            <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Total</th>
          </tr></thead>
          <tbody>
            ${parts}
            <tr><td style="padding:8px;font-weight:bold;">Biaya Jasa</td>
            <td style="text-align:right;padding:8px;font-weight:bold;">${rupiah(ticket.serviceFee)}</td></tr>
          </tbody>
          <tfoot><tr style="background:#e9ecef;">
            <td style="padding:10px;font-weight:bold;font-size:1.1em;">Grand Total</td>
            <td style="text-align:right;padding:10px;font-weight:bold;font-size:1.1em;">${rupiah(ticket.totalCost)}</td>
          </tr></tfoot>
        </table>
        <div style="margin-top:30px;text-align:center;font-size:0.9em;color:#666;">
          <p>Terima kasih telah mempercayakan perbaikan perangkat Anda kepada kami.</p>
          <p><strong>Bengkel UTC - Unida Technology Centre</strong></p>
        </div>
      </div>`;
    const sent = await sendMailWithRetry({
      from: `"Bengkel UTC" <${config.EMAIL_USER}>`,
      to: email,
      subject: `Nota Servis #${escapeHtml(ticket.ticketNumber)} - Bengkel UTC`,
      html: htmlContent,
    });
    if (sent) {
      console.log(`✅ Email nota terkirim ke: ${email}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Gagal mengirim email:", error);
    await logEmail("ERROR", "Gagal mengirim email nota", {
      ticket_id: ticket.ticketNumber,
      error: (error as Error).message,
    });
    return false;
  }
}
